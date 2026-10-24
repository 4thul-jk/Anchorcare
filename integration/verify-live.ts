import 'dotenv/config';
import assert from 'node:assert/strict';
const base = process.env.ANCHORCARE_URL || 'http://127.0.0.1:3000';
const key = process.env.ANCHORCARE_ADMIN_KEY;
if (!key) throw new Error('Configure the private caregiver access key');
async function call(path: string, input?: any) {
  const response = await fetch(base + '/api/engram' + path, { method: input ? 'POST' : 'GET', signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', 'X-AnchorCare-Key': key! }, ...(input ? { body: JSON.stringify(input) } : {}) });
  if (!response.ok) throw new Error(`Integration HTTP ${response.status}`);
  return response.json();
}
const id = `integration_${Date.now()}`;
try {
  const status = await call('/status'); assert.equal(status.mode, 'mongodb');
  const event = { id, start: new Date(Date.now() - 10000).toISOString(), gist: 'A fictional copper sundial was placed by the bookshelf.', people: [], status: 'auto', evidence: { text: 'FICTIONAL INTEGRATION: copper sundial by bookshelf.', source_type: 'caregiver_report' } };
  await call('/episodes', event);
  const input = { query: 'copper sundial', include: ['episodes'] };
  assert.equal((await call('/memory-context', input)).sections.episodes.records.some((r: any) => r.id === id), false);
  await call('/episodes/review', { id, status: 'carer_verified' });
  let context: any;
  for (let i = 0; i < 30; i++) {
    context = await call('/memory-context', input);
    if (context.sections.episodes.records.some((r: any) => r.id === id)) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(context.sections.episodes.records.some((r: any) => r.id === id));
  const correction = await call('/ledger/change', { id, mode: 'correct', statement: 'FICTIONAL: the copper sundial is now reported in the cupboard.', reason: 'Fictional integration correction test' });
  assert.equal(correction.committed, true);
  let history = await call('/ledger');
  assert.equal(history.records.find((r: any) => r.id === id).supersededBy, correction.replacementId);
  assert.equal(history.records.find((r: any) => r.id === correction.replacementId).reviewStatus, 'draft');
  context = await call('/memory-context', input);
  assert.equal(context.sections.episodes.records.some((r: any) => r.id === id || r.id === correction.replacementId), false);
  await call('/episodes/review', { id: correction.replacementId, status: 'carer_verified' });
  for (let i = 0; i < 30; i++) {
    context = await call('/memory-context', input);
    if (context.sections.episodes.records.some((r: any) => r.id === correction.replacementId)) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(context.sections.episodes.records.some((r: any) => r.id === correction.replacementId));
  await call('/ledger/change', { id: correction.replacementId, mode: 'retract', reason: 'Fictional test finished' });
  assert.equal((await call('/memory-context', input)).sections.episodes.records.some((r: any) => r.id === correction.replacementId), false);
  console.log(JSON.stringify({ passed: true, verifiedAt: new Date().toISOString(), storage: status.mode, fixtureId: id,
    checks: ['express_bridge_to_atlas', 'draft_excluded', 'approved_retrieved', 'transactional_correction', 'linked_history', 'replacement_requires_approval', 'approved_replacement_retrieved', 'transactional_retraction'], featuresUsed: context.sections.episodes.featuresUsed, geminiCalled: false }));
} catch {
  console.error(JSON.stringify({ passed: false, fixtureId: id, action: 'Check running backend, private access key and Atlas indexes. Provider details omitted.' })); process.exitCode = 1;
}
