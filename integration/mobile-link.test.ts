import test from 'node:test';import assert from 'node:assert/strict';
import {MobileLink,explicitSos} from './mobile-link';import {MemoryStore} from '../engram-retrieval/src/store.js';
function fixture(provider:any=async()=>{throw Error('No real provider in tests');}){let time=new Date('2026-10-24T12:00:00Z');const store=new MemoryStore(),service={store,cfg:{subjectIds:['p']},scope:(subject:string)=>({householdId:'h',subjectId:subject}),clock:()=>new Date(time),audit:async()=>{}};return{store,mobile:new MobileLink(service,provider),advance:(ms:number)=>time=new Date(+time+ms)};}
async function pair(f:ReturnType<typeof fixture>,role='patient'){const code=await f.mobile.startPair('p',{role,label:'Fictional test '+role});return f.mobile.pair({code:code.code},role);}
const policy={allowImages:true,allowSos:true,autoSosOnLost:false,liveCalls:false};
test('pairing is one-use, expires and exposes no stored token hashes',async()=>{
 const f=fixture();const code=await f.mobile.startPair('p',{role:'patient',label:'Demo'});const linked=await f.mobile.pair({code:code.code},'ip');assert.ok(linked.deviceToken);assert.equal('tokenHash' in linked.device,false);assert.equal((await f.mobile.authenticate(linked.deviceToken)).subjectId,'p');await assert.rejects(f.mobile.pair({code:code.code},'ip'));
 const expired=await f.mobile.startPair('p',{role:'patient',label:'Expired'});f.advance(300001);await assert.rejects(f.mobile.pair({code:expired.code},'ip'));
 await f.mobile.revoke('p',linked.device._id);await assert.rejects(f.mobile.authenticate(linked.deviceToken));
});
test('image forwarding requires permission, deduplicates and separates queued from viewed',async()=>{
 const f=fixture(),p=await pair(f),caregiver=await pair(f,'caregiver');const device=await f.mobile.authenticate(p.deviceToken),other=await f.mobile.authenticate(caregiver.deviceToken);
 const images=[{_id:'image_demo',caption:'Fictional picture',personName:'Sarah'}];assert.equal((await f.mobile.sendImages('p',images)).queued,0);
 await f.mobile.setPolicy('p',policy);assert.equal((await f.mobile.sendImages('p',images)).queued,1);assert.equal((await f.mobile.sendImages('p',images)).queued,0);
 const inbox=await f.mobile.inbox(device);assert.equal(inbox.commands[0].state,'queued');assert.equal((await f.mobile.inbox(other)).commands.length,0);assert.equal(await f.mobile.imageAllowed(device,'image_demo'),true);assert.equal(await f.mobile.imageAllowed(other,'image_demo'),false);
 await f.mobile.acknowledge(device,{command_id:inbox.commands[0]._id,state:'viewed'});await f.mobile.acknowledge(device,{command_id:inbox.commands[0]._id,state:'received'});assert.equal((await f.mobile.inbox(device)).commands[0].state,'viewed');await assert.rejects(f.mobile.acknowledge(other,{command_id:inbox.commands[0]._id,state:'viewed'}));
 await f.mobile.setPolicy('p',{...policy,allowImages:false});assert.equal((await f.mobile.inbox(device)).commands.length,0);assert.equal(await f.mobile.imageAllowed(device,'image_demo'),false);
});
test('SOS sends only a caregiver-browser alert, deduplicates and never invents a real call',async()=>{
 const f=fixture();const c=await pair(f,'caregiver'),p=await pair(f);await f.mobile.setPolicy('p',policy);
 const first=await f.mobile.sos('p',{idempotency_key:'test-sos-one'});assert.ok('alertsQueued' in first && 'callState' in first);assert.equal(first.alertsQueued,1);assert.equal(first.callState,'not_configured');assert.match(first.message,/Receipt has not been confirmed/);
 await f.mobile.sos('p',{idempotency_key:'test-sos-one'});await f.mobile.sos('p',{idempotency_key:'test-sos-two'});assert.equal((await f.store.list('mobile_sos')).length,1);
 const cd=await f.mobile.authenticate(c.deviceToken),pd=await f.mobile.authenticate(p.deviceToken);assert.equal((await f.mobile.inbox(pd)).commands.length,0);const inbox=await f.mobile.inbox(cd);assert.equal(inbox.commands[0].kind,'sos_alert');
 await f.mobile.acknowledge(cd,{command_id:inbox.commands[0]._id,state:'acknowledged'});assert.equal((await f.mobile.inbox(cd)).commands[0].state,'acknowledged');
 assert.equal(explicitSos('please call my caregiver'),true);assert.equal(explicitSos('When did I call my caregiver?'),false);
});
test('caregiver paired after an SOS can still receive the current pending alert',async()=>{
 const f=fixture();await f.mobile.setPolicy('p',policy);await f.mobile.sos('p',{idempotency_key:'before-pair'});const c=await pair(f,'caregiver');await f.mobile.tick();assert.equal((await f.mobile.inbox(await f.mobile.authenticate(c.deviceToken))).commands.length,1);
});
test('live call has one submission attempt and a timeout never causes automatic redial',async t=>{
 const keys=['ENABLE_LIVE_SOS_CALLS','TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_FROM_NUMBER','SOS_CAREGIVER_NUMBER'];const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));t.after(()=>{for(const k of keys)if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];});
 Object.assign(process.env,{ENABLE_LIVE_SOS_CALLS:'true',TWILIO_ACCOUNT_SID:'AC'+'1'.repeat(32),TWILIO_AUTH_TOKEN:'fake-test-token',TWILIO_FROM_NUMBER:'+15555550100',SOS_CAREGIVER_NUMBER:'+15555550101'});
 let creates=0;const f=fixture(async(_:string,options:any)=>{if(options.method==='POST'){creates++;throw Error('network timeout');}return{ok:true,json:async()=>({status:'completed'})};});await f.mobile.setPolicy('p',{...policy,liveCalls:true});await f.mobile.sos('p',{idempotency_key:'voice-test'});await f.mobile.tick();await f.mobile.tick();assert.equal(creates,1);assert.equal((await f.mobile.actions('p')).sos[0].callState,'unknown_outcome');
});
test('pair attempts are rate-limited and expiry prevents reading old delivery commands',async()=>{
 const f=fixture();for(let i=0;i<12;i++)await assert.rejects(f.mobile.pair({code:'000000000000'},'one-ip'));await assert.rejects(f.mobile.pair({code:'000000000000'},'one-ip'),(e:any)=>e.status===429);
});

test('one demo receiver can receive both images and SOS, with fresh consent on each policy',async()=>{
 const f=fixture(),linked=await pair(f,'demo');await f.mobile.setPolicy('p',policy);await f.mobile.sendImages('p',[{_id:'image_one',caption:'Fictional'}]);await f.mobile.sos('p',{idempotency_key:'demo-sos'});
 const device=await f.mobile.authenticate(linked.deviceToken);const inbox=await f.mobile.inbox(device);assert.deepEqual(new Set(inbox.commands.map(c=>c.kind)),new Set(['image','sos_alert']));
 await f.mobile.setPolicy('p',{...policy,allowImages:false,allowSos:false});assert.equal((await f.mobile.inbox(device)).commands.length,0);
});
test('mocked provider acceptance and answered status remain distinct from confirmed human assistance',async t=>{
 const keys=['ENABLE_LIVE_SOS_CALLS','TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_FROM_NUMBER','SOS_CAREGIVER_NUMBER'];const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));t.after(()=>{for(const k of keys)if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];});
 Object.assign(process.env,{ENABLE_LIVE_SOS_CALLS:'true',TWILIO_ACCOUNT_SID:'AC'+'2'.repeat(32),TWILIO_AUTH_TOKEN:'fake-only',TWILIO_FROM_NUMBER:'+15555550100',SOS_CAREGIVER_NUMBER:'+15555550101'});
 let calls=0;const f=fixture(async(_:string,options:any)=>{if(options.method==='POST'){calls++;return{ok:true,json:async()=>({sid:'CA'+'3'.repeat(32),status:'queued'})};}return{ok:true,json:async()=>({status:'in-progress'})};});
 await f.mobile.setPolicy('p',{...policy,liveCalls:true});await f.mobile.sos('p',{idempotency_key:'mock-success'});await f.mobile.tick();await f.mobile.tick();assert.equal(calls,1);const result=(await f.mobile.actions('p')).sos[0];assert.equal(result.callState,'in-progress');assert.match(result.message,/voicemail/);
});
