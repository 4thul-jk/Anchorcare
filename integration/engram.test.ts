import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mountEngram } from './engram';

test('mounted memory service enforces server-side roles/scope and persists source-backed context', async t => {
  Object.assign(process.env, { STORE: 'memory', SUBJECT_IDS: 'demo-person-001', HOUSEHOLD_ID: 'integration-test',
    ANCHORCARE_PATIENT_ID: 'demo-person-001', ANCHORCARE_ADMIN_KEY: 'test-caregiver-key', ANCHORCARE_COMPANION_KEY: 'test-patient-key',
    RUN_WORKER: 'false', GEMINI_API_KEY: '', GOOGLE_API_KEY: '', COMPANION_PROVIDER:'gemini', OPENROUTER_API_KEY:'' });
  const app = express(); app.use(express.json());
  const backend = await mountEngram(app);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await backend.close(); });
  const base = `http://127.0.0.1:${(server.address() as any).port}/api/engram`;
  async function call(path: string, payload?: any, key = 'test-caregiver-key') {
    return fetch(base + path, { method: payload === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AnchorCare-Key': key }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
  }
  assert.equal((await call('/status', undefined, 'wrong')).status, 401);
  assert.equal((await call('/memory-context',{query:'x',person_id:{$ne:null}},'test-patient-key')).status,400);
  assert.equal((await call('/ask',[],'test-patient-key')).status,400);

  const capabilities = await (await call('/capabilities', undefined, 'test-patient-key')).json();
  assert.equal(capabilities.capabilities.length, 3);
  assert.equal(capabilities.mobile.devices,undefined);assert.equal(capabilities.mobile.voiceProviderConfigured,undefined);
  const hook = await (await call('/integration-requests', {kind:'message_caregiver', idempotency_key:'api-test-request',patient_id:'foreign'}, 'test-patient-key')).json();
  assert.equal(hook.executed,false); assert.equal(hook.status,'blocked_not_connected');
  assert.equal((await call('/integration-requests', {kind:'message_caregiver',idempotency_key:'another-test'},'wrong')).status,401);
  const status = await (await call('/status')).json();
  assert.equal(status.patient_id, 'demo-person-001'); assert.equal(status.mode, 'memory');
  assert.equal((await call('/admin/medication-review',undefined,'test-patient-key')).status,403);
  const medInput={id:'api_medication',label:'FICTIONAL check',care_plan_ref:'DEMO-001',scheduled_at:new Date(Date.now()+60000).toISOString()};
  assert.equal((await call('/admin/medication-plans',medInput,'test-patient-key')).status,403);
  assert.equal((await call('/admin/medication-plans',medInput)).status,200);
  assert.equal((await call('/admin/medication-plans/approve',{plan_id:medInput.id})).status,400);
  assert.equal((await call('/admin/medication-plans/approve',{plan_id:medInput.id,status:'carer_verified'})).status,200);
  const medReview=await(await call('/admin/medication-review')).json();assert.equal(medReview.records[0].plan.reviewStatus,'approved');
  assert.equal((await call('/asks',{question:''},'test-patient-key')).status,400);
  const asyncStart=await(await call('/asks',{question:'What is my name?'},'test-patient-key')).json();
  assert.ok(asyncStart.jobId);
  assert.equal((await call('/asks/'+asyncStart.jobId,undefined,'test-caregiver-key')).status,404);
  let snapshot:any;for(let attempt=0;attempt<20;attempt++){snapshot=await(await call('/asks/'+asyncStart.jobId,undefined,'test-patient-key')).json();if(snapshot.state!=='pending')break;await new Promise(r=>setTimeout(r,5));}
  assert.equal(snapshot.state,'completed');assert.equal(snapshot.result.status,'no_support');
  assert.equal((await call('/asks/'+asyncStart.jobId+'/cancel',{},'test-patient-key')).status,200);
  await call('/admin/people',{id:'fast_sarah',name:'Sarah Example',relationship:'daughter'});
  await call('/admin/personal-records',{id:'fast_sarah_card',kind:'person',person_id:'fast_sarah',title:'Sarah - daughter',original_text:'Sarah Example is the patient daughter.',source_type:'caregiver_report'});
  await call('/admin/life-records/review',{collection:'personal_records',id:'fast_sarah_card',status:'approved'});
  await call('/plans',{id:'fast_visit',kind:'visit',status:'carer_verified',person_id:'fast_sarah',event_start:new Date(Date.now()+120000).toISOString(),due_at:new Date(Date.now()+60000).toISOString(),expires_at:new Date(Date.now()+600000).toISOString()});
  const quickJob=await(await call('/asks',{question:'is anyone going to visit me'},'test-patient-key')).json();
  let quickReply:any;for(let i=0;i<30;i++){quickReply=await(await call('/asks/'+quickJob.jobId,undefined,'test-patient-key')).json();if(quickReply.result?.status==='answered'||quickReply.interim?.status==='answered')break;await new Promise(r=>setTimeout(r,5));}
  const quickAnswer=quickReply.result||quickReply.interim;
  assert.match(quickAnswer.answer,/Sarah Example is scheduled to visit/);
  assert.equal(quickAnswer.context.sections.episodes,undefined);
  assert.equal(quickAnswer.context.routing.source,'approved_schedule_shortcut');
  const imageBody={target_type:'person',target_id:'fast_sarah',caption:'FICTIONAL Sarah picture',content_type:'image/png',image_base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='};
  assert.equal((await call('/admin/images',imageBody,'test-patient-key')).status,403);
  const uploaded=await(await call('/admin/images',imageBody)).json();
  assert.equal((await call('/images/'+uploaded.image._id+'/content',undefined,'test-patient-key')).status,404);
  await call('/admin/images/review',{image_id:uploaded.image._id,status:'approved'});
  const picture=await call('/images/'+uploaded.image._id+'/content',undefined,'test-patient-key');assert.equal(picture.status,200);assert.match(picture.headers.get('content-type')!,/image\/png/);assert.ok((await picture.arrayBuffer()).byteLength>0);
  const recalled=await(await call('/recall-images',{question:'Who is Sarah?',patient_id:'foreign'},'test-patient-key')).json();assert.equal(recalled.images.length,1);assert.equal(recalled.images[0].personName,'Sarah Example');
  await call('/admin/images/review',{image_id:uploaded.image._id,status:'draft'});
  assert.equal((await(await call('/recall-images',{question:'Who is Sarah?'},'test-patient-key')).json()).images.length,0);
  assert.equal((await call('/admin/mobile',undefined,'test-patient-key')).status,403);
  await call('/admin/mobile/policy',{allowImages:true,allowSos:true,autoSosOnLost:false,liveCalls:false});
  const pairCode=await(await call('/admin/mobile/pairing',{role:'patient',label:'API phone'})).json();
  const pairResponse=await fetch(base+'/mobile/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:pairCode.code})});const paired=await pairResponse.json();assert.equal(pairResponse.status,200);
  const phoneHeaders={'Content-Type':'application/json','X-Device-Token':paired.deviceToken};
  assert.equal((await fetch(base+'/mobile/inbox',{headers:phoneHeaders})).status,200);
  assert.equal((await fetch(base+'/status',{headers:phoneHeaders})).status,401);
  await call('/admin/mobile/revoke',{device_id:paired.device._id});assert.equal((await fetch(base+'/mobile/inbox',{headers:phoneHeaders})).status,401);
  const input = { id: 'bridge1' , patient_id: 'foreign-patient', start: new Date(Date.now() - 10000).toISOString(),
    gist: 'The brass compass was put on the desk.', people: [], status: 'auto', evidence: { text: 'FICTIONAL: brass compass on desk.', source_type: 'caregiver_report' } };
  assert.equal((await call('/episodes', input, 'test-patient-key')).status, 403);
  assert.equal((await call('/episodes', input)).status, 200);
  let response = await (await call('/memory-context', { patient_id: 'foreign-patient', query: 'brass compass', include: ['episodes'] }, 'test-patient-key')).json();
  assert.equal(response.patient_id, 'demo-person-001'); assert.equal(response.sections.episodes.records.length, 0);
  await call('/episodes/review', { id: 'bridge1', status: 'carer_verified' });
  response = await (await call('/answer', { query: 'brass compass', include: ['episodes'] }, 'test-patient-key')).json();
  assert.equal(response.status, 'evidence_only'); assert.equal(response.context.sections.episodes.records.length, 1);
  assert.equal(response.context.sections.episodes.records[0].evidence[0].text, input.evidence.text);
  const lost = await (await call('/ask',{question:'I am lost'},'test-patient-key')).json();
  assert.equal(lost.status,'support');
  const switchQuestion=await(await call('/ask',{question:'is anyone visiting me today?',supportSession:lost.supportSession},'test-patient-key')).json();
  assert.notEqual(switchQuestion.status,'support');
  assert.ok(switchQuestion.context.sections.plans);
  assert.doesNotMatch(switchQuestion.answer || '', /shop name|street sign/);
  const asked = await (await call('/ask', { question: 'Where was the brass compass?', formattedContextLines: ['invented browser evidence'] }, 'test-patient-key')).json();
  assert.equal(asked.status, 'evidence_only');
  assert.equal(asked.context.sections.episodes.records[0].evidence[0].text, input.evidence.text);
  assert.equal(JSON.stringify(asked).includes('invented browser evidence'), false);
  assert.equal((await call('/ledger/change', { id: 'bridge1', mode: 'retract', reason: 'Test' }, 'test-patient-key')).status, 403);
  assert.equal((await (await call('/ledger', undefined, 'test-patient-key')).json()).records.length, 1);
  const recalledJob=await(await call('/asks',{question:'Where was the brass compass?'},'test-patient-key')).json();
  let beforeWithdrawal:any;for(let i=0;i<30;i++){beforeWithdrawal=await(await call('/asks/'+recalledJob.jobId,undefined,'test-patient-key')).json();if(beforeWithdrawal.state==='completed')break;await new Promise(r=>setTimeout(r,5));}
  assert.equal(beforeWithdrawal.result.context.sections.episodes.records.length,1);
  await call('/episodes/review', { id: 'bridge1', status: 'auto' });
  const afterWithdrawal=await(await call('/asks/'+recalledJob.jobId,undefined,'test-patient-key')).json();
  assert.equal(afterWithdrawal.result.context.sections.episodes.records.length,0);

  response = await (await call('/memory-context', { query: 'brass compass', include: ['episodes'] })).json();
  assert.equal(response.sections.episodes.records.length, 0);
  assert.equal((await call('/not-a-tool', {})).status, 404);
  const cross = await fetch(base + '/status', { headers: { 'X-AnchorCare-Key': 'test-caregiver-key', Origin: 'https://untrusted.example' } });
  assert.equal(cross.status, 403);
});
