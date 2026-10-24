import test from 'node:test';import assert from 'node:assert/strict';
import {requestWithRetry,managedGemini,retryableGeminiError} from './gemini-manager';
import {AnswerJobs} from './answer-jobs';
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
test('temporary provider failure retries and recovers without nested SDK retries',async()=>{
 let calls=0;const phases:string[]=[];
 const result=await requestWithRetry(async()=>{if(++calls===1)throw {status:503};return 'recovered';},{baseDelayMs:0,onProgress:p=>phases.push(p)});
 assert.equal(result,'recovered');assert.equal(calls,2);assert.ok(phases.includes('retrying'));
 const client=managedGemini({interactions:{create:async(_:any,options:any)=>{assert.equal(options.retries.strategy,'none');assert.ok(options.signal instanceof AbortSignal);return 'okay';}}});
 assert.equal(await client.interactions.create({}), 'okay');
});
test('attempt deadline aborts the old signal before retry and retry count is bounded',async()=>{
 let calls=0,old:AbortSignal;
 const result=await requestWithRetry(async signal=>{calls++;if(calls===1){old=signal;return new Promise<string>(()=>{});}assert.equal(old.aborted,true);return 'okay';},{attemptMs:5,baseDelayMs:0});assert.equal(result,'okay');
 calls=0;await assert.rejects(requestWithRetry(async()=>{calls++;throw {status:503};},{baseDelayMs:0}));assert.equal(calls,3);
});
test('permanent failures, depleted quota and safety rejection are not retried',async()=>{
 for(const e of [{status:400},{status:401},{status:403},{status:429,message:'Daily quota exceeded'}]){let calls=0;await assert.rejects(requestWithRetry(async()=>{calls++;throw e;},{baseDelayMs:0}));assert.equal(calls,1);}
 assert.equal(retryableGeminiError({status:429,message:'temporary rate limit'}),true);
 let calls=0;assert.deepEqual(await requestWithRetry(async()=>{calls++;return {status:'no_support'};}),{status:'no_support'});assert.equal(calls,1);
});
test('cancellation interrupts an active call and retry wait',async()=>{
 const controller=new AbortController();const work=requestWithRetry(()=>new Promise(()=>{}),{signal:controller.signal,attemptMs:1000});controller.abort();await assert.rejects(work,{name:'AbortError'});
 const stop=new AbortController();let calls=0;await assert.rejects(requestWithRetry(async()=>{calls++;throw {status:503};},{signal:stop.signal,baseDelayMs:100,onProgress:p=>{if(p==='retrying')stop.abort();}}),{name:'AbortError'});assert.equal(calls,1);
});
test('answer jobs isolate actors, expose progress and discard late cancelled answers',async()=>{
 const jobs=new AnswerJobs();let complete!:(r:any)=>void;
 const job=jobs.start('patient',async(signal,progress,_,interim)=>{progress('retrying');interim({status:'support',answer:'Checking'});return new Promise(r=>complete=r);});
 assert.equal(jobs.snapshot(jobs.get(job.jobId,'patient')).phase,'retrying');assert.throws(()=>jobs.get(job.jobId,'caregiver'));
 jobs.cancel(job.jobId,'patient');complete({answer:'late'});await pause(0);const result=jobs.snapshot(jobs.get(job.jobId,'patient'));assert.equal(result.state,'cancelled');assert.equal(result.result,undefined);assert.equal(result.interim,undefined);jobs.close();
});
test('jobs have a total deadline and do not recover after cancellation or expiry',async()=>{
 const jobs=new AnswerJobs(1000,5);let signal!:AbortSignal;
 const job=jobs.start('p',async s=>{signal=s;return new Promise(()=>{});});await pause(15);assert.equal(signal.aborted,true);assert.equal(jobs.get(job.jobId,'p').state,'failed');jobs.close();
 const expired=new AnswerJobs(2);const id=expired.start('p',async()=>({answer:'done'})).jobId;await pause(8);assert.throws(()=>expired.get(id,'p'));expired.close();
});
