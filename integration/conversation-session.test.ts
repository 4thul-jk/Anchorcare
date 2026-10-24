import test from 'node:test';import assert from 'node:assert/strict';
import {ConversationSessions} from './conversation-session';import {ConversationAgent,checkedTurn} from './conversation-agent';
import {MemoryStore} from '../engram-retrieval/src/store.js';import {EngramService} from '../engram-retrieval/src/service.js';
function fixture(failModel=false){
 const store=new MemoryStore();let now=new Date('2026-10-25T12:00:00Z'),calls=0;
 const service=new EngramService(store,{householdId:'h',subjectIds:['p','other'],timezone:'Europe/London',embeddingMode:'auto'},()=>new Date(now));
 const agent=new ConversationAgent(service,async input=>{if(failModel)throw Error('model timeout');return checkedTurn({transcript:'FICTIONAL TEST: I prefer peppermint tea.',intent:'information',question_text:null,items:[{category:'personal',quote:'I prefer peppermint tea.',title:'Tea',activity:'other',outcome:'uncertain',event_time:null}],topics:['tea']},input.transcript);});
 const sessions=new ConversationSessions(service,agent,async()=>{calls++;return {message:'Mock request queued, not confirmed received'};},async(turns,frames)=>'Reported: '+turns.length+' turns. Visible: '+frames.length+' frames. Unknown: activities between frames.');
 return {store,agent,sessions,service,calls:()=>calls,advance:(ms:number)=>{now=new Date(+now+ms);}};
}
test('audio is stored before inference, transcribed and committed with original capture time; retry is scoped',async()=>{
 const f=fixture();await f.sessions.start('p',{session_id:'voice'});
 const saved=await f.agent.captureAudio('p',{session_id:'voice',turn_id:'audio1',audio_base64:'AAAA',mime_type:'audio/wav',audio_consent:true});assert.equal(saved.stored,true);
 f.advance(5000);const turn=await f.agent.turn('p',{session_id:'voice',turn_id:'audio1',capture_id:saved.captureId});assert.equal(+turn.recordedAt,+new Date('2026-10-25T12:00:00Z'));
 const done=await f.agent.commit('p',{id:turn._id});assert.deepEqual(done.mediaIds,[saved.captureId]);assert.equal((await f.store.list('personal_records')).length,1);
 await assert.rejects(f.agent.turn('other',{session_id:'voice',turn_id:'audio1',capture_id:saved.captureId}));
 await assert.rejects(f.agent.captureAudio('p',{session_id:'voice',turn_id:'audio1',audio_base64:'BBBB',mime_type:'audio/wav',audio_consent:true}));
 const failed=fixture(true);const capture=await failed.agent.captureAudio('p',{session_id:'voice',turn_id:'fail',audio_base64:'AAAA',mime_type:'audio/wav',audio_consent:true});await assert.rejects(failed.agent.turn('p',{session_id:'voice',turn_id:'fail',capture_id:capture.captureId}));assert.equal((await failed.agent.media('p',capture.captureId)).bytes.length,3);
});
test('no inactivity contact until 30 minutes plus a delivered check-in and two-minute response window',async()=>{
 const f=fixture();await f.sessions.start('p',{session_id:'monitor',inactivity_consent:true});f.advance(30*60000);await f.sessions.status('p','monitor');await f.sessions.tick();let state=await f.sessions.status('p','monitor');assert.equal(state.checkInState,'pending');assert.equal(f.calls(),0);
 f.advance(5*60000);await f.sessions.status('p','monitor');await f.sessions.tick();assert.equal(f.calls(),0);
 await f.sessions.presented('p','monitor');f.advance(119000);await f.sessions.status('p','monitor');await f.sessions.tick();assert.equal(f.calls(),0);f.advance(1000);await f.sessions.tick();assert.equal(f.calls(),1);await f.sessions.tick();assert.equal(f.calls(),1);
});
test('response, absent consent, paused and disconnected sessions do not escalate',async()=>{
 for(const mode of ['respond','no_consent','pause','disconnect']){
  const f=fixture();await f.sessions.start('p',{session_id:mode,inactivity_consent:mode!=='no_consent'});f.advance(1800000);await f.sessions.status('p',mode);await f.sessions.tick();await f.sessions.presented('p',mode);
  if(mode==='respond')await f.sessions.activity('p',mode);if(mode==='pause')await f.sessions.pause('p',mode);
  f.advance(120001);if(mode!=='disconnect')await f.sessions.status('p',mode);await f.sessions.tick();assert.equal(f.calls(),0,mode);
 }
});
test('snapshots need consent and are scoped; stopping saves a draft report and disables monitoring',async()=>{
 const f=fixture();await f.sessions.start('p',{session_id:'frames',camera_consent:true,inactivity_consent:true});
 const image=Buffer.from('ffd8ffc00011080001000103011100021100031100ffd9','hex').toString('base64');
 await assert.rejects(f.agent.captureSnapshot('p',{session_id:'frames',frame_id:'f1',image_base64:image}));
 const frame=await f.agent.captureSnapshot('p',{session_id:'frames',frame_id:'f1',image_base64:image,camera_consent:true});await assert.rejects(f.agent.media('other',frame.assetId));
 const report=await f.sessions.finish('p','frames');assert.equal(report.reviewStatus,'draft');assert.equal(report.snapshotIds.length,1);assert.equal(report.analysisStatus,'complete');assert.equal((await f.sessions.status('p','frames')).monitorEnabled,false);
 assert.equal((await f.sessions.finish('p','frames'))._id,report._id);assert.equal((await f.store.list('agent_session_reports')).length,1);
});
