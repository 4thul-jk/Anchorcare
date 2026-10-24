import test from 'node:test';
import assert from 'node:assert/strict';
import { routeQuestion } from './question-routing';
const now = new Date('2026-10-24T12:00:00Z');
test('past physiotherapist questions select yesterday episodes, not plans', () => {
  const r = routeQuestion('When did the physiotherapist visit yesterday?', 'Europe/London', now);
  assert.deepEqual(r.include, ['episodes']);
  assert.deepEqual(r.time_range, { start: '2026-10-22T23:00:00.000Z', end: '2026-10-23T23:00:00.000Z' });
});
test('daily medication reports preserve a day and activity selector', () => {
  const r = routeQuestion('Did I take my medicine yesterday?', 'Europe/London', now);
  assert.deepEqual(r.include, ['daily_logs']); assert.equal(r.day, '2026-10-23'); assert.equal(r.activity, 'medication');
});
test('future appointments and identity use separate stores', () => {
  assert.deepEqual(routeQuestion('When is Sarah visiting tomorrow?', 'Europe/London', now).include, ['plans']);
  assert.deepEqual(routeQuestion('Who is my daughter?', 'Europe/London', now).include, ['personal_records']);
});
test('DST day range and explicit dates are validated, unknown ranges never silently become today', () => {
  const r = routeQuestion('What happened on 2026-10-25?', 'Europe/London', now);
  assert.equal(+new Date(r.time_range.end) - +new Date(r.time_range.start), 25 * 3600000);
  assert.throws(() => routeQuestion('What happened last week?', 'Europe/London', now), (e: any) => e.status === 400);
  assert.throws(() => routeQuestion('What happened 2026-02-31?', 'Europe/London', now), (e: any) => e.status === 400);
});
