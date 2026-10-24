import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { config } from '../engram-retrieval/src/config.js';
import { localDayKey, shiftDay } from '../engram-retrieval/src/memory-model.js';
const cfg = config(), patient = process.env.ANCHORCARE_PATIENT_ID || cfg.subjectIds[0];
const day = shiftDay(localDayKey(new Date(), cfg.timezone), -1);
const namespace = createHash('sha256').update(`${cfg.householdId}:${patient}`).digest('hex').slice(0, 10);
const scenarioId = `alex_demo_${namespace}_${day.replaceAll('-', '')}`;
const base = process.env.ANCHORCARE_URL || 'http://127.0.0.1:3000';
async function context(input: any) {
  const response = await fetch(base + '/api/engram/memory-context', { method: 'POST', signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', 'X-AnchorCare-Key': process.env.ANCHORCARE_ADMIN_KEY || '' }, body: JSON.stringify(input) });
  if (!response.ok) throw Error('Demo API unavailable');
  return response.json();
}
try {
  for (const [query, suffix] of [['Where were the glasses?', 'glasses'], ['What breakfast was reported?', 'breakfast'], ['Did the physiotherapist visit yesterday evening?', 'physio']]) {
    let found = false;
    for (let i = 0; i < 15; i++) {
      const result = await context({ query, include: ['episodes'] });
      if (result.sections.episodes.records.some((r: any) => r.id === `${scenarioId}_${suffix}`)) { found = true; break; }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    assert.ok(found);
  }
  const draft = await context({ query: 'spare keys blue drawer', include: ['episodes'] });
  assert.equal(draft.sections.episodes.records.some((r: any) => r.id === `${scenarioId}_unreviewed`), false);
  const daily = await context({ query: 'medicine report', include: ['daily_logs'], day, activity: 'medication' });
  assert.ok(daily.sections.daily_logs.records.some((r: any) => r.outcome === 'uncertain' && r.sourceType === 'user_report'));
  const personal = await context({ query: 'Who is Sarah?', include: ['personal_records'] });
  assert.ok(personal.sections.personal_records.records.some((r: any) => r.person?.name === 'Sarah Mercer'));
  assert.equal(JSON.stringify(personal).includes('sarah.mercer@example.invalid'), false);
  console.log(JSON.stringify({ passed: true, verifiedAt: new Date().toISOString(), scenarioId,
    checks: ['glasses_retrievable', 'breakfast_retrievable', 'physiotherapy_retrievable', 'draft_keys_excluded', 'medication_uncertainty_preserved', 'family_profile_retrievable', 'contact_not_exposed'], geminiCalled: false }));
} catch {
  console.error(JSON.stringify({ passed: false, scenarioId, action: 'Run demo:seed-atlas and check running server, Atlas indexes and private access key.' })); process.exitCode = 1;
}
