import test from 'node:test';import assert from 'node:assert/strict';
import {resolveRecallQuery,currentLocationReport,isConversationalRequest,locationWording} from './conversation-context';
import {ConversationAgent,checkedTurn} from './conversation-agent';
import {MemoryStore} from '../engram-retrieval/src/store.js';
import {EngramService} from '../engram-retrieval/src/service.js';
function fixture(){
 const store=new MemoryStore();let now=new Date('2026-10-25T12:00:00Z');
 const service=new EngramService(store,{householdId:'h',subjectIds:['p','other'],timezone:'Europe/London',embeddingMode:'auto'},()=>new Date(now));
 const agent=new ConversationAgent(service,async input=>checkedTurn({intent:'information',question_text:null,items:[],topics:[]},input.transcript));
 async function turn(text:string,session='chat_one',patient='p'){const t=await agent.turn(patient,{turn_id:'t_'+crypto.randomUUID(),session_id:session,transcript:text});return agent.commit(patient,{id:t._id});}
 return {store,service,agent,turn,advance:(ms:number)=>{now=new Date(+now+ms);}};
}
test('requests and pronouns resolve from scoped conversation without inventing contact authority',()=>{
 const history=[{transcript:'I want to see my daughter',recallQuery:'Show me a picture of my daughter'}];
 assert.equal(isConversationalRequest('I need to remember her'),true);
 assert.equal(resolveRecallQuery('I need to remember her',null,history).query,'Tell me about my daughter');
 assert.equal(resolveRecallQuery('tell me more',null,history).query,'Tell me about my daughter');
 assert.equal(resolveRecallQuery('I need to remember her','I need to remember her',[]).unresolved,true);
 assert.equal(resolveRecallQuery('show her',null,[{transcript:'My daughter and sister'}]).unresolved,true);
 assert.equal(resolveRecallQuery('yes','Call my daughter',history).query,'yes');
 assert.equal(resolveRecallQuery('tell me about her','Tell me about my wife',history).query,'Tell me about my daughter');
});
test('only explicit present first-person location becomes a report; no inferred GPS',()=>{
 assert.equal(currentLocationReport('I am in Guildford.'),'Guildford');
 for(const text of ['Am I in Guildford?','I was in Guildford yesterday','I am in Guildford tomorrow','She is at London Bridge','I am not in London'])assert.equal(currentLocationReport(text),null);
 assert.match(locationWording(null,new Date(),'Europe/London'),/Would you like help contacting/);
});
test('location timestamps preserve original reports, prefer latest, filter calendar day and patient scope',async()=>{
 const f=fixture();const first=await f.turn('I am in Guildford.');f.advance(120000);await f.turn('I am at London Bridge.');
 const r:any=await f.agent.locationReply('p','Where am I?',first._id);
 assert.equal(r.lastReportedLocation.location,'London Bridge');assert.equal(+r.lastReportedLocation.reportedAt,+new Date('2026-10-25T12:02:00Z'));
 assert.match(r.answer,/You told me/);assert.match(r.answer,/12:02/);assert.match(r.answer,/can't confirm/);assert.equal(r.locationKnown,false);
 const old:any=await f.agent.locationReply('p','Where was I yesterday?',first._id);assert.equal(old.lastReportedLocation,null);
 const other:any=await f.agent.locationReply('other','Where am I?',null);assert.equal(other.lastReportedLocation,null);
 assert.equal((await f.store.list('agent_location_reports')).length,2);
 assert.equal(+first.recordedAt,+new Date('2026-10-25T12:00:00Z'));assert.match(first.lastAnswer,/remembered/);
});
test('history survives reload, isolates sessions and treats memory requests as questions',async()=>{
 const f=fixture();const t=await f.turn('I want to see my daughter');assert.equal(t.intent,'question');assert.match(t.recallQuery,/picture.*daughter/);
 await f.agent.answer('p',t._id,{status:'support',answer:'Here is your daughter.'});f.advance(1000);
 const follow=await f.turn('I need to remember her');assert.equal(follow.recallQuery,'Tell me about my daughter');
 assert.equal((await f.agent.history('p','chat_one'))[0].lastAnswer,'Here is your daughter.');
 assert.equal((await f.agent.history('other','chat_one')).length,0);
 const isolated=await f.turn('I need to remember her','chat_two');assert.match((await f.agent.contextualReply('p',isolated._id))!.answer,/Who would you like/);
 assert.equal((await f.store.list('personal_records')).length,0);
});
test('contact offer acceptance is single-use, same-session, immediate and time limited',async()=>{
 const f=fixture();const t=await f.turn('Where am I?');const offered:any=await f.agent.locationReply('p','Where am I?',t._id);await f.agent.answer('p',t._id,offered);f.advance(1000);
 const foreign=await f.turn('yes','different');assert.equal(await f.agent.contactDecision('p',foreign._id),null);
 const yes=await f.turn('yes');assert.equal((await f.agent.contactDecision('p',yes._id))!.accepted,true);assert.equal(await f.agent.contactDecision('p',yes._id),null);
 f.advance(1000);const again=await f.turn('Where am I?');await f.agent.answer('p',again._id,await f.agent.locationReply('p','Where am I?',again._id));f.advance(6*60000);
 const late=await f.turn('yes');assert.equal(await f.agent.contactDecision('p',late._id),null);
});


test('care concerns offer human help for statements and questions, preserving explicit single-use consent',async()=>{
 const f=fixture();const report=await f.turn("I am not feeling well");
 assert.equal(report.careAssistance.level,'caregiver');assert.match(report.acknowledgement,/caretaker/);assert.match(report.acknowledgement,/haven't contacted/);
 assert.ok(report.contactOfferId);assert.equal((await f.store.list('mobile_sos')).length,0);
 f.advance(1000);const yes=await f.turn('yes please');assert.equal((await f.agent.contactDecision('p',yes._id))!.accepted,true);
 assert.equal(await f.agent.contactDecision('p',yes._id),null);
 const urgent=await f.turn("I can't breathe",'urgent_chat');assert.equal(urgent.careAssistance.level,'urgent');assert.match(urgent.acknowledgement,/emergency services now/);
 const normal=await f.turn('I want to see my daughter','normal_chat');assert.equal(normal.careAssistance.level,'none');assert.equal(normal.contactOfferId,null);
});
test('Gemini care flags require current-turn evidence and cannot create a contact action',async()=>{
 const base={transcript:'Can someone help me? I feel very unsteady.',intent:'question',question_text:'Can someone help me?',items:[],topics:[]};
 const result=checkedTurn({...base,care_assistance:{level:'caregiver',quote:'I feel very unsteady.'}});assert.equal(result.careAssistance.level,'caregiver');
 assert.throws(()=>checkedTurn({...base,care_assistance:{level:'urgent',quote:'I have chest pain'}}));
 const f=fixture();await f.turn('If I cannot breathe tomorrow what happens?');assert.equal((await f.store.list('agent_contact_offers')).length,0);
});


test('daughter appearance and short name-and-image follow-ups stay on the pictured person',()=>{
 const first=resolveRecallQuery('i need to know how my daughter looks',null,[]);assert.equal(first.query,'Show me a picture of my daughter');
 const next=resolveRecallQuery('maybe the name and image',null,[{transcript:'i need to know how my daughter looks',recallQuery:first.query}]);assert.equal(next.query,'Show me a picture of my daughter');
});
