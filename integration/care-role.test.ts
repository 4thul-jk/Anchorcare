import {namedPersonQuestion,namedPersonAnswer} from './care-role';
import test from 'node:test';import assert from 'node:assert/strict';
import {careRoleQuestion,careRoleAnswer} from './care-role';
const record={_id:'david',person:{name:'David Lee',relationship:'physiotherapist'},originalText:'David Lee is Alex Mercer’s physiotherapist.'};
const context={sections:{personal_records:{complete:true,status:'available',records:[{_id:'identity',originalText:'Patient is Alex.'},record]}}};
test('care identity lookup separates psychotherapist from physiotherapist and suppresses irrelevant identity',()=>{
 assert.equal(careRoleQuestion('who is my psychotherapist?'),'psychotherapist');
 assert.equal(careRoleQuestion('When did my physiotherapist visit yesterday?'),null);
 const missing=careRoleAnswer(context,'psychotherapist');assert.equal(missing.status,'no_support');assert.match(missing.answer,/Did you mean your physiotherapist/);assert.doesNotMatch(missing.answer,/David/);assert.deepEqual(missing.context.sections.personal_records.records,[]);
 const found=careRoleAnswer(context,'physiotherapist');assert.match(found.answer,/David Lee/);assert.equal(found.context.sections.personal_records.records.length,1);
 const partial=careRoleAnswer({sections:{personal_records:{...context.sections.personal_records,complete:false}}},'physiotherapist');assert.equal(partial.status,'no_support');assert.match(partial.answer,/could not check/);
});

test('short role phrases use identity lookup without swallowing visits or actions',()=>{
 for(const q of ['my physiotherapist','physiotherapist','my physio','tell me about my physiotherapist',"Who's my physiotherapist?",'remind me who my physiotherapist is'])assert.equal(careRoleQuestion(q),'physiotherapist',q);
 for(const q of ['call my physiotherapist','when is my physiotherapist visiting','did my physiotherapist visit yesterday','my physiotherapist told me to change medication'])assert.equal(careRoleQuestion(q),null,q);
 assert.equal(careRoleQuestion('my psychotherapist'),'psychotherapist');
});

test('family questions explain the approved relationship in plain words without an LLM',()=>{
 const person={_id:'sarah',originalText:'Sarah Mercer is Alex Mercer\'s daughter.',person:{name:'Sarah Mercer',relationship:'daughter'}};
 const data={sections:{personal_records:{complete:true,status:'available',records:[person,{_id:'unrelated',originalText:'Alex likes tea.'}]}}};
 for(const question of ['tell me about my daughter','my daughter','who is my daughter?','remind me who my daughter is']){
  const role=careRoleQuestion(question);assert.equal(role,'daughter',question);const result=careRoleAnswer(data,role!);assert.equal(result.answer,'Sarah Mercer is your daughter.');assert.equal(result.context.sections.personal_records.records.length,1);
 }
 assert.equal(careRoleQuestion('when is my daughter visiting?'),null);assert.equal(careRoleQuestion('call my daughter'),null);
 assert.equal(careRoleAnswer({...data,sections:{personal_records:{...data.sections.personal_records,records:[]}}},'daughter').status,'no_support');
});

test('new automatically available relationship reports remain attributed to the user',()=>{
 const data={sections:{personal_records:{complete:true,status:'available',records:[{_id:'new',sourceType:'user_report',originalText:'Maya is my daughter.'}]}}};
 const result=careRoleAnswer(data,'daughter');assert.equal(result.status,'answered');assert.match(result.answer,/You told me/);assert.match(result.answer,/Maya/);assert.equal(result.claims[0].citations[0].recordId,'new');
});


test('named family lookup explains the relationship without appending the patient identity',()=>{
 const context={sections:{personal_records:{complete:true,records:[{_id:'daughter',originalText:'Sarah Mercer is Alex Mercer daughter.',sourceType:'caregiver_report',person:{id:'sarah',name:'Sarah Mercer',relationship:'daughter'}},{_id:'patient',originalText:'Alex Mercer is the patient.'}]}}};
 assert.equal(namedPersonQuestion('tell me who sara is'),'sara');assert.equal(namedPersonAnswer(context,'Sarah')!.answer,'Sarah Mercer is your daughter.');assert.equal(namedPersonAnswer(context,'sara')!.answer,'Did you mean Sarah Mercer, your daughter?');assert.equal(namedPersonAnswer(context,'Sam'),null);
});
