import {createHash} from 'node:crypto';import {CaregiverAgent} from './caregiverAgent';
export class TelegramAgent{
 private offset=0;private polling=false;private closed=false;
 constructor(private service:any,private transport:typeof fetch=fetch){}
 status(){return {alertsEnabled:process.env.ENABLE_TELEGRAM_ALERTS==='true',caregiverBotEnabled:process.env.ENABLE_TELEGRAM_CAREGIVER_BOT==='true',configured:/^[0-9]{6,}:[A-Za-z0-9_-]{20,}$/.test(process.env.TELEGRAM_BOT_TOKEN||'')&&/^-?[0-9]{1,20}$/.test(process.env.TELEGRAM_CAREGIVER_CHAT_ID||'')};}
 private async request(method:string,payload:any){const response=await this.transport('https://api.telegram.org/bot'+process.env.TELEGRAM_BOT_TOKEN+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('Telegram request failed');const body=await response.json();if(!body.ok)throw Error('Telegram request rejected');return body.result;}
 async notify(patient:string,requestId:string){
  const status=this.status();if(!status.alertsEnabled||!status.configured)return {state:'disabled'};
  const scope=this.service.scope(patient),key=createHash('sha256').update(JSON.stringify([scope,requestId])).digest('hex');
  const row={_id:key,...scope,requestId,state:'sending',createdAt:this.service.clock()};if(!await this.service.store.insert('telegram_deliveries',row))return {state:'already_processed'};
  try{await this.request('sendMessage',{chat_id:process.env.TELEGRAM_CAREGIVER_CHAT_ID,text:'Muse: the configured demo patient requested caretaker assistance. Please check the private caregiver dashboard. This message does not confirm an emergency or a phone call.'});await this.service.store.update('telegram_deliveries',{...scope,_id:key},{state:'provider_accepted',updatedAt:this.service.clock()});return {state:'provider_accepted'};}
  catch{await this.service.store.update('telegram_deliveries',{...scope,_id:key},{state:'unknown_or_failed',updatedAt:this.service.clock()});return {state:'unknown_or_failed'};}
 }
 async poll(patient:string){
  const status=this.status();if(this.closed||this.polling||!status.caregiverBotEnabled||!status.configured)return;this.polling=true;
  try{const scope=this.service.scope(patient),stateId='telegram_offset_'+patient;const saved=await this.service.store.one('telegram_state',{...scope,_id:stateId});this.offset=Math.max(this.offset,saved?.offset||0);const updates=await this.request('getUpdates',{offset:this.offset,timeout:0,allowed_updates:['message']});
   for(const update of updates||[]){this.offset=Math.max(this.offset,update.update_id+1);if(!await this.service.store.one('telegram_state',{...scope,_id:stateId}))await this.service.store.insert('telegram_state',{_id:stateId,...scope,offset:this.offset});else await this.service.store.update('telegram_state',{...scope,_id:stateId},{offset:this.offset});const msg=update.message;
    // Private, exact configured caretaker chat only; no arbitrary chat may read patient records.
    if(msg?.chat?.type!=='private'||String(msg.chat.id)!==process.env.TELEGRAM_CAREGIVER_CHAT_ID||String(msg.from?.id)!==process.env.TELEGRAM_CAREGIVER_CHAT_ID)continue;
    const text=String(msg.text||'').trim().toLowerCase();let reply='Muse caregiver commands: /summary or /alerts. Use the authenticated web app to add or change memories.';
    if(text==='/summary'||text==='summary')reply=await new CaregiverAgent(this.service).report(patient,'summary');
    else if(text==='/alerts'||text==='alerts')reply=await new CaregiverAgent(this.service).report(patient,'alerts');
    await this.request('sendMessage',{chat_id:process.env.TELEGRAM_CAREGIVER_CHAT_ID,text:reply.slice(0,3900)});
   }
  }catch{/* No tokens, raw responses or patient text in logs. */}finally{this.polling=false;}
 }
 close(){this.closed=true;}
}
