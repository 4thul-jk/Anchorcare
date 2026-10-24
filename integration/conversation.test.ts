import test from 'node:test';
import assert from 'node:assert/strict';
import { conversationalText, verifyConversation } from './conversation';
test('natural text requires bounded supported claims', () => {
  assert.equal(conversationalText({status:'no_support',claims:[{text:'Invented'}]}), null);
  assert.equal(conversationalText({status:'supported',claims:[{text:'Sarah is your daughter.'}]}), 'Sarah is your daughter.');
  assert.equal(conversationalText({status:'supported',claims:[{text:'x'.repeat(701)}]}), null);
});
test('verification accepts only explicit true and fails closed on provider failure', async () => {
  for (const value of [false, 'true', undefined]) assert.equal(await verifyConversation({interactions:{create:async()=>({output_text:JSON.stringify({supported:value})})}}, 'model','q','a','e'), false);
  assert.equal(await verifyConversation({interactions:{create:async()=>{throw Error('offline')}}}, 'model','q','a','e'), false);
  assert.equal(await verifyConversation({interactions:{create:async(input:any)=>{assert.equal(input.store,false);assert.match(input.input,/evidence/);return {output_text:'{"supported":true}'}}}}, 'model','q','a','e'), true);
});

test('day summaries with five source-linked claims remain eligible for natural verification',()=>{
 const claims=Array.from({length:5},(_,i)=>({text:'A short supported sentence '+i+'.',citations:[]}));
 assert.ok(conversationalText({status:'supported',claims}));
 assert.equal(conversationalText({status:'supported',claims:Array.from({length:11},()=>claims[0])}),null);
 assert.equal(conversationalText({status:'supported',claims:Array.from({length:5},()=>({text:'x'.repeat(600)}))}),null);
});
