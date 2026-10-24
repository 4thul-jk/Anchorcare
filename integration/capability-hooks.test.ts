import test from 'node:test';
import assert from 'node:assert/strict';
import { CapabilityHooks, capabilityManifest } from './capability-hooks';
import { MemoryStore } from '../engram-retrieval/src/store.js';
import { naturalSupport } from './support-language';
test('future hooks persist scoped retry-safe blocked requests and execute nothing', async () => {
 const store = new MemoryStore();
 const service = {store,scope:(patient:string)=>({householdId:'h',subjectId:patient}),clock:()=>new Date()};
 const hooks = new CapabilityHooks(service);
 const input={kind:'call_caregiver', idempotency_key:'demo-request-1',patient_id:'foreign',phone:'untrusted'};
 const first=await hooks.request('p',input,'patient');
 const again=await hooks.request('p',input,'patient');
 assert.equal(first.requestId,again.requestId); assert.equal(first.executed,false);
 const records=await store.list('integration_requests',{});
 assert.equal(records.length,1); assert.equal(records[0].subjectId,'p');
 assert.equal('phone' in records[0],false); assert.equal(records[0].status,'blocked_not_connected');
 assert.notEqual((await hooks.request('p2',input,'patient')).requestId,first.requestId);
 await assert.rejects(hooks.request('p',{...input,kind:'arbitrary_webhook'},'patient'));
 assert.ok(capabilityManifest().every(c=>!c.available && c.requiresConfirmation));
});
test('Gemini help wording requires bounded text and a separate explicit approval', async () => {
 const mock=(approved:unknown)=>({interactions:{create:async(input:any)=>({output_text:JSON.stringify(input.generation_config.max_output_tokens===400?{answer:'I cannot call anyone from this app. No one has been contacted. Can someone nearby help you use your phone?'}:{approved})})}});
 assert.equal((await naturalSupport(mock(true),'m','call my caregiver','fallback',['im lost'])).responseSource,'gemini_checked');
 for(const approved of [false,'true',null]) assert.deepEqual(await naturalSupport(mock(approved),'m','q','fallback',[]),{answer:'fallback',responseSource:'fallback'});
 assert.equal((await naturalSupport({interactions:{create:async()=>{throw Error('offline')}}},'m','q','fallback',[])).answer,'fallback');
});
