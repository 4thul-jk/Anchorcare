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
  assert.deepEqual(routeQuestion('When is Sarah visiting tomorrow?', 'Europe/London', now).include, ['plans', 'personal_records']);
  assert.deepEqual(routeQuestion('Who is my daughter?', 'Europe/London', now).include, ['personal_records']);
});
test('DST day range and explicit dates are validated, unknown ranges never silently become today', () => {
  const r = routeQuestion('What happened on 2026-10-25?', 'Europe/London', now);
  assert.equal(+new Date(r.time_range.end) - +new Date(r.time_range.start), 25 * 3600000);
  assert.throws(() => routeQuestion('What happened last week?', 'Europe/London', now), (e: any) => e.status === 400);
  assert.throws(() => routeQuestion('What happened 2026-02-31?', 'Europe/London', now), (e: any) => e.status === 400);
});

test('patient name and identity questions retrieve personal records', () => {
  for (const question of ["What is my name?", "What's my name?", "Who am I?", "Can you tell me my name?"]) {
    assert.deepEqual(routeQuestion(question, 'Europe/London', now).include, ['personal_records']);
  }
});

import { immediateSupport, within } from './response-speed';
test('lost or confused requests get immediate support without inventing location or contact', () => {
  for (const q of ['I am lost', "I'm confused"]) assert.match(immediateSupport(q)!, /haven.t contacted anyone/);
  assert.equal(immediateSupport('Where did I leave my glasses?'), null);
  assert.equal(immediateSupport('I lost my glasses'), null);
});
test('provider deadline bounds waiting while successful requests return normally', async () => {
  assert.equal(await within(Promise.resolve('okay'), 100), 'okay');
  await assert.rejects(within(new Promise(() => {}), 5), /deadline/);
});

import { SupportSessions } from './support-session';
test('lost conversation handles location followups, expires and isolates actors', () => {
 const flow = new SupportSessions();
 const first = flow.respond('im lost', null, 'patient1', 0)!;
 const follow = flow.respond('im in gulidford', first.supportSession, 'patient1', 1)!;
 assert.equal(follow.status, 'support'); assert.match(follow.answer, /haven.t verified/);
 assert.equal(follow.caregiverContacted, false);
 assert.equal(flow.respond('Guildford', first.supportSession, 'patient2', 2), null);
 assert.equal(flow.respond('Guildford', first.supportSession, 'patient1', 600002), null);
});
test('memory questions and end-help exit support rather than becoming location claims', () => {
 const flow = new SupportSessions();
 const first=flow.respond('I am lost', null, 'p')!;
 assert.equal(flow.respond('What is my name?', first.supportSession, 'p'), null);
 const second=flow.respond('I am lost', null, 'p')!;
 assert.equal(flow.respond('end help', second.supportSession, 'p')!.supportSession, null);
});

test('upcoming visits retrieve relationship evidence as well as the plan', () => {
 for (const q of ['when is my daughter coming', 'when is my daughtr coming'])
  assert.deepEqual(routeQuestion(q, 'Europe/London', now).include, ['plans', 'personal_records']);
});

test('contact caregiver is a distinct help intent, including repeated requests', () => {
 const flow = new SupportSessions();
 const lost = flow.respond('im lost', null, 'p')!;
 const location = flow.respond('im in gulidford', lost.supportSession, 'p')!;
 const contact = flow.respond('contact my caregiver', location.supportSession, 'p')!;
 assert.match(contact.answer, /can't place a call/);
 assert.doesNotMatch(contact.answer, /shop name/);
 const repeat = flow.respond('contact my caregiver', contact.supportSession, 'p')!;
 assert.notEqual(repeat.answer, contact.answer);
 assert.equal(repeat.caregiverContacted, false);
 const help = flow.respond('yes please', repeat.supportSession, 'p')!;
 assert.match(help.answer, /You can say/);
 assert.match(flow.respond('I cannot use my phone', help.supportSession, 'p')!.answer, /staff member/);
 assert.equal(new SupportSessions().respond('call my caregiver', null, 'p')!.status, 'support');
});

test('present and future visitor questions search scheduled plans, past visits search episodes', () => {
 for (const q of ['who all are visiting me today???','Who is visiting me today?', 'Do I have visitors today?', 'Who is dropping by to see me today?']) {
  const r=routeQuestion(q,'Europe/London',now);
  assert.deepEqual(r.include,['plans','personal_records']);
  assert.deepEqual(r.plan_range,{start:'2026-10-23T23:00:00.000Z',end:'2026-10-24T23:00:00.000Z'});
 }
 for (const q of ['Who visited me today?', 'Who came today?', 'Who was visiting yesterday?'])
  assert.deepEqual(routeQuestion(q,'Europe/London',now).include,['episodes']);
});

test('active lost session cannot intercept a new memory question or a past contact question',()=>{
 const questions=['is anyone visiting me today?','Are there visitors today?','Can you tell me my name?','my name','I cannot remember my name','When did I call my daughter?','Has my daughter visited?','Tell me about Sarah','Do I have visitors today?'];
 for(const q of questions){const flow=new SupportSessions();const initial=flow.respond('I am lost',null,'p')!;assert.equal(flow.respond(q,initial.supportSession,'p'),null,q);}
 const flow=new SupportSessions();const initial=flow.respond('I am lost',null,'p')!;
 assert.equal(flow.respond('I am in Guildford',initial.supportSession,'p')!.status,'support');
 assert.equal(flow.respond('Can you call my caregiver?',initial.supportSession,'p')!.status,'support');
 assert.equal(flow.respond('I cannot use my phone',initial.supportSession,'p')!.status,'support');
});
