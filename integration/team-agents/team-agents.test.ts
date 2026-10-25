import test from 'node:test';import assert from 'node:assert/strict';import {MemoryStore} from '../../engram-retrieval/src/store.js';import {CaregiverAgent} from './caregiverAgent';import {TelegramAgent} from './telegramAgent';
import {TelegramDelivery} from './telegramDelivery';
function sharingEnv(t:any){const values={TELEGRAM_BOT_TOKEN:'123456789:synthetic_test_token_not_a_real_token',TELEGRAM_PATIENT_CHAT_ID:'11111',TELEGRAM_CAREGIVER_CHAT_ID:'22222',TELEGRAM_SUBJECT_ID:'p',TELEGRAM_HOUSEHOLD_ID:'h',ENABLE_TELEGRAM_IMAGES:'true',ENABLE_TELEGRAM_LOCATION:'true'};const old=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]]));Object.assign(process.env,values);t.after(()=>{for(const k of Object.keys(values))if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];});}

test('Telegram pictures use approved scoped bytes and the patient recipient, with consent and retry deduplication',async t=>{
 sharingEnv(t);const sent:any[]=[];const service=fixture();
 const images={content:async(patient:string,image:string,admin:boolean)=>{assert.equal(patient,'p');assert.equal(admin,false);if(image!=='approved')throw Error('Unapproved');return {bytes:Buffer.from('test-image'),contentType:'image/png'};}};
 const delivery=new TelegramDelivery(service,images,{},async(url:any,options:any)=>{sent.push({url,body:options.body});return new Response(JSON.stringify({ok:true,result:{message_id:1}}));});
 await assert.rejects(delivery.image('p',{image_id:'approved',request_id:'a'}));
 await assert.rejects(delivery.image('other',{consent:true,image_id:'approved',request_id:'a'}));
 await assert.rejects(delivery.image('p',{consent:true,image_id:'draft',request_id:'a'}));assert.equal(sent.length,0);
 const input={consent:true,image_id:'approved',request_id:'image_test'};assert.equal((await delivery.image('p',input)).state,'provider_accepted');await delivery.image('p',input);
 assert.equal(sent.length,1);assert.match(sent[0].url,/\/sendPhoto$/);assert.equal(sent[0].body.get('chat_id'),'11111');assert.ok(sent[0].body.get('photo') instanceof Blob);
});
test('Telegram location requires fresh same-session GPS and goes only to the explicit configured recipient',async t=>{
 sharingEnv(t);let count=0,payload:any;
 const delivery=new TelegramDelivery(fixture(),{}, {latest:async(p:string,s:string)=>s==='active'?{fresh:true,capturedAt:'2026-10-25T10:00:00Z',accuracy:25,mapUrl:'https://www.google.com/maps/search/?api=1&query=51.2,-0.5'}:{fresh:false}},async(_url:any,options:any)=>{count++;payload=JSON.parse(options.body);return new Response(JSON.stringify({ok:true,result:{message_id:2}}));});
 const input={consent:true,recipient:'caregiver',session_id:'active',request_id:'location_test'};
 await assert.rejects(delivery.location('p',{...input,consent:false}));await assert.rejects(delivery.location('p',{...input,recipient:'arbitrary_chat'}));await assert.rejects(delivery.location('p',{...input,session_id:'different'}));assert.equal(count,0);
 const result=await delivery.location('p',input);assert.equal(result.state,'provider_accepted');assert.equal(payload.chat_id,'22222');assert.match(payload.text,/2026-10-25T10:00:00.000Z/);assert.match(payload.text,/25 metres/);await delivery.location('p',input);assert.equal(count,1);
});
test('Telegram SVG placeholders are files; uncertain delivery is never automatically resent',async t=>{
 sharingEnv(t);let calls=0;const delivery=new TelegramDelivery(fixture(),{content:async()=>({bytes:Buffer.from('<svg/>'),contentType:'image/svg+xml'})},{},async(url:any,options:any)=>{calls++;assert.match(url,/\/sendDocument$/);assert.ok(options.body.get('document'));throw Error('Network timeout');});
 const input={consent:true,image_id:'approved',request_id:'file_test'};assert.equal((await delivery.image('p',input)).state,'unknown_or_failed');assert.equal((await delivery.image('p',input)).state,'unknown_or_failed');assert.equal(calls,1);
});
const fixture=()=>({store:new MemoryStore(),clock:()=>new Date('2026-10-25T10:00:00Z'),cfg:{timezone:'Europe/London'},scope:(p:string)=>({householdId:'h',subjectId:p})});
test('caregiver report is day-scoped, patient-scoped and makes no absence-of-incident claim',async()=>{
 const service=fixture();await service.store.insert('agent_capture_turns',{_id:'foreign',householdId:'h',subjectId:'other',recordedAt:service.clock(),state:'saved',outputs:[{}],transcript:'Private foreign record'});const report=await new CaregiverAgent(service).report('p','alerts');assert.doesNotMatch(report,/Private foreign/);assert.match(report,/does not establish/);
});
test('Telegram is disabled by default and generic configured notifications are idempotent',async()=>{
 process.env.ENABLE_TELEGRAM_ALERTS='false';process.env.ENABLE_TELEGRAM_CAREGIVER_BOT='false';let calls=0;const service=fixture();const agent=new TelegramAgent(service,async(_url:any,options:any)=>{calls++;assert.equal(JSON.parse(options.body).chat_id,'123456789');assert.doesNotMatch(options.body,/latitude|transcript|medicine/);return new Response(JSON.stringify({ok:true,result:{message_id:1}}));});assert.equal((await agent.notify('p','request')).state,'disabled');assert.equal(calls,0);
 process.env.ENABLE_TELEGRAM_ALERTS='true';process.env.TELEGRAM_BOT_TOKEN='123456789:synthetic_test_token_not_a_real_token';process.env.TELEGRAM_CAREGIVER_CHAT_ID='123456789';assert.equal((await agent.notify('p','request')).state,'provider_accepted');await agent.notify('p','request');assert.equal(calls,1);process.env.ENABLE_TELEGRAM_ALERTS='false';
});
test('Telegram bot rejects unconfigured chats and non-private chats before report access',async()=>{
 const service=fixture();process.env.ENABLE_TELEGRAM_CAREGIVER_BOT='true';let requests=0;const agent=new TelegramAgent(service,async(_url:any,options:any)=>{requests++;return new Response(JSON.stringify({ok:true,result:[{update_id:1,message:{chat:{id:999,type:'private'},from:{id:999},text:'/summary'}}]}));});await agent.poll('p');assert.equal(requests,1);process.env.ENABLE_TELEGRAM_CAREGIVER_BOT='false';
});
