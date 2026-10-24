import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseMemoryTools, validateMemoryTool } from './memory-tools';
const now=new Date('2026-10-24T10:00:00Z');
test('tool arguments are read-only, bounded and calendar dates respect timezone',()=>{
 const r=validateMemoryTool({sections:['plans'],day:'today'},'Who is dropping by today?','Europe/London',now);
 assert.deepEqual(r.include,['plans','personal_records']);
 assert.equal(r.plan_range.start,'2026-10-23T23:00:00.000Z');
 for(const args of [{sections:['plans'],day:'today',patient_id:'other'},{sections:['delete'],day:'none'},{sections:['plans'],day:'2026-02-31'},{sections:['plans'],day:'2030-01-01'}])assert.throws(()=>validateMemoryTool(args,'q','Europe/London',now));
});
test('Gemini function call drives selection and invalid or failed calls fall back',async()=>{
 const ai={interactions:{create:async()=>({steps:[{type:'function_call',name:'retrieve_memory',arguments:{sections:['plans'],day:'today'}}]})}};
 const r=await chooseMemoryTools(ai,'gemini-4-argon','Who is dropping by?','Europe/London',now);
 assert.equal(r.routing.source,'gemini_tool_call');
 const failed=await chooseMemoryTools({interactions:{create:async()=>{throw Error('offline')}}},'m','What is my name?','Europe/London',now);
 assert.equal(failed.routing.source,'deterministic_fallback');assert.deepEqual(failed.request.include,['personal_records']);
 const injection=await chooseMemoryTools({interactions:{create:async()=>({steps:[{type:'function_call',name:'call_caregiver',arguments:{}}]})}},'m','What is my name?','Europe/London',now);
 assert.equal(injection.routing.source,'deterministic_fallback');
});
