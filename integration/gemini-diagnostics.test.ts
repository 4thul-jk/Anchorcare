import test from 'node:test';import assert from 'node:assert/strict';
import {managedGemini} from './gemini-manager';
import {modelDiagnostics,providerReason} from './gemini-diagnostics';
test('billing rejection opens a circuit, has no repeated provider calls and logs no sensitive payload',async()=>{
 const model='billing-test-model';let calls=0;
 const ai=managedGemini({interactions:{create:async()=>{calls++;throw Object.assign(Error('monthly spending cap secret-prompt'),{status:429});}}});
 await assert.rejects(ai.interactions.create({model,input:'private question'}));
 await assert.rejects(ai.interactions.create({model,input:'private followup'}));assert.equal(calls,1);
 const d=modelDiagnostics(model);assert.equal(d.providerStatus,'billing_limit');assert.equal(d.recent.at(-1)?.httpStatus,429);assert.doesNotMatch(JSON.stringify(d),/private question|secret-prompt/);
 assert.equal(providerReason({name:'TimeoutError'}).reason,'timeout');
});
test('successful provider model receipt is separate from requested configuration',async()=>{
 const model='requested-test';const ai=managedGemini({interactions:{create:async()=>({model:'returned-test',output_text:'ready'})}});
 await ai.interactions.create({model});const last=modelDiagnostics(model).recent.at(-1)!;assert.equal(last.requestedModel,model);assert.equal(last.returnedModel,'returned-test');assert.equal(last.outcome,'response_received');
});
