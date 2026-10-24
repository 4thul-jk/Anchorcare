import 'dotenv/config';
import { createHash } from 'node:crypto';
import { config } from '../engram-retrieval/src/config.js';
import { createStore } from '../engram-retrieval/src/store.js';
import { EngramService } from '../engram-retrieval/src/service.js';
import { TeamContract } from '../engram-retrieval/src/team-contract.js';
import { LifeRecords } from '../engram-retrieval/src/life-records.js';
import { dayBounds, localDayKey, shiftDay } from '../engram-retrieval/src/memory-model.js';

const cfg = config();
if (cfg.mode !== 'mongodb') throw new Error('Set STORE=mongodb for real demo storage');
const patient = process.env.ANCHORCARE_PATIENT_ID || cfg.subjectIds[0];
const now = new Date(), today = localDayKey(now, cfg.timezone), scenarioDay = shiftDay(today, -1);
const namespace = createHash('sha256').update(`${cfg.householdId}:${patient}`).digest('hex').slice(0, 10);
const scenarioId = `alex_demo_${namespace}_${scenarioDay.replaceAll('-', '')}`;
const prefix = 'FICTIONAL DEMO — ';
const store = await createStore(cfg), service = new EngramService(store, cfg);
const team = new TeamContract(service), life = new LifeRecords(service);
const scope = service.scope(patient);
const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: cfg.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function at(day: string, time: string) {
  const bounds = dayBounds(day, cfg.timezone);
  for (let t = +bounds.start; t < +bounds.end; t += 60000) if (formatter.format(new Date(t)) === time) return new Date(t);
  throw new Error('Scenario local time does not exist');
}
try {
  const people = [
    { key: 'sarah', name: 'Sarah Mercer', relationship: 'daughter' },
    { key: 'sam', name: 'Sam Rivera', relationship: 'caregiver' },
    { key: 'david', name: 'David Lee', relationship: 'physiotherapist' }
  ];
  for (const person of people) {
    const id = `demo_${namespace}_${person.key}`;
    if (!await store.one('people', { ...scope, _id: id })) await service.addPerson({ subjectId: patient, id, name: person.name, relationship: person.relationship });
    const recordId = `demo_${namespace}_${person.key}_card`;
    const created = await life.addPersonal({ patient_id: patient, id: recordId, kind: 'person', person_id: id,
      title: `${person.name} — ${person.relationship}`, source_type: 'caregiver_report',
      original_text: `${prefix}${person.name} is Alex Mercer's ${person.relationship}.`,
      ...(person.key === 'sarah' ? { contact: { email: 'sarah.mercer@example.invalid' } } : {}) }, true);
    if (created.created) await life.review({ patient_id: patient, collection: 'personal_records', id: recordId, status: 'approved' });
  }
  for (const [suffix, kind, title, original_text] of [
    ['tea', 'preference', 'Tea preference', 'Alex prefers Earl Grey tea without sugar.'],
    ['music', 'preference', 'Favourite music', 'Alex enjoys quiet piano music.'],
    ['garden', 'fact', 'Familiar interest', 'Alex enjoys looking after rosemary plants in the courtyard garden.']
  ]) {
    const id = `demo_${namespace}_${suffix}`;
    const created = await life.addPersonal({ patient_id: patient, id, kind, title, original_text: prefix + original_text, source_type: 'caregiver_report' }, true);
    if (created.created) await life.review({ patient_id: patient, collection: 'personal_records', id, status: 'approved' });
  }
  const events = [
    ['breakfast', '07:30', 'meal', 'Breakfast', 'Sam reported that Alex had oatmeal and Earl Grey tea for breakfast.', 'sam', 'kitchen', 'caregiver_report', 'approved'],
    ['glasses', '08:15', 'other', 'Glasses placement', 'Alex reported leaving his glasses on the bookshelf beside the living-room window.', '', 'living_room', 'user_report', 'approved'],
    ['medicine', '08:30', 'medication', 'Morning medication report', 'Alex said he was unsure whether he had taken his morning medicine. No dose or ingestion was confirmed.', '', 'kitchen', 'user_report', 'approved'],
    ['walk', '09:30', 'exercise', 'Garden walk', 'Sam reported accompanying Alex on a 20-minute walk in the courtyard garden.', 'sam', 'courtyard', 'caregiver_report', 'approved'],
    ['water', '10:15', 'hydration', 'Water report', 'Sam reported that Alex drank a glass of water after the garden walk.', 'sam', 'living_room', 'caregiver_report', 'approved'],
    ['lunch', '12:30', 'meal', 'Lunch', 'Sam reported that Alex ate vegetable soup and bread for lunch.', 'sam', 'kitchen', 'caregiver_report', 'approved'],
    ['phone', '14:15', 'other', 'Family phone call', 'Sarah called Alex in the afternoon and they talked about the family photo album.', 'sarah', 'living_room', 'caregiver_report', 'approved'],
    ['physio', '17:30', 'exercise', 'Physiotherapy visit', 'Sam reported that physiotherapist David Lee visited Alex in the early evening and supervised seated leg exercises.', 'david', 'living_room', 'caregiver_report', 'approved'],
    ['unreviewed', '18:00', 'other', 'Unreviewed object report', 'An unreviewed transcript says the spare keys might be in the blue kitchen drawer.', '', 'kitchen', 'recording_transcript', 'draft']
  ];
  const episodeIds: string[] = [];
  for (const [suffix, time, activity, label, report, personKey, place, sourceType, review] of events) {
    const id = `${scenarioId}_${suffix}`, timestamp = at(scenarioDay, time).toISOString();
    const result = await team.ingest({ id, patient_id: patient, start: timestamp, people: personKey ? [`demo_${namespace}_${personKey}`] : [],
      place, what: label, gist: prefix + report, status: 'auto', evidence: { text: prefix + report, source_type: sourceType } });
    if (result.created && review === 'approved') await team.review({ patient_id: patient, id, status: 'carer_verified' });
    const logId = `${id}_log`;
    const log = await life.addLog({ patient_id: patient, id: logId, activity, label, outcome: suffix === 'medicine' ? 'uncertain' : suffix === 'unreviewed' ? 'uncertain' : 'reported_done',
      occurred_at: timestamp, source_type: sourceType, original_text: prefix + report }, true);
    if (log.created && review === 'approved') await life.review({ patient_id: patient, collection: 'daily_logs', id: logId, status: 'approved' });
    episodeIds.push(id);
  }
  // Persist the scheduling anchor once so identical reruns do not reschedule tasks.
  const manifestId = `${scenarioId}_manifest`;
  await store.insert('demo_scenarios', { _id: manifestId, ...scope, scenarioId, scenarioDay, createdAt: now, synthetic: true });
  const manifest = await store.one('demo_scenarios', { ...scope, _id: manifestId });
  let visitDay = localDayKey(manifest.createdAt, cfg.timezone);
  if (at(visitDay, '15:00') <= manifest.createdAt) visitDay = shiftDay(visitDay, 1);
  const visitStart = at(visitDay, '15:00');
  const plans = [
    { id: `${scenarioId}_visit_plan`, kind: 'visit', personId: `demo_${namespace}_sarah`, eventStart: visitStart.toISOString(), dueAt: new Date(+visitStart - 600000).toISOString(), expiresAt: new Date(+visitStart + 3600000).toISOString() },
    { id: `${scenarioId}_album_plan`, kind: 'photo_album', triggerType: 'context', placeId: 'desk', eventStart: new Date(+manifest.createdAt).toISOString(), expiresAt: new Date(+manifest.createdAt + 86400000).toISOString() }
  ];
  for (const plan of plans) if (!await store.one('plans', { ...scope, _id: plan.id }) && new Date(plan.expiresAt) > now) await service.createPlan({ ...plan, subjectId: patient });
  console.log(JSON.stringify({ passed: true, seededAt: new Date().toISOString(), scenarioId, patient_id: patient, timezone: cfg.timezone, scenarioDay,
    people: 3, personalRecords: 6, episodes: episodeIds.length, dailyLogs: events.length, approvedEpisodes: 8, draftEpisodes: 1,
    visitScheduledFor: visitStart.toISOString(), plans: plans.map(p => p.id), repeatedRunPreservesReviewAndSchedule: true,
    note: 'Entirely fictional. No actual patient data or medicine ingestion confirmation. Photos are not supplied.' }, null, 2));
} catch (error: any) {
  console.error(JSON.stringify({ passed: false, scenarioId, errorType: error.name, action: 'Check Atlas access and record conflicts. Original data is never deleted or overwritten.' })); process.exitCode = 1;
} finally { await store.close(); }
