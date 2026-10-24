import test from 'node:test';import assert from 'node:assert/strict';
import {MedicationReminders} from './medication';
import {MemoryStore} from '../engram-retrieval/src/store.js';
import {EngramService} from '../engram-retrieval/src/service.js';
import {config} from '../engram-retrieval/src/config.js';
function fixture(){let now=new Date('2026-10-24T10:00:00Z');const store=new MemoryStore();const service=new EngramService(store,{...config(),mode:'memory',householdId:'h',subjectIds:['p','other'],quietStart:'00:00',quietEnd:'00:00',cooldownSeconds:0},()=>new Date(now));return{store,service,med:new MedicationReminders(service),advance:(ms:number)=>{now=new Date(+now+ms);},now:()=>now};}
async function schedule(f:ReturnType<typeof fixture>){return (await f.med.create('p',{id:'test_med',label:'FICTIONAL care-plan check',care_plan_ref:'DEMO-001',scheduled_at:new Date(+f.now()+60000).toISOString()})).plan;}
test('drafts never prompt; approved schedule delivers exactly once and snoozes without a new job',async()=>{
 const f=fixture();await schedule(f);await f.service.tick();assert.equal((await f.store.list('prompt_jobs')).length,0);
 await f.med.approve('p',{plan_id:'test_med',status:'carer_verified'});f.advance(60000);await f.service.tick();await f.service.tick();
 const prompts=await f.service.prompts('p');assert.equal(prompts.length,1);assert.equal(prompts[0].kind,'medication');assert.match(prompts[0].message,/unsure/);
 await f.service.respond({subjectId:'p',promptId:prompts[0]._id,action:'snoozed'});assert.equal((await f.service.prompts('p')).length,0);f.advance(60000);assert.equal((await f.service.prompts('p')).length,1);
});
test('unsure report is retry-safe, remains unverified and prevents repeat reminders',async()=>{
 const f=fixture();await schedule(f);await f.med.approve('p',{plan_id:'test_med',status:'carer_verified'});f.advance(60000);await f.service.tick();const p=(await f.service.prompts('p'))[0];
 await assert.rejects(f.service.respond({subjectId:'p',promptId:p._id,action:'self_reported_done'}));
 const first=await f.med.respond('p',{prompt_id:p._id,action:'unsure'});const repeat=await f.med.respond('p',{prompt_id:p._id,action:'unsure'});
 assert.equal(repeat.duplicate,true);assert.equal(first.response._id,repeat.response._id);await assert.rejects(f.med.respond('p',{prompt_id:p._id,action:'taken'}));
 const logs=await f.store.list('daily_logs');assert.equal(logs.length,1);assert.equal(logs[0].outcome,'uncertain');assert.equal(logs[0].sourceType,'user_report');assert.equal(logs[0].reviewStatus,'draft');
 await f.service.tick();assert.equal((await f.service.prompts('p')).length,0);const review=await f.med.review('p');assert.equal(review.records[0].reviewRequired,true);
 await f.med.acknowledge('p',{response_id:first.response._id,note:'Fictional caregiver follow-up recorded'});assert.equal((await f.med.review('p')).records[0].reviewRequired,false);
 assert.equal((await f.store.list('daily_logs'))[0].reviewStatus,'draft');
});
test('cancelled and cross-patient responses are rejected; unanswered does not mean missed medicine',async()=>{
 const f=fixture();await schedule(f);await f.med.approve('p',{plan_id:'test_med',status:'carer_verified'});f.advance(60000);await f.service.tick();const p=(await f.service.prompts('p'))[0];
 await assert.rejects(f.med.respond('other',{prompt_id:p._id,action:'taken'}));f.advance(600001);const review=await f.med.review('p');assert.equal(review.records[0].responseState,'unanswered');assert.match(review.records[0].interpretation,/does not prove/);
 await assert.rejects(f.med.respond('p',{prompt_id:p._id,action:'taken'}));
});
test('withdrawn approval blocks responses and taken is still only a patient report',async()=>{
 for(const action of ['taken','not_taken']){const f=fixture();await schedule(f);await f.med.approve('p',{plan_id:'test_med',status:'carer_verified'});f.advance(60000);await f.service.tick();const p=(await f.service.prompts('p'))[0];const r=await f.med.respond('p',{prompt_id:p._id,action});assert.equal(r.response.sourceType,'user_report');assert.match((await f.store.list('daily_logs'))[0].originalText,/not verified/);}
 const f=fixture();await schedule(f);await f.med.approve('p',{plan_id:'test_med',status:'carer_verified'});f.advance(60000);await f.service.tick();const p=(await f.service.prompts('p'))[0];await f.service.cancelPlan({subjectId:'p',planId:'test_med'});await assert.rejects(f.med.respond('p',{prompt_id:p._id,action:'unsure'}));
});
