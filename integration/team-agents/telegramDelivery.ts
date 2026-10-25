import {createHash} from 'node:crypto';
import {ApiError,id} from '../../engram-retrieval/src/validation.js';

// Explicit sharing only. Recipients, bot token and patient scope are server configuration.
export class TelegramDelivery{
 constructor(private service:any,private images:any,private locations:any,private transport:typeof fetch=fetch){}
 status(patient:string){
  const scope=this.service.scope(patient),scoped=process.env.TELEGRAM_SUBJECT_ID===scope.subjectId&&process.env.TELEGRAM_HOUSEHOLD_ID===scope.householdId;
  const bot=/^[0-9]{6,}:[A-Za-z0-9_-]{20,}$/.test(process.env.TELEGRAM_BOT_TOKEN||'');
  const valid=(value:string|undefined)=>/^[1-9][0-9]{0,19}$/.test(value||'');
  return {scopeMatched:scoped,botConfigured:bot,patientConfigured:valid(process.env.TELEGRAM_PATIENT_CHAT_ID),caregiverConfigured:valid(process.env.TELEGRAM_CAREGIVER_CHAT_ID),imagesEnabled:scoped&&bot&&valid(process.env.TELEGRAM_PATIENT_CHAT_ID)&&process.env.ENABLE_TELEGRAM_IMAGES==='true',locationEnabled:scoped&&bot&&process.env.ENABLE_TELEGRAM_LOCATION==='true'&&(valid(process.env.TELEGRAM_PATIENT_CHAT_ID)||valid(process.env.TELEGRAM_CAREGIVER_CHAT_ID))};
 }
 private async request(method:string,payload:any){
  const multipart=payload instanceof FormData;
  const r=await this.transport('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/'+method,{method:'POST',...(multipart?{}:{headers:{'Content-Type':'application/json'}}),body:multipart?payload:JSON.stringify(payload),signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('Telegram rejected delivery');const data=await r.json();if(!data.ok)throw Error('Telegram rejected delivery');return data.result;
 }
 private async deliver(patient:string,kind:string,key:unknown,recipient:string,send:()=>Promise<any>){
  const requestId=id(key,'request_id'),scope=this.service.scope(patient),deliveryId=createHash('sha256').update(JSON.stringify([scope,kind,requestId,recipient])).digest('hex');
  const previous=await this.service.store.one('telegram_deliveries',{...scope,_id:deliveryId});
  if(previous)return {state:previous.state,message:'This share request was already processed. Telegram acceptance does not confirm it was read.'};
  if(!await this.service.store.insert('telegram_deliveries',{_id:deliveryId,...scope,kind,state:'sending',createdAt:this.service.clock()}))return {state:'sending',message:'This share is already being processed.'};
  try{const result=await send();await this.service.store.update('telegram_deliveries',{...scope,_id:deliveryId},{state:'provider_accepted',messageId:result.message_id,updatedAt:this.service.clock()});return {state:'provider_accepted',message:'Telegram accepted the share. Receipt or reading has not been confirmed.'};}
  catch{await this.service.store.update('telegram_deliveries',{...scope,_id:deliveryId},{state:'unknown_or_failed',updatedAt:this.service.clock()});return {state:'unknown_or_failed',message:'Telegram delivery was not confirmed. Automatic retry is blocked to avoid duplicate shares.'};}
 }
 async image(patient:string,input:any){
  if(input.consent!==true)throw new ApiError(400,'Confirm sharing this picture with the configured patient Telegram account');
  if(!this.status(patient).imagesEnabled)throw new ApiError(409,'Telegram picture delivery is not configured for this patient workspace');
  const imageId=id(input.image_id,'image_id'),content=await this.images.content(patient,imageId,false);
  const target=process.env.TELEGRAM_PATIENT_CHAT_ID!;
  return this.deliver(patient,'image:'+imageId,input.request_id,target,async()=>{
   const photo=['image/png','image/jpeg','image/webp'].includes(content.contentType),method=photo?'sendPhoto':'sendDocument',field=photo?'photo':'document';
   const ext=content.contentType==='image/svg+xml'?'svg':content.contentType==='image/jpeg'?'jpg':content.contentType==='image/webp'?'webp':'png';
   const form=new FormData();form.set('chat_id',target);form.set('caption','Muse: a saved memory picture you chose to share.');form.set(field,new Blob([new Uint8Array(content.bytes)],{type:content.contentType}),'muse-memory.'+ext);
   return this.request(method,form);
  });
 }
 async location(patient:string,input:any){
  if(input.consent!==true)throw new ApiError(400,'Confirm sharing this device location through Telegram');
  const status=this.status(patient);if(!status.locationEnabled)throw new ApiError(409,'Telegram location delivery is not configured for this patient workspace');
  if(!['patient','caregiver'].includes(input.recipient))throw new ApiError(400,'Choose patient or caregiver');
  const target=input.recipient==='patient'?process.env.TELEGRAM_PATIENT_CHAT_ID:process.env.TELEGRAM_CAREGIVER_CHAT_ID;
  if(!/^[1-9][0-9]{0,19}$/.test(target||''))throw new ApiError(409,'The selected Telegram recipient is not configured');
  const session=id(input.session_id,'session_id'),location=await this.locations.latest(patient,session);
  if(!location?.fresh)throw new ApiError(400,'Share a fresh device location first (within five minutes)');
  // One timestamped message keeps delivery atomic and gives the recipient a Maps link.
  const message=`Muse: device location shared with permission.\nCaptured: ${new Date(location.capturedAt).toISOString()}\nApproximate accuracy: ${Math.round(location.accuracy)} metres.\n${location.mapUrl}\nThis is the device position, not confirmation that the person is with it.`;
  return this.deliver(patient,'location',input.request_id,target!,()=>this.request('sendMessage',{chat_id:target,text:message,link_preview_options:{is_disabled:true}}));
 }
}
