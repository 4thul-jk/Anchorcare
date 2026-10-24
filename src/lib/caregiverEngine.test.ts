import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  buildPromptAliases,
  validateAndResolveCitations,
  recordEventWithAudit,
  correctOrRetractEvent,
  proposeAndProcessAction,
  approveAndExecuteAction,
  answerQuestionFromEvidence,
  runRoutineAnomalyWatchdog,
  ExecutionPolicy,
  evaluateActionPolicy,
} from './caregiverEngine';

test('1. Prompt alias mapping assigns [E1..En] and validates/rejects unknown evidence IDs', () => {
  const state = createInitialState();
  const activeEvents = state.events.filter((e) => e.status === 'active');
  const aliasMap = buildPromptAliases(activeEvents);

  assert.equal(Object.keys(aliasMap.aliasToEventId).length, activeEvents.length);
  assert.equal(aliasMap.aliasToEventId['E1'], 'evt_006');

  const check = validateAndResolveCitations(
    ['E1', 'evt_004', 'E999', 'hallucinated_id_123'],
    aliasMap,
    activeEvents
  );

  assert.deepEqual(check.validEventIds, ['evt_006', 'evt_004']);
  assert.deepEqual(check.rejectedCitations, ['E999', 'hallucinated_id_123']);
});

test('2. Autonomous Contradiction Auditor detects conflicting meal reports and auto-executes flag_memory_conflict', () => {
  const state = createInitialState();
  const result = recordEventWithAudit(
    state,
    {
      event_type: 'meal_hydration',
      statement: 'Alex refused lunch today and had nothing to eat at 12:30 PM.',
      occurred_at: '2026-10-24T12:40:00Z',
    },
    'caregiver'
  );

  // Should conflict with evt_005 (Alex ate half a warm turkey sandwich...)
  assert.equal(result.conflictsDetected.includes('evt_005'), true);
  assert.equal(result.createdEvent.conflict_with_ids.includes('evt_005'), true);

  // Tier 1 Autonomous action should be automatically created and verified
  const latestAction = result.nextState.actions[0];
  assert.equal(latestAction.action_type, 'flag_memory_conflict');
  assert.equal(latestAction.status, 'verified');
});

test('3. Patient role safety boundary downgrades event entries to patient_self_report and reported status', () => {
  const state = createInitialState();
  const result = recordEventWithAudit(
    state,
    {
      event_type: 'mood_observation',
      statement: 'I feel a bit tired this afternoon.',
      epistemic_status: 'observed', // Attempted override
      confidence: 1.0,
    },
    'patient'
  );

  assert.equal(result.createdEvent.source.type, 'patient_self_report');
  assert.equal(result.createdEvent.epistemic_status, 'reported');
  assert.equal(result.createdEvent.confidence, 0.7);
});

test('4. Atomic memory correction marks old event superseded and links replacement without losing history', () => {
  const state = createInitialState();
  // Patient cannot correct records
  const denied = correctOrRetractEvent(
    state,
    'evt_005',
    { mode: 'correct', newStatement: 'Alex had pasta.', reason: 'Patient edit' },
    'patient'
  );
  assert.ok(denied.error);

  // Caregiver atomic correction
  const corrected = correctOrRetractEvent(
    state,
    'evt_005',
    {
      mode: 'correct',
      newStatement: 'Alex ate a full warm turkey sandwich and soup for lunch.',
      reason: 'Updated portion size from half to full sandwich.',
    },
    'caregiver'
  );

  assert.equal(corrected.error, undefined);
  assert.ok(corrected.newEvent);

  const oldRecord = corrected.nextState.events.find((e) => e.id === 'evt_005');
  assert.equal(oldRecord?.status, 'superseded');
  assert.equal(oldRecord?.superseded_by, corrected.newEvent?.id);
  assert.equal(corrected.newEvent?.supersedes, 'evt_005');
  assert.equal(corrected.newEvent?.status, 'active');
});

test('5. 3-Tier Policy Gate blocks prohibited actions, stages approvals, and deduplicates retries via idempotency key', () => {
  const state = createInitialState();

  assert.equal(evaluateActionPolicy('change_medication_dose'), ExecutionPolicy.PROHIBITED);
  assert.equal(evaluateActionPolicy('create_reminder'), ExecutionPolicy.REQUIRE_APPROVAL);
  assert.equal(evaluateActionPolicy('show_orientation_card'), ExecutionPolicy.AUTO_EXECUTE);

  // Prohibited action is deterministically blocked
  const prohibitedRes = proposeAndProcessAction(state, {
    action_type: 'unlock_door',
    summary: 'Unlock front residence door remotely',
    target_person_id: state.person.id,
    parameters: { door: 'front_main' },
    supporting_evidence_ids: ['evt_003'],
  });
  assert.equal(prohibitedRes.actionRecord.status, 'blocked_policy');

  // Idempotency prevents duplicate side effects on retry
  const reminderProposal = {
    action_type: 'create_reminder' as const,
    summary: 'Remind Alex about afternoon garden check at 3:30 PM',
    target_person_id: state.person.id,
    parameters: { time: '15:30' },
    supporting_evidence_ids: ['evt_003'],
  };
  const firstTry = proposeAndProcessAction(prohibitedRes.nextState, reminderProposal);
  const secondTry = proposeAndProcessAction(firstTry.nextState, reminderProposal);

  assert.equal(firstTry.wasDuplicate, false);
  assert.equal(secondTry.wasDuplicate, true);
  assert.equal(firstTry.actionRecord.id, secondTry.actionRecord.id);
});

test('6. TOCTOU protection blocks approval if supporting evidence was retracted after proposal', () => {
  const state = createInitialState();
  // act_003 depends on evt_004. Retract evt_004 first:
  const afterRetract = correctOrRetractEvent(
    state,
    'evt_004',
    { mode: 'retract', reason: 'Sarah called back to reschedule visit.' },
    'caregiver'
  );

  // Now attempt to approve act_003:
  const approvalAttempt = approveAndExecuteAction(
    afterRetract.nextState,
    'act_003',
    'caregiver'
  );

  assert.ok(approvalAttempt.error?.includes('TOCTOU Safety Block'));
  const updatedAction = approvalAttempt.nextState.actions.find((a) => a.id === 'act_003');
  assert.equal(updatedAction?.status, 'blocked_toctou');
});

test('7. Repetitive-question loop detector triggers reassurance mode and autonomous caregiver alert on 3rd repetition', () => {
  let state = createInitialState();

  const q1 = answerQuestionFromEvidence(state, 'When is Sarah visiting today?', 'patient');
  state = q1.nextState;
  assert.equal(q1.turn.repetitive_loop_count, 1);
  assert.equal(q1.turn.is_reassurance_mode, false);

  const q2 = answerQuestionFromEvidence(state, 'What time will my daughter Sarah visit?', 'patient');
  state = q2.nextState;
  assert.equal(q2.turn.repetitive_loop_count, 2);
  assert.equal(q2.turn.is_reassurance_mode, false);

  const q3 = answerQuestionFromEvidence(state, 'Is Sarah coming to visit me?', 'patient');
  state = q3.nextState;
  assert.equal(q3.turn.repetitive_loop_count, 3);
  assert.equal(q3.turn.is_reassurance_mode, true);

  // Verify autonomous alert_caregiver_loop_detected action was executed
  const loopAction = state.actions.find((a) => a.action_type === 'alert_caregiver_loop_detected');
  assert.ok(loopAction);
  assert.equal(loopAction?.status, 'verified');
});

test('8. Routine Anomaly Watchdog flags missing evidence when expected routine is past due', () => {
  const state = createInitialState();
  const alerts = runRoutineAnomalyWatchdog(state, 15); // 15:00 UTC
  const missingSafetyCheck = alerts.find((a) => a.fact_id === 'fact_005');
  assert.equal(missingSafetyCheck?.status, 'missing_evidence');
});
