import test from 'node:test';import assert from 'node:assert/strict';import {MemoryStore} from '../../engram-retrieval/src/store.js';import {CaregiverAgent} from './caregiverAgent';import {TelegramAgent} from './telegramAgent';
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
