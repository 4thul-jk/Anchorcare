import test from 'node:test';
import assert from 'node:assert/strict';
import { config } from '../engram-retrieval/src/config.js';
import { MemoryStore } from '../engram-retrieval/src/store.js';
import { EngramService } from '../engram-retrieval/src/service.js';
import { AtlasLedger } from './ledger';
async function fixture() {
  const cfg = { ...config(), mode: 'memory', subjectIds: ['fixture'], householdId: 'ledger-tests' };
  const store: any = new MemoryStore(), service = new EngramService(store, cfg);
  await service.addSource({ subjectId: 'fixture', id: 's1', sourceType: 'user_report', content: 'I left the compass on the desk.' });
  await service.addEpisode({ subjectId: 'fixture', id: 'e1', sourceIds: ['s1'], summary: 'Compass on desk', reviewStatus: 'approved', eventStart: '2026-10-23T09:00:00Z' });
  return { store, service, ledger: new AtlasLedger(service) };
}
test('ledger reads retain sources and hide drafts/history from companion', async () => {
  const f = await fixture();
  const result = await f.ledger.change('fixture', { id: 'e1', mode: 'correct', statement: 'Compass in drawer', reason: 'Original report was mistaken' });
  assert.equal((await f.ledger.list('fixture', false)).records.length, 0);
  const history = (await f.ledger.list('fixture', true)).records;
  assert.equal(history.length, 2);
  assert.equal(history.find(r => r.id === 'e1')?.supersededBy, result.replacementId);
  const corrected = history.find(r => r.id === result.replacementId)!;
  assert.equal(corrected.supersedes, 'e1'); assert.equal(corrected.reviewStatus, 'draft');
  assert.equal(corrected.sources[0].content, 'Compass in drawer');
  assert.equal(corrected.sources[0].sourceType, 'caregiver_report');
  assert.equal((await f.store.one('sources', { _id: 's1' })).content, 'I left the compass on the desk.');
});
test('retraction preserves evidence and refuses a second change to a historical record', async () => {
  const f = await fixture();
  await f.ledger.change('fixture', { id: 'e1', mode: 'retract', reason: 'Report withdrawn' });
  assert.equal((await f.ledger.list('fixture', false)).records.length, 0);
  assert.equal((await f.ledger.list('fixture', true)).records[0].retractionReason, 'Report withdrawn');
  await assert.rejects(f.ledger.change('fixture', { id: 'e1', mode: 'retract', reason: 'Again' }), (e: any) => e.status === 409);
  await assert.rejects(f.ledger.list('other', true), (e: any) => e.status === 403);
});
test('Mongo path uses one session and rolls back write failure (transaction mock)', async () => {
  const f = await fixture(); const sessions: any[] = [];
  const session: any = { endSession: async () => {}, withTransaction: async (run: any) => {
    const snapshot = structuredClone(f.store.tables);
    try { await run(); } catch (e) { f.store.tables = snapshot; throw e; }
  } };
  f.store.mode = 'mongodb'; f.store.client = { startSession: () => session };
  f.store.db = { collection: (name: string) => ({
    updateOne: async (filter: any, update: any, options: any) => { sessions.push(options.session); return { matchedCount: await f.store.update(name, filter, update.$set) ? 1 : 0 }; },
    insertOne: async (doc: any, options: any) => { sessions.push(options.session); if (name === 'audit_events') throw Error('Injected transaction failure'); await f.store.insert(name, doc); }
  }) };
  await assert.rejects(f.ledger.change('fixture', { id: 'e1', mode: 'correct', statement: 'Compass in drawer', reason: 'Correction' }));
  assert.equal((await f.store.one('episodes', { _id: 'e1' })).isCurrent, true);
  assert.equal((await f.store.list('episodes')).length, 1);
  assert.equal((await f.store.list('sources')).length, 1);
  assert.equal(sessions.length, 4); assert.ok(sessions.every(s => s === session));
});
