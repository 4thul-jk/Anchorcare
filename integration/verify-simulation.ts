import {MongoClient} from 'mongodb';
import 'dotenv/config';import assert from 'node:assert/strict';import {writeFile,mkdir} from 'node:fs/promises';
const base='http://127.0.0.1:'+Number(process.env.PORT||3000)+'/api/simulation';let run='';
async function post(path:string,body:any={}){const res=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(run?{'X-Simulation-Run':run}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});const result=await res.json();assert.equal(res.status,200,result.error);return result;}
try{
 const started=await post('/start');run=started.runId;assert.equal(started.storage,'mongodb');assert.equal(started.database,'engram_alex_simulation');assert.equal(started.isolated,true);assert.match(started.patientId,/^sim_/);
 let state=started;for(const action of ['breakfast','glasses','daughter','garden','reminder','lost','contact'])state=await post('/action',{action});
 assert.equal(state.logs.length,7);assert.equal(state.prompts.length,1);assert.match(state.prompts[0].message,/David Lee/);
 const replay=await post('/action',{action:'breakfast'});assert.equal(replay.logs.length,7);
 for(const action of ['next_day','breakfast2','glasses2','reminder2','album_reminder'])state=await post('/action',{action});
 assert.equal(state.dayNumber,2);assert.equal(state.prompts.length,3);
 const mongo=await new MongoClient(process.env.MONGODB_URI!).connect();
 try{
  const filter={householdId:'engram-simulation',subjectId:started.patientId};
  assert.equal(await mongo.db('engram_alex_simulation').collection('daily_logs').countDocuments(filter),state.logs.length);
  for(const collection of ['daily_logs','episodes','sources','people','personal_records','plans','prompts','prompt_jobs'])assert.equal(await mongo.db(process.env.MONGODB_DATABASE||'engram').collection(collection).countDocuments(filter),0,'Simulation leaked into main '+collection);
 }finally{await mongo.close();}
 const answer=await post('/ask',{question:'Where did I leave my glasses yesterday?'});assert.match(answer.answer,/bookshelf/i);assert.doesNotMatch(answer.answer,/counter/i);assert.ok(answer.citations.length);
 const latest=await post('/ask',{question:'Where are my glasses now?'});assert.match(latest.answer,/counter/i);assert.doesNotMatch(latest.answer,/bookshelf/i);
 const report={passed:true,checkedAt:new Date().toISOString(),storage:started.storage,database:started.database,mainDatabaseIsolationPassed:true,events:state.logs.length,reminders:state.prompts.length,day:state.dayNumber,idempotencyPassed:true,yesterdayAnswer:answer.answer,latestAnswer:latest.answer,answerModes:[answer.mode,latest.mode],sourceCount:answer.citations.length,realContactSent:false};
 await mkdir('tmp',{recursive:true});await writeFile('tmp/simulation-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{if(run)await post('/reset');}
