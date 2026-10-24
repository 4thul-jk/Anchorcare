import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { mountEngram } from './engram';

test('mounted memory service enforces server-side roles/scope and persists source-backed context', async t => {
  Object.assign(process.env, { STORE: 'memory', SUBJECT_IDS: 'demo-person-001', HOUSEHOLD_ID: 'integration-test',
    ANCHORCARE_PATIENT_ID: 'demo-person-001', ANCHORCARE_ADMIN_KEY: 'test-caregiver-key', ANCHORCARE_COMPANION_KEY: 'test-patient-key',
    RUN_WORKER: 'false', GEMINI_API_KEY: '', GOOGLE_API_KEY: '' });
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
  const status = await (await call('/status')).json();
  assert.equal(status.patient_id, 'demo-person-001'); assert.equal(status.mode, 'memory');
  const input = { id: 'bridge1', patient_id: 'foreign-patient', start: new Date(Date.now() - 10000).toISOString(),
    gist: 'The brass compass was put on the desk.', people: [], status: 'auto', evidence: { text: 'FICTIONAL: brass compass on desk.', source_type: 'caregiver_report' } };
  assert.equal((await call('/episodes', input, 'test-patient-key')).status, 403);
  assert.equal((await call('/episodes', input)).status, 200);
  let response = await (await call('/memory-context', { patient_id: 'foreign-patient', query: 'brass compass', include: ['episodes'] }, 'test-patient-key')).json();
  assert.equal(response.patient_id, 'demo-person-001'); assert.equal(response.sections.episodes.records.length, 0);
  await call('/episodes/review', { id: 'bridge1', status: 'carer_verified' });
  response = await (await call('/answer', { query: 'brass compass', include: ['episodes'] }, 'test-patient-key')).json();
  assert.equal(response.status, 'evidence_only'); assert.equal(response.context.sections.episodes.records.length, 1);
  assert.equal(response.context.sections.episodes.records[0].evidence[0].text, input.evidence.text);
  assert.equal((await call('/ledger/change', { id: 'bridge1', mode: 'retract', reason: 'Test' }, 'test-patient-key')).status, 403);
  assert.equal((await (await call('/ledger', undefined, 'test-patient-key')).json()).records.length, 1);
  await call('/episodes/review', { id: 'bridge1', status: 'auto' });
  response = await (await call('/memory-context', { query: 'brass compass', include: ['episodes'] })).json();
  assert.equal(response.sections.episodes.records.length, 0);
  assert.equal((await call('/not-a-tool', {})).status, 404);
  const cross = await fetch(base + '/status', { headers: { 'X-AnchorCare-Key': 'test-caregiver-key', Origin: 'https://untrusted.example' } });
  assert.equal(cross.status, 403);
});
