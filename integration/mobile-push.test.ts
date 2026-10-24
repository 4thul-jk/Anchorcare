import test from 'node:test';
import assert from 'node:assert/strict';
import {MobilePush,checkedSubscription} from './mobile-push';
import {MobileLink} from './mobile-link';
import {MemoryStore} from '../engram-retrieval/src/store.js';
const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/fake-test',keys:{p256dh:'B'+'a'.repeat(86),auth:'b'.repeat(22)}};
test('push rejects arbitrary endpoints and malformed keys',()=>{
 for(const endpoint of ['http://fcm.googleapis.com/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.test/x','https://user:pass@fcm.googleapis.com/x'])assert.throws(()=>checkedSubscription({...subscription,endpoint}));
 assert.throws(()=>checkedSubscription({...subscription,keys:{}}));assert.equal(checkedSubscription(subscription).endpoint,subscription.endpoint);
});
test('push is private, deduplicated, respects policy and revocation; expired subscriptions disable',async t=>{
 const keys=['VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT'],old=keys.map(k=>process.env[k]);
 t.after(()=>keys.forEach((k,i)=>{if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];}));
 Object.assign(process.env,{VAPID_PUBLIC_KEY:'fake',VAPID_PRIVATE_KEY:'fake',VAPID_SUBJECT:'mailto:test@example.org'});
 const store=new MemoryStore(),service={store,cfg:{subjectIds:['p']},scope:(subjectId:string)=>({householdId:'h',subjectId}),clock:()=>new Date('2026-10-24T12:00:00Z'),audit:async()=>{}};
 const mobile=new MobileLink(service),sent:any[]=[];
 const push=new MobilePush(service,mobile,async(_:any,payload:string)=>{sent.push(JSON.parse(payload));});
 const code=await mobile.startPair('p',{role:'demo',label:'Test'}),pair=await mobile.pair({code:code.code},'test'),device=await mobile.authenticate(pair.deviceToken);
 await push.subscribe(device,subscription);await mobile.setPolicy('p',{allowImages:true,allowSos:true,autoSosOnLost:false,liveCalls:false});
 await mobile.sendImages('p',[{_id:'one',caption:'Private patient name'}]);await push.tick();await push.tick();assert.equal(sent.length,1);assert.deepEqual(Object.keys(sent[0]).sort(),['kind','tag']);
 assert.equal((await mobile.inbox(device)).commands[0].state,'queued'); // Push service acceptance is not a view/receipt.
 await mobile.sendImages('p',[{_id:'two',caption:'Hidden'}]);await mobile.setPolicy('p',{allowImages:false,allowSos:false,autoSosOnLost:false,liveCalls:false});await push.tick();assert.equal(sent.length,1);
 await mobile.setPolicy('p',{allowImages:true,allowSos:true,autoSosOnLost:false,liveCalls:false});
 const expired=new MobilePush(service,mobile,async()=>{throw Object.assign(Error('Gone'),{statusCode:410});});await expired.tick();assert.equal((await store.one('mobile_push',{_id:device._id})).enabled,false);
 await push.subscribe(device,subscription);await mobile.revoke('p',device._id);await push.tick();assert.equal(sent.length,1);
});
