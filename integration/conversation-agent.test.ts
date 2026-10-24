import test from 'node:test';import assert from 'node:assert/strict';
import {ConversationAgent,checkedTurn,audioBytes} from './conversation-agent';
import {MemoryStore} from '../engram-retrieval/src/store.js';
import {EngramService} from '../engram-retrieval/src/service.js';
const now=new Date('2026-10-25T12:00:00Z');
function fixture(output:any){const store=new MemoryStore(),service=new EngramService(store,{householdId:'h',subjectIds:['p','other'],timezone:'Europe/London',embeddingMode:'auto'},()=>new Date(now));let calls=0;const agent=new ConversationAgent(service,async input=>{calls++;return checkedTurn(output,input.transcript);});return {store,service,agent,calls:()=>calls};}
const item=(quote:string,category='episode',time:string|null='2026-10-24T09:00:00Z')=>({quote,category,title:'Fictional report',activity:'exercise',outcome:'reported_done',event_time:time});
test('classifier rejects invented quotes and prevents question-to-fact conversion',()=>{
 const base={transcript:'Did I take medicine?',intent:'question',question_text:'Did I take medicine?',topics:['medicine'],items:[]};assert.equal(checkedTurn(base).intent,'question');
 assert.throws(()=>checkedTurn({...base,items:[item('I took medicine')]}));assert.throws(()=>checkedTurn({...base,intent:'information',items:[item('Did I take medicine?')]}));
 assert.throws(()=>checkedTurn({...base,question_text:'Who is Sarah?'}));assert.throws(()=>audioBytes({mime_type:'image/jpeg',audio_base64:'AA=='}));
});
test('ordinary past report is immediately available and idempotent, with original source preserved and foreign scope denied',async()=>{
 const quote='On 2026-10-24 at 10:00 I walked at London Bridge.';const f=fixture({transcript:quote,intent:'information',question_text:null,topics:['walk'],items:[item(quote)]});
 const turn=await f.agent.turn('p',{turn_id:'past_1',transcript:quote});const again=await f.agent.turn('p',{turn_id:'past_1',transcript:quote});assert.equal(turn._id,again._id);assert.equal(f.calls(),1);
 await assert.rejects(f.agent.turn('p',{turn_id:'past_1',transcript:'changed'}));
 const saved=await f.agent.commit('p',{id:turn._id});await f.agent.commit('p',{id:turn._id});const episodes=await f.store.list('episodes');assert.equal(episodes.length,1);assert.equal(episodes[0].reviewStatus,'approved');assert.equal(saved.outputs[0].collection,'episodes');assert.equal((await f.store.list('sources'))[0].content,quote);
 await assert.rejects(f.agent.commit('other',{id:turn._id}));
});
test('missing event time becomes a review proposal instead of a fabricated event',async()=>{
 const quote='I went for a walk.';const f=fixture({intent:'information',question_text:null,topics:['walk'],items:[item(quote)]});const t=await f.agent.turn('p',{turn_id:'unclear',transcript:quote});assert.equal(t.items[0].eventTime,null);const saved=await f.agent.commit('p',{id:t._id});assert.equal(saved.outputs[0].status,'available_report');assert.equal(saved.outputs[0].timeUnconfirmed,true);assert.match((await f.store.list('personal_records'))[0].originalText,/event time is not confirmed/);assert.equal((await f.store.list('episodes')).length,0);
 const p=(await f.store.list('agent_capture_proposals'))[0];await f.agent.resolve('p',{proposal_id:p._id,event_time:'2026-10-24T10:00:00Z'});assert.equal((await f.store.list('episodes'))[0].reviewStatus,'draft');
});
test('personal information and daily activities become available as user reports and preserve negation',async()=>{
 const personal='Sarah is my daughter.';let f=fixture({intent:'information',question_text:null,topics:['family'],items:[item(personal,'personal',null)]});let t=await f.agent.turn('p',{turn_id:'person',transcript:personal});await f.agent.commit('p',{id:t._id});assert.equal((await f.store.list('personal_records'))[0].reviewStatus,'approved');
 const quote='On 2026-10-24 at 10:00 I did not exercise.';f=fixture({intent:'information',question_text:null,topics:['exercise'],items:[item(quote,'daily_activity')]});t=await f.agent.turn('p',{turn_id:'daily',transcript:quote});await f.agent.commit('p',{id:t._id});const log=(await f.store.list('daily_logs'))[0];assert.equal(log.outcome,'reported_not_done');assert.equal(log.reviewStatus,'approved');
});
test('future intentions do not become completed episodes or active reminders without caregiver scheduling',async()=>{
 const quote='Sarah will visit on 2026-10-26 at 10:00.';const f=fixture({intent:'information',question_text:null,topics:['visit'],items:[item(quote,'future_plan','2026-10-26T10:00:00Z')]});const t=await f.agent.turn('p',{turn_id:'future',transcript:quote});await f.agent.commit('p',{id:t._id});assert.equal((await f.store.list('episodes')).length,0);assert.equal((await f.store.list('plans')).length,0);
 const p=(await f.store.list('agent_capture_proposals'))[0];await assert.rejects(f.agent.resolve('p',{proposal_id:p._id,event_time:'2026-10-26T10:00:00Z'}));
 await f.store.insert('people',{_id:'sarah',householdId:'h',subjectId:'p',name:'Sarah',relationship:'daughter'});
 await f.agent.resolve('p',{proposal_id:p._id,event_time:'2026-10-26T10:00:00Z',action:'schedule_visit',confirm:'carer_verified',person_id:'sarah'});assert.equal((await f.store.list('plans'))[0].reviewStatus,'approved');
});
test('question journal and daily consolidation never assert medication was taken',async()=>{
 const quote='Did I take my medicine?';const f=fixture({intent:'question',question_text:quote,topics:['medicine question'],items:[]});const t=await f.agent.turn('p',{turn_id:'question',transcript:quote});await f.agent.commit('p',{id:t._id});assert.equal((await f.store.list('episodes')).length,0);
 await f.agent.answer('p',t._id,{status:'no_support',claims:[]});const result=await f.agent.consolidate('p');assert.equal(result.status,'draft');const log=(await f.store.list('daily_logs'))[0];assert.match(log.originalText,/Question asked: Did I take/);assert.match(log.originalText,/not confirmation/);assert.equal(log.outcome,'uncertain');assert.equal(log.reviewStatus,'draft');await f.agent.consolidate('p');assert.equal((await f.store.list('daily_logs')).length,1);
});
test('raw media retention is consent gated and stays scoped and private',async()=>{
 const quote='Did I eat?';const f=fixture({intent:'question',question_text:quote,topics:['meal question'],items:[]});const t=await f.agent.turn('p',{turn_id:'media',transcript:quote});await assert.rejects(f.agent.commit('p',{id:t._id,audio_base64:'AAAA',mime_type:'audio/wav'}));await assert.rejects(f.agent.commit('p',{id:t._id,image_base64:'AAAA',camera_consent:true}));
 const saved=await f.agent.commit('p',{id:t._id,audio_base64:'AAAA',mime_type:'audio/wav',audio_consent:true});assert.equal(saved.mediaIds.length,1);await assert.rejects(f.agent.media('other',saved.mediaIds[0]));const daily=await f.agent.daily('p');assert.equal('data'in daily.assets[0],false);assert.equal('gridFsId'in daily.assets[0],false);
});

test('camera captures remain private drafts until caregiver links an approved person',async t=>{
 const previous=process.env.COMPANION_PROVIDER;process.env.COMPANION_PROVIDER='ollama';t.after(()=>{if(previous===undefined)delete process.env.COMPANION_PROVIDER;else process.env.COMPANION_PROVIDER=previous;});
 const quote='Sarah is my daughter.';const f=fixture({intent:'information',question_text:null,topics:['family'],items:[item(quote,'personal',null)]});
 const turn=await f.agent.turn('p',{turn_id:'camera',transcript:quote});const jpeg=Buffer.from('ffd8ffc00011080001000103011100021100031100ffd9','hex').toString('base64');
 const saved=await f.agent.commit('p',{id:turn._id,image_base64:jpeg,camera_consent:true});assert.equal(saved.mediaIds.length,1);assert.equal((await f.store.list('memory_images')).length,0);
 await f.store.insert('people',{_id:'sarah',householdId:'h',subjectId:'p',name:'Sarah',relationship:'daughter'});
 await assert.rejects(f.agent.curateImage('p',{asset_id:saved.mediaIds[0],target_type:'person',target_id:'sarah',caption:'Fictional test',confirm:'carer_verified'}));
 await f.store.insert('personal_records',{_id:'approved_sarah',householdId:'h',subjectId:'p',personId:'sarah',originalText:'Sarah is the daughter.',reviewStatus:'approved'});
 await f.agent.curateImage('p',{asset_id:saved.mediaIds[0],target_type:'person',target_id:'sarah',caption:'Fictional test',confirm:'carer_verified'});assert.equal((await f.store.list('memory_images'))[0].reviewStatus,'approved');
});

test('medication assertions remain reviewed reports and low-value filler is not promoted',async()=>{
 const quote='On 2026-10-24 at 10:00 I took my medicine.';const f=fixture({intent:'information',question_text:null,topics:['medication'],items:[{...item(quote,'daily_activity'),activity:'medication'}]});const t=await f.agent.turn('p',{turn_id:'medical',transcript:quote});await f.agent.commit('p',{id:t._id});assert.equal((await f.store.list('daily_logs'))[0].reviewStatus,'draft');
 const filler=checkedTurn({transcript:'Hello.',intent:'information',question_text:null,topics:[],items:[{...item('Hello.','personal',null),memory_worthy:false}]});assert.equal(filler.items.length,0);
});
test('caregiver withdrawal is not undone by retrying a saved turn',async()=>{
 const quote='I prefer peppermint tea.';const f=fixture({intent:'information',question_text:null,topics:['preference'],items:[item(quote,'personal',null)]});const turn=await f.agent.turn('p',{turn_id:'withdraw',transcript:quote});const saved=await f.agent.commit('p',{id:turn._id});const out=saved.outputs[0];assert.equal(out.status,'available_report');
 await f.store.update('personal_records',{_id:out.id},{reviewStatus:'draft',reviewedAt:new Date(now)});await f.agent.commit('p',{id:turn._id});assert.equal((await f.store.one('personal_records',{_id:out.id})).reviewStatus,'draft');
});


test('Gemini introductions save timestamped reported people without overwriting patient identity or guessing a photo',async()=>{
 const quote='This is Priya, my daughter.';const f=fixture({intent:'information',question_text:null,topics:['family'],items:[item(quote,'personal',null)],introductions:[{name:'Priya',relationship:'daughter',quote}]});
 const t=await f.agent.turn('p',{turn_id:'intro',transcript:quote});const saved=await f.agent.commit('p',{id:t._id});await f.agent.commit('p',{id:t._id});
 const reports=await f.store.list('agent_identity_reports');assert.equal(reports.length,1);assert.equal(reports[0].name,'Priya');assert.equal(reports[0].identityVerified,false);assert.equal(reports[0].photoLinked,false);assert.equal(+reports[0].recordedAt,+now);
 const people=await f.store.list('people');assert.equal(people.length,1);assert.equal(people[0].relationship,'daughter');assert.equal((await f.store.list('personal_records')).length,1);assert.match(saved.acknowledgement,/Priya/);
 const self='My name is Priya.';const other=fixture({intent:'information',question_text:null,topics:['introduction'],items:[],introductions:[{name:'Priya',relationship:null,quote:self}]});const a=await other.agent.turn('p',{turn_id:'self',transcript:self});const result=await other.agent.commit('p',{id:a._id});assert.equal((await other.store.list('people')).length,0);assert.match(result.acknowledgement,/How is Priya related/);assert.match((await other.store.list('personal_records'))[0].originalText,/unconfirmed/);
 assert.throws(()=>checkedTurn({transcript:self,intent:'information',question_text:null,topics:[],items:[],introductions:[{name:'Sarah',relationship:'daughter',quote:self}]}));
});


test('a standalone greeting cannot become a personal memory even if Gemini marks it useful',async()=>{
 const f=fixture({intent:'information',question_text:null,topics:['greeting'],items:[item('hello','personal',null)]});const turn=await f.agent.turn('p',{turn_id:'hello',transcript:'hello'});const saved=await f.agent.commit('p',{id:turn._id});assert.equal(saved.memorySaved,false);assert.equal(saved.memoryDecision,'conversation_only');assert.deepEqual(saved.outputs,[]);assert.match(saved.acknowledgement,/Hello! How are you/);assert.equal((await f.store.list('personal_records')).length,0);assert.equal((await f.store.list('episodes')).length,0);assert.equal((await f.agent.consolidate('p')).created,false);
});


test('no speech is not a meaningful memory or daily conversation topic',async()=>{
 const f=fixture({transcript:'[No clear speech]',intent:'unclear',question_text:null,topics:[],items:[]});const t=await f.agent.turn('p',{turn_id:'silence',transcript:'[No clear speech]'});const saved=await f.agent.commit('p',{id:t._id});assert.equal(saved.noSpeech,true);assert.equal(saved.memorySaved,false);assert.equal((await f.agent.consolidate('p')).created,false);
});
