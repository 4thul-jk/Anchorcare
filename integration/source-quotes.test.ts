import test from 'node:test';
import assert from 'node:assert/strict';
import { checkedSourceQuotes } from './source-quotes';
const context = { sections: { episodes: { status: 'available', records: [{ id: 'e1', evidence: [{ id: 's1', text: 'Sarah cancelled her visit.', inspection_required: false }] }] } } };
function output(quote?: string) { return { status: 'supported', claims: [{ text: 'Sarah is arriving at 4:30.', citations: [{ section: 'episodes', recordId: 'e1', sourceId: 's1', quote }] }] }; }
test('valid identifier with missing or invented quote is rejected', () => {
  assert.equal(checkedSourceQuotes(context, output()).allowed, false);
  assert.equal(checkedSourceQuotes(context, output('Sarah will arrive.')).allowed, false);
});
test('only exact source excerpts are displayed, never the unsupported paraphrase', () => {
  const result = checkedSourceQuotes(context, output('Sarah cancelled her visit.'));
  assert.equal(result.allowed, true); assert.match(result.answer!, /cancelled/);
  assert.doesNotMatch(result.answer!, /4:30/);
});

function visitContext(eventStart='2026-10-24T14:00:00.000Z') {
 return {timezone:'Europe/London',sections:{plans:{status:'available',records:[{_id:'p1',personId:'sarah',kind:'visit',eventStart,reviewStatus:'approved',eventStatus:'planned'}]},personal_records:{status:'available',records:[{_id:'r1',personId:'sarah',person:{name:'Sarah Mercer'},originalText:"Sarah Mercer is Alex's daughter."}]}}};
}
function visitOutput(quote='2026-10-24T14:00:00.000Z') {return {status:'supported',claims:[{text:'Invented model wording',citations:[{section:'plans',recordId:'p1',sourceId:'p1',quote},{section:'personal_records',recordId:'r1',sourceId:'r1',quote:"Sarah Mercer is Alex's daughter."}]}]};}
test('source-only visit fallback is readable, timezone-aware and never claims completion',()=>{
 const result=checkedSourceQuotes(visitContext(),visitOutput());
 assert.equal(result.allowed,true);assert.match(result.answer!,/Sarah Mercer is scheduled to visit/);assert.match(result.answer!,/15:00/);assert.match(result.answer!,/Europe\/London/);assert.match(result.answer!,/not confirmation/);assert.doesNotMatch(result.answer!,/Invented/);
});
test('partial timestamps, cancelled plans and unlinked people cannot create visitor assertions',()=>{
 assert.equal(checkedSourceQuotes(visitContext(),visitOutput('2026')).allowed,false);
 const cancelled=visitContext();cancelled.sections.plans.records[0].eventStatus='cancelled';assert.equal(checkedSourceQuotes(cancelled,visitOutput()).allowed,false);
 const unlinked=visitContext();unlinked.sections.personal_records.records[0].personId='other';assert.doesNotMatch(checkedSourceQuotes(unlinked,visitOutput()).answer!,/Sarah Mercer is scheduled/);
});
test('plan display honours the London daylight saving change',()=>{
 const timestamp='2026-10-25T14:00:00.000Z';assert.match(checkedSourceQuotes(visitContext(timestamp),visitOutput(timestamp)).answer!,/14:00/);
});

import { visitFallback } from './visit-fallback';
test('timed-out visitor generation can use approved fields but never answer about an unrelated person',()=>{
 const context=visitContext();(context.sections.personal_records.records[0].person as any).relationship='daughter';
 assert.match(visitFallback(context,'Who is visiting today?')!.answer!,/Sarah Mercer is scheduled/);
 assert.equal(visitFallback(context,'When is David visiting?'),null);
 assert.equal(visitFallback(context,'Did I take medicine?'),null);
 context.sections.plans.records[0].eventStatus='cancelled';assert.equal(visitFallback(context,'Who is visiting today?'),null);
});

import { quickVisitRequest } from './quick-visit';
test('simple upcoming visit wording gets a read-only schedule shortcut and a readable approved answer',()=>{
 const now=new Date('2026-10-24T10:00:00Z');
 for(const question of ['is anyone going to visit me','Is anyone visiting me today?','Any visits today?','When is Sarah visiting?']){
  assert.deepEqual(quickVisitRequest(question,'Europe/London',now)!.include,['plans','personal_records']);
  assert.match(visitFallback(visitContext(),question)!.answer!,/Sarah Mercer is scheduled to visit/);
 }
 assert.equal(quickVisitRequest('Who visited yesterday?','Europe/London',now),null);
 assert.equal(quickVisitRequest('Did I take my medicine?','Europe/London',now),null);
 assert.equal(visitFallback(visitContext(),'When is David visiting?'),null);
});
