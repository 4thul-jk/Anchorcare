import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, answerQuestionFromEvidence, normalizeQuestionTopic } from './caregiverEngine';
import { selectQuotedEvidence } from './groundedAnswer';

test('changed visit record is quoted without inventing original arrival time or location', () => {
  const state = createInitialState();
  state.events = state.events.filter(e => e.id === 'evt_004').map(e => ({ ...e, statement: 'Daughter Sarah cancelled her visit today.' }));
  const result = answerQuestionFromEvidence(state, 'Sarah visit', 'patient');
  assert.match(result.turn.answer, /cancelled/);
  assert.doesNotMatch(result.turn.answer, /4:30|strawberr|safe at home|on her way/);
});
test('unknown food and wrong date do not reuse a generic breakfast answer', () => {
  const state = createInitialState();
  assert.equal(answerQuestionFromEvidence(state, 'Did I have eggs for breakfast?', 'patient').turn.epistemic_basis, 'insufficient_evidence');
  const selected = selectQuotedEvidence(state.events, 'breakfast yesterday', new Date('2026-10-24T12:00:00Z'));
  assert.equal(selected.length, 0);
});
test('medication boundary never inserts a drug, dose or ingestion claim', () => {
  const state = createInitialState(); state.events = [];
  const result = answerQuestionFromEvidence(state, 'Should I take an extra pill?', 'patient');
  assert.doesNotMatch(result.turn.answer, /Lisinopril|10mg|08:45/);
  assert.match(result.turn.answer, /cannot/);
  assert.equal(result.turn.epistemic_basis, 'insufficient_evidence');
});
test('mixed or empty model citations block the answer and proposed action', () => {
  for (const citations of [[], ['E1', 'invented']]) {
    const state = createInitialState(); const before = state.actions.length;
    const result = answerQuestionFromEvidence(state, 'Who visited?', 'patient', {
      answer: 'Invented confident answer', evidence_ids: citations, epistemic_basis: 'observed', has_conflicting_evidence: false, uncertainty: 'certain',
      proposed_action: { action_type: 'create_reminder', summary: 'Do it', target_person_id: state.person.id, parameters: {}, supporting_evidence_ids: ['evt_004'] }
    });
    assert.doesNotMatch(result.turn.answer, /Invented confident/);
    assert.equal(result.turn.epistemic_basis, 'insufficient_evidence');
    assert.equal(result.nextState.actions.length, before);
  }
});
test('valid ID alone cannot expose an unsupported model paraphrase', () => {
  const result = answerQuestionFromEvidence(createInitialState(), 'Who visited?', 'patient', {
    answer: 'Sarah is outside right now.', evidence_ids: ['E3'], epistemic_basis: 'observed', has_conflicting_evidence: false, uncertainty: 'certain'
  });
  assert.doesNotMatch(result.turn.answer, /outside right now/);
  assert.match(result.turn.answer, /saved report/);
});
test('physiotherapist yesterday cannot cite a daughter visit today, even with a valid model ID', () => {
  const state = createInitialState(); const question = 'Did the physical therapist visit me yesterday evening?';
  assert.equal(answerQuestionFromEvidence(state, question, 'patient').turn.epistemic_basis, 'insufficient_evidence');
  const result = answerQuestionFromEvidence(state, question, 'patient', {
    answer: 'Yes, Sarah visited.', evidence_ids: ['E3'], epistemic_basis: 'reported', has_conflicting_evidence: false, uncertainty: 'certain'
  });
  assert.equal(result.turn.epistemic_basis, 'insufficient_evidence');
  assert.deepEqual(result.turn.cited_event_ids, []);
  assert.notEqual(normalizeQuestionTopic(question), normalizeQuestionTopic('When is Sarah visiting?'));
});
