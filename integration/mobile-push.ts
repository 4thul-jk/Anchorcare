import webpush from 'web-push';
import {ApiError} from '../engram-retrieval/src/validation.js';

// Restrict destinations to browser push services: never POST to an arbitrary client URL.
export function checkedSubscription(input:any){
 let url:URL;try{url=new URL(input?.endpoint);}catch{throw new ApiError(400,'Invalid push subscription');}
 const host=url.hostname;
 if(url.protocol!=='https:'||url.port||url.username||url.password||!['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(host)&&!host.endsWith('.notify.windows.com'))throw new ApiError(400,'Unsupported browser push service');
 if(url.href.length>2048||!/^\w[\w-]{85,89}$/.test(input?.keys?.p256dh||'')||!/^[\w-]{22}$/.test(input?.keys?.auth||''))throw new ApiError(400,'Invalid subscription encryption keys');
 return {endpoint:url.href,keys:{p256dh:input.keys.p256dh,auth:input.keys.auth}};
}
export class MobilePush{
 constructor(private service:any,private mobile:any,private send:any=webpush.sendNotification){}
 config(){return {configured:Boolean(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY&&process.env.VAPID_SUBJECT),publicKey:process.env.VAPID_PUBLIC_KEY||null};}
 async subscribe(device:any,input:any){
  if(!this.config().configured)throw new ApiError(503,'Background notifications are not configured');
  const subscription=checkedSubscription(input);
  // A browser subscription belongs to one current device; re-pairing must not retain another patient's subscription.
  const existing=await this.service.store.list('mobile_push',{endpoint:subscription.endpoint},{},100);
  for(const old of existing)await this.service.store.update('mobile_push',{_id:old._id},{enabled:false});
  const record={_id:device._id,...this.service.scope(device.subjectId),endpoint:subscription.endpoint,subscription,enabled:true,updatedAt:this.service.clock()};
  const old=await this.service.store.one('mobile_push',{_id:device._id});
  if(old)await this.service.store.update('mobile_push',{_id:device._id},record);else await this.service.store.insert('mobile_push',record);
  return {enabled:true};
 }
 async disable(device:any){await this.service.store.update('mobile_push',{_id:device._id},{enabled:false});return {enabled:false};}
 async tick(){
  if(!this.config().configured)return;
  for(const patient of this.service.cfg.subjectIds){
   const scope=this.service.scope(patient),now=this.service.clock(),policy=await this.mobile.policy(patient);
   const devices=await this.service.store.list('mobile_devices',{...scope,revoked:false,expiresAt:{$gt:now}},{},30);
   for(const device of devices){
    const sub=await this.service.store.one('mobile_push',{...scope,_id:device._id,enabled:true});if(!sub)continue;
    const commands=await this.service.store.list('mobile_commands',{...scope,deviceId:device._id,state:'queued',expiresAt:{$gt:now}},{createdAt:1},30);
    for(const command of commands){
     if(command.kind==='image'?!policy.allowImages:command.kind==='sos_alert'?!policy.allowSos:true)continue;
     const claim={_id:command._id,...scope,state:'dispatching',createdAt:now};
     if(!await this.service.store.insert('mobile_push_attempts',claim))continue;
     try{
      // No names, pictures, location, credentials or medical details on a lock screen.
      await this.send(checkedSubscription(sub.subscription),JSON.stringify({kind:command.kind,tag:command._id}),{TTL:Math.max(1,Math.min(900,Math.floor((+command.expiresAt-+now)/1000))),urgency:command.kind==='sos_alert'?'high':'normal',timeout:8000,vapidDetails:{subject:process.env.VAPID_SUBJECT!,publicKey:process.env.VAPID_PUBLIC_KEY!,privateKey:process.env.VAPID_PRIVATE_KEY!}});
      await this.service.store.update('mobile_push_attempts',{_id:command._id},{state:'provider_accepted'});
     }catch(e:any){
      if(e.statusCode===404||e.statusCode===410)await this.disable(device);
      await this.service.store.update('mobile_push_attempts',{_id:command._id},{state:e.statusCode?'provider_rejected':'unknown_outcome'});
     }
    }
   }
  }
 }
}
