import {TelegramAgent} from './team-agents/telegramAgent';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {ApiError,text,id,choice} from '../engram-retrieval/src/validation.js';
const hash=(...parts:any[])=>createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const safeDevice=(d:any)=>{const{tokenHash,...rest}=d;return rest;};
export function explicitSos(question:unknown){return typeof question==='string'&&/^(?:(?:please|can you|could you|help me)\s+)*(?:sos|call (?:my )?(?:caregiver|guardian|relative)|contact (?:my )?(?:caregiver|guardian)|alert (?:my )?(?:caregiver|guardian))\b/i.test(question.trim());}
export class MobileLink{
 private pairAttempts=new Map<string,{at:number;count:number}>();
 constructor(private service:any,private providerFetch:typeof fetch=fetch){}
 private scope(patient:string){return this.service.scope(patient);}
 private now(){return this.service.clock();}
 async policy(patient:string){return await this.service.store.one('mobile_policies',{...this.scope(patient),_id:hash(this.scope(patient),'policy')})||{allowImages:false,allowSos:false,autoSosOnLost:false,liveCalls:false};}
 async setPolicy(patient:string,input:any){
  for(const key of ['allowImages','allowSos','autoSosOnLost','liveCalls'])if(typeof input[key]!=='boolean')throw new ApiError(400,'Policy fields must be explicit booleans');
  if(input.autoSosOnLost&&!input.allowSos)throw new ApiError(400,'Enable SOS alerts before automatic lost-person SOS');
  if(input.liveCalls&&!input.allowSos)throw new ApiError(400,'Enable SOS before enabling live calls');
  if(input.liveCalls&&!this.callConfigured())throw new ApiError(400,'Live calls require private provider credentials and an approved caregiver number');
  const scope=this.scope(patient),record={_id:hash(scope,'policy'),...scope,allowImages:input.allowImages,allowSos:input.allowSos,autoSosOnLost:input.autoSosOnLost,liveCalls:input.liveCalls,updatedAt:this.now()};
  const old=await this.service.store.one('mobile_policies',{...scope,_id:record._id});if(old)await this.service.store.update('mobile_policies',{...scope,_id:record._id},record);else await this.service.store.insert('mobile_policies',record);
  await this.service.audit(scope,'mobile_policy_updated',record._id);return {policy:record};
 }
 async startPair(patient:string,input:any){
  const scope=this.scope(patient),code=randomBytes(6).toString('hex').toUpperCase(),pairId=hash(code);
  const record={_id:pairId,...scope,role:choice(input.role,['patient','caregiver','demo'],'role'),label:text(input.label,'label',100),used:false,expiresAt:new Date(+this.now()+5*60000)};
  await this.service.store.insert('mobile_pairings',record);return {code,role:record.role,expiresAt:record.expiresAt};
 }
 async pair(input:any,client:string){
  const now=+this.now();for(const[k,v]of this.pairAttempts)if(now-v.at>60000)this.pairAttempts.delete(k);
  if(this.pairAttempts.size>1000)throw new ApiError(429,'Pairing busy; retry later');
  const rate=this.pairAttempts.get(client)||{at:now,count:0};rate.count++;this.pairAttempts.set(client,rate);if(rate.count>12)throw new ApiError(429,'Too many pairing attempts; retry in one minute');
  const code=text(input.code,'code',30).replace(/[\s-]/g,'').toUpperCase();if(!/^[A-F0-9]{12}$/.test(code))throw new ApiError(400,'Use the 12-character pairing code');
  const store=this.service.store,pair=await store.one('mobile_pairings',{_id:hash(code),used:false,expiresAt:{$gt:this.now()}});
  if(!pair)throw new ApiError(400,'Pairing code is invalid, expired or already used');this.scope(pair.subjectId);
  const claimed=await store.update('mobile_pairings',{_id:pair._id,used:false,expiresAt:{$gt:this.now()}},{used:true,usedAt:this.now()});if(!claimed)throw new ApiError(409,'Pairing code was already used');
  const token=randomBytes(32).toString('base64url'),device={_id:'device_'+randomUUID(),householdId:pair.householdId,subjectId:pair.subjectId,role:pair.role,label:pair.label,tokenHash:hash(token),revoked:false,createdAt:this.now(),lastSeenAt:this.now(),expiresAt:new Date(+this.now()+7*86400000)};
  await store.insert('mobile_devices',device);return {device:safeDevice(device),deviceToken:token};
 }
 async authenticate(token:unknown){
  if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))throw new ApiError(401,'Valid paired device token required');
  const device=await this.service.store.one('mobile_devices',{tokenHash:hash(token),revoked:false,expiresAt:{$gt:this.now()}});
  if(!device||this.scope(device.subjectId).householdId!==device.householdId)throw new ApiError(401,'Device revoked or expired');
  await this.service.store.update('mobile_devices',{_id:device._id,revoked:false},{lastSeenAt:this.now()});return device;
 }
 async status(patient:string){const scope=this.scope(patient);const devices=await this.service.store.list('mobile_devices',{...scope,revoked:false,expiresAt:{$gt:this.now()}},{createdAt:-1},30);return {policy:await this.policy(patient),devices:devices.map((d:any)=>({...safeDevice(d),online:+this.now()-+d.lastSeenAt<15000})),voiceProviderConfigured:this.callConfigured()};}
 async revoke(patient:string,deviceId:string){const result=await this.service.store.update('mobile_devices',{...this.scope(patient),_id:id(deviceId)},{revoked:true,revokedAt:this.now()});if(!result)throw new ApiError(404,'Device not found');return {revoked:true};}
 private async command(device:any,kind:string,key:string,payload:any,ttl:number){
  const scope=this.scope(device.subjectId),command={_id:hash(scope,device._id,kind,key),...scope,deviceId:device._id,kind,payload,state:'queued',createdAt:this.now(),expiresAt:new Date(+this.now()+ttl)};
  const created=await this.service.store.insert('mobile_commands',command);return {created,id:command._id};
 }
 async sendImages(patient:string,images:any[]){
  const policy=await this.policy(patient);if(!policy.allowImages||!images.length)return {queued:0};
  const devices=await this.service.store.list('mobile_devices',{...this.scope(patient),role:{$in:['patient','demo']},revoked:false,expiresAt:{$gt:this.now()}},{},30);let queued=0;
  for(const device of devices)for(const image of images.slice(0,4)){
   const result=await this.command(device,'image',image._id+':'+Math.floor(+this.now()/300000),{imageId:image._id,caption:image.caption,personName:image.personName||null},10*60000);if(result.created)queued++;
  }return {queued,delivery:'Queued is not proof of receipt or viewing.'};
 }
 async inbox(device:any){const scope=this.scope(device.subjectId);const policy=await this.policy(device.subjectId);const commands=await this.service.store.list('mobile_commands',{...scope,deviceId:device._id,expiresAt:{$gt:this.now()}},{createdAt:-1},30);const results=[];
  for(const command of commands){if(command.kind==='image'&&!policy.allowImages||command.kind==='sos_alert'&&!policy.allowSos)continue;let callState; if(command.kind==='sos_alert'){const sos=await this.service.store.one('mobile_sos',{...scope,_id:command.payload.sosId});callState=sos?.callState||'not_configured';}results.push({...command,...(callState?{callState}:{})});}
  return {device:safeDevice(device),commands:results};
 }
 async acknowledge(device:any,input:any){
  const scope=this.scope(device.subjectId),command=await this.service.store.one('mobile_commands',{...scope,_id:text(input.command_id,'command_id',100),deviceId:device._id,expiresAt:{$gt:this.now()}});
  if(!command)throw new ApiError(404,'Current device command not found');const state=choice(input.state,command.kind==='image'?['received','viewed']:['received','acknowledged'],'state');
  const ranks:Record<string,number>={queued:0,received:1,viewed:2,acknowledged:2};if(ranks[state]>ranks[command.state])await this.service.store.update('mobile_commands',{...scope,_id:command._id,state:command.state},{state,acknowledgedAt:this.now()});
  return {state:ranks[state]>ranks[command.state]?state:command.state};
 }
 async imageAllowed(device:any,imageId:string){
  if(!(await this.policy(device.subjectId)).allowImages)return false;
  const commands=await this.service.store.list('mobile_commands',{...this.scope(device.subjectId),deviceId:device._id,kind:'image',expiresAt:{$gt:this.now()}},{},100);
  return commands.some((c:any)=>c.payload.imageId===imageId);
 }

 callConfigured(){return process.env.ENABLE_LIVE_SOS_CALLS==='true'&&/^AC[a-fA-F0-9]{32}$/.test(process.env.TWILIO_ACCOUNT_SID||'')&&Boolean(process.env.TWILIO_AUTH_TOKEN)&&/^\+[1-9]\d{7,14}$/.test(process.env.TWILIO_FROM_NUMBER||'')&&/^\+[1-9]\d{7,14}$/.test(process.env.SOS_CAREGIVER_NUMBER||'');}
 async sos(patient:string,input:any){
  const scope=this.scope(patient),store=this.service.store,policy=await this.policy(patient);
  if(!policy.allowSos)return {status:'not_enabled',message:'Phone SOS is not enabled. No alert or call was sent.'};
  const key=text(input.idempotency_key,'idempotency_key',150),sosId=hash(scope,key),old=await store.one('mobile_sos',{...scope,_id:sosId});if(old)return this.sosSummary(old);
  const gateId=hash(scope,'sos_gate');await store.insert('mobile_sos_gates',{_id:gateId,...scope,nextAllowedAt:new Date(0),lastSosId:null});
  const gate=await store.update('mobile_sos_gates',{...scope,_id:gateId,nextAllowedAt:{$lte:this.now()}},{nextAllowedAt:new Date(+this.now()+10*60000),lastSosId:sosId});
  if(!gate){const last=await store.one('mobile_sos_gates',{...scope,_id:gateId});const active=last?.lastSosId?await store.one('mobile_sos',{...scope,_id:last.lastSosId}):null;return active?{...this.sosSummary(active),duplicate:true}:{status:'cooldown',message:'An assistance request is already being prepared. No additional call was requested.'};}
  const record={_id:sosId,...scope,reason:text(input.reason||'The patient requested assistance.','reason',300),status:'queued',callState:policy.liveCalls&&this.callConfigured()?'pending':'not_configured',createdAt:this.now(),expiresAt:new Date(+this.now()+15*60000),alertsQueued:0};
  await store.insert('mobile_sos',record);
  const devices=await store.list('mobile_devices',{...scope,role:{$in:['caregiver','demo']},revoked:false,expiresAt:{$gt:this.now()}},{},30);let count=0;
  for(const device of devices){if((await this.command(device,'sos_alert',sosId,{sosId,message:'The patient has requested assistance. Current location is not verified.'},15*60000)).created)count++;}
  const telegram=await new TelegramAgent(this.service,this.providerFetch).notify(patient,sosId);
  const updated=await store.update('mobile_sos',{...scope,_id:sosId},{alertsQueued:count,telegramState:telegram.state});await this.service.audit(scope,'sos_requested',sosId,{alertsQueued:count,callState:record.callState});return this.sosSummary(updated);
 }
 private sosSummary(s:any){
  const statuses:Record<string,string>={not_configured:'Live calling is not connected.',pending:'A call request is waiting for dispatch; no connection is confirmed.',dispatching:'Call submission is being checked; no connection is confirmed.',queued:'The provider accepted the call request; it is not confirmed answered.',ringing:'The caregiver number is ringing; an answer is not confirmed.','in-progress':'The provider reports an answered call. This could be a person or voicemail.',completed:'The provider reports the call ended. This does not confirm assistance was received.',provider_rejected:'The provider rejected the call request. No connection is confirmed.',unknown_outcome:'Call submission outcome is unknown. Automatic redial is blocked.',expired:'The call request expired before dispatch.',busy:'The caregiver line was busy.',failed:'The provider reports the call failed.','no-answer':'The call was not answered.',canceled:'The call was cancelled.'};
  return {requestId:s._id,status:s.status,reason:s.reason,callState:s.callState,alertsQueued:s.alertsQueued,telegramState:s.telegramState||'disabled',message:(s.telegramState==='provider_accepted'?'Telegram accepted a caretaker notification; reading is not confirmed. ':'')+(s.alertsQueued?'An SOS alert is queued for the linked caregiver phone. Receipt has not been confirmed. ':'No linked caregiver phone alert is queued yet. ')+(statuses[s.callState]||'The call outcome is not confirmed.')};
 }

 async actions(patient:string){const records=await this.service.store.list('mobile_sos',this.scope(patient),{createdAt:-1},30);const commands=await this.service.store.list('mobile_commands',this.scope(patient),{createdAt:-1},50);return {sos:records.map((s:any)=>({...this.sosSummary(s),createdAt:s.createdAt})),commands:commands.map((c:any)=>({id:c._id,kind:c.kind,state:c.state,deviceId:c.deviceId,expiresAt:c.expiresAt}))};}
 async tick(){
  const store=this.service.store;for(const patient of this.service.cfg.subjectIds){const scope=this.scope(patient),policy=await this.policy(patient);
   if(policy.allowSos){
    const alerts=await store.list('mobile_sos',{...scope,status:'queued',expiresAt:{$gt:this.now()}},{},30);
    const caregivers=await store.list('mobile_devices',{...scope,role:{$in:['caregiver','demo']},revoked:false,expiresAt:{$gt:this.now()}},{},30);
    for(const alert of alerts){let count=0;for(const device of caregivers)if((await this.command(device,'sos_alert',alert._id,{sosId:alert._id,message:'The patient has requested assistance. Current location is not verified.'},Math.max(1000,+alert.expiresAt-+this.now()))).created)count++;if(count)await store.update('mobile_sos',{...scope,_id:alert._id},{alertsQueued:alert.alertsQueued+count});}
   }
   const stale=await store.list('mobile_sos' ,{...scope,callState:'dispatching',createdAt:{$lt:new Date(+this.now()-60000)}},{},10);for(const item of stale)await store.update('mobile_sos',{...scope,_id:item._id,callState:'dispatching'},{callState:'unknown_outcome'});
   const pending=await store.list('mobile_sos',{...scope,callState:'pending'},{createdAt:1},5);
   for(const item of pending){
    if(!policy.allowSos||!policy.liveCalls||!this.callConfigured()){await store.update('mobile_sos',{...scope,_id:item._id,callState:'pending'},{callState:'not_configured'});continue;}
    if(item.expiresAt<=this.now()){await store.update('mobile_sos',{...scope,_id:item._id,callState:'pending'},{callState:'expired'});continue;}
    const claimed=await store.update('mobile_sos',{...scope,_id:item._id,callState:'pending'},{callState:'dispatching'});if(!claimed)continue;
    // Exactly one create attempt. A timeout has unknown outcome and must never trigger automatic redial.
    try{const body=new URLSearchParams({To:process.env.SOS_CAREGIVER_NUMBER!,From:process.env.TWILIO_FROM_NUMBER!,Twiml:'<Response><Say>A care companion user has requested assistance. Please contact your relative or check the caregiver app. This alert does not verify their location.</Say></Response>'});
     const r=await this.providerFetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Calls.json`,{method:'POST',headers:{Authorization:'Basic '+Buffer.from(process.env.TWILIO_ACCOUNT_SID+':'+process.env.TWILIO_AUTH_TOKEN).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(10000)});
     if(!r.ok){await store.update('mobile_sos',{...scope,_id:item._id},{callState:'provider_rejected'});continue;}
     const call=await r.json();if(!/^CA[a-fA-F0-9]{32}$/.test(call.sid))throw Error('Invalid provider receipt');
     await store.update('mobile_sos',{...scope,_id:item._id},{callState:['queued','ringing','in-progress','completed'].includes(call.status)?call.status:'queued',providerSid:call.sid});
    }catch{await store.update('mobile_sos',{...scope,_id:item._id},{callState:'unknown_outcome'});}
   }
   const active=await store.list('mobile_sos',{...scope,callState:{$in:['queued','ringing','in-progress']}},{createdAt:-1},10);
   for(const item of active){if(!this.callConfigured()||!item.providerSid)continue;try{
    const r=await this.providerFetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Calls/${item.providerSid}.json`,{headers:{Authorization:'Basic '+Buffer.from(process.env.TWILIO_ACCOUNT_SID+':'+process.env.TWILIO_AUTH_TOKEN).toString('base64')},signal:AbortSignal.timeout(5000)});
    if(r.ok){const data=await r.json();if(['queued','ringing','in-progress','completed','busy','failed','no-answer','canceled'].includes(data.status))await store.update('mobile_sos',{...scope,_id:item._id},{callState:data.status});}
   }catch{/* Keep the last confirmed provider status. No redial. */}}
  }
 }
}
