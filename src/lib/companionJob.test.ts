import test from 'node:test';import assert from 'node:assert/strict';import {runCompanionJob} from './companionJob';
test('browser keeps polling, shows interim evidence, then accepts the checked recovered result',async()=>{
 let calls=0,job='',interim:any;const phases:string[]=[];
 const api:any=async()=>{calls++;if(calls===1)return{jobId:'j'};if(calls===2)throw Object.assign(Error('network'),{status:503});if(calls===3)return{state:'pending',phase:'retrying',interim:{status:'evidence_only'}};return{state:'completed',result:{answer:'Checked answer'}};};
 const result=await runCompanionJob('key',{question:'q'},{signal:new AbortController().signal,onJob:id=>job=id,onProgress:p=>phases.push(p),onInterim:r=>interim=r,pollMs:1},api);
 assert.equal(job,'j');assert.equal(interim.status,'evidence_only');assert.match(phases.join(' '),/retrying automatically/);assert.equal(result.answer,'Checked answer');
});
test('browser stops on user cancellation and does not retry bad credentials',async()=>{
 const stop=new AbortController();let polls=0;
 const api:any=async()=>{if(polls++===0)return{jobId:'j'};stop.abort();return{state:'pending',phase:'checking'};};
 await assert.rejects(runCompanionJob('k',{}, {signal:stop.signal,onJob:()=>{},onProgress:()=>{},pollMs:1},api),{name:'AbortError'});
 let calls=0;await assert.rejects(runCompanionJob('k',{}, {signal:new AbortController().signal,onJob:()=>{},onProgress:()=>{},pollMs:1},(async()=>{if(calls++===0)return{jobId:'j'};throw Object.assign(Error('Wrong key'),{status:401});}) as any),/Wrong key/);assert.equal(calls,2);
});

import {createSpeechInput} from './speechInput';
test('speech completion submits the finished transcript to the job endpoint exactly once',async()=>{
 let engine:any,request:Promise<any>|undefined;const submitted:string[]=[];
 class Recognition {onresult:any;onend:any;onerror:any;constructor(){engine=this;}start(){}stop(){}abort(){}}
 const api:any=async(_key:string,path:string,payload:any)=>{if(path==='/asks'){submitted.push(payload.question);return{jobId:'spoken'};}return{state:'completed',result:{answer:'Received spoken question'}};};
 const mic=createSpeechInput(Recognition,()=>{},()=>{},()=>{},text=>{request=runCompanionJob('k',{question:text},{signal:new AbortController().signal,onJob:()=>{},onProgress:()=>{},pollMs:1},api);});
 mic.start();engine.onresult({results:[Object.assign([{transcript:'is anyone going to visit me'}],{isFinal:true})]});engine.onend();engine.onend();
 assert.equal((await request!).answer,'Received spoken question');assert.deepEqual(submitted,['is anyone going to visit me']);mic.dispose();
});
