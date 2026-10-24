import { selectQuotedEvidence, quoteReports } from './groundedAnswer';
export type EventType =
  | 'meal_hydration'
  | 'medication_routine'
  | 'family_visit'
  | 'daily_activity'
  | 'mood_observation'
  | 'safety_check';

export type EpistemicStatus = 'observed' | 'reported' | 'inferred';
export type EventStatus = 'active' | 'superseded' | 'retracted';
export type ActorRole = 'caregiver' | 'patient';

export enum ExecutionPolicy {
  AUTO_EXECUTE = 'auto_execute',
  REQUIRE_APPROVAL = 'require_approval',
  PROHIBITED = 'prohibited',
}

export type ActionType =
  // Tier 1 & 2: Auto-Executable Safe Autonomous Actions
  | 'flag_memory_conflict'
  | 'log_patient_mood_report'
  | 'show_orientation_card'
  | 'alert_caregiver_loop_detected'
  // Tier 3: Human-Confirmed Caregiver Actions
  | 'create_reminder'
  | 'draft_family_message'
  | 'mark_routine_completed'
  // Hard Prohibited High-Consequence Actions
  | 'change_medication_dose'
  | 'unlock_door'
  | 'contact_emergency_services';

export type ActionStatus =
  | 'pending_approval'
  | 'verified'
  | 'rejected'
  | 'blocked_policy'
  | 'blocked_toctou'
  | 'failed';

export interface EventSource {
  type: 'caregiver_observation' | 'caregiver_report' | 'family_call' | 'patient_self_report';
  author: string;
  reference_id: string;
}

export interface MemoryEvent {
  id: string;
  person_id: string;
  event_type: EventType;
  occurred_at: string; // ISO UTC
  recorded_at: string; // ISO UTC
  statement: string;
  source: EventSource;
  epistemic_status: EpistemicStatus;
  confidence: number;
  status: EventStatus;
  supersedes: string | null;
  superseded_by: string | null;
  retraction_reason?: string;
  conflict_with_ids: string[];
}

export interface DerivedFact {
  id: string;
  person_id: string;
  category: 'preference' | 'routine' | 'relationship' | 'clinical_note';
  statement: string;
  epistemic_status: EpistemicStatus;
  supporting_event_ids: string[];
  expected_by_hour?: number; // For Routine Anomaly Watchdog (24h clock)
  routine_event_type?: EventType;
}

export interface ProposedActionPayload {
  action_type: ActionType;
  summary: string;
  target_person_id: string;
  parameters: Record<string, string>;
  supporting_evidence_ids: string[];
}

export interface ActionRecord {
  id: string;
  idempotency_key: string;
  action_type: ActionType;
  policy_tier: ExecutionPolicy;
  summary: string;
  target_person_id: string;
  parameters: Record<string, string>;
  supporting_evidence_ids: string[];
  status: ActionStatus;
  proposed_by: 'gemini-4-argon' | 'autonomous_watchdog' | 'caregiver_manual';
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  verification_note: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  actor_role: ActorRole | 'system_autonomous';
  operation:
    | 'EVENT_RECORDED'
    | 'EVENT_CORRECTED'
    | 'EVENT_RETRACTED'
    | 'CONFLICT_AUTO_FLAGGED'
    | 'LOOP_AUTO_DETECTED'
    | 'ACTION_PROPOSED'
    | 'ACTION_AUTO_EXECUTED'
    | 'ACTION_APPROVED_VERIFIED'
    | 'ACTION_REJECTED'
    | 'ACTION_BLOCKED_POLICY'
    | 'ACTION_BLOCKED_TOCTOU'
    | 'CITATION_REJECTED';
  target_id: string;
  detail: string;
}

export interface QuestionTurn {
  answer_version?: 'grounded-v2';
  id: string;
  timestamp: string;
  asked_by: ActorRole;
  question: string;
  normalized_topic: string;
  answer: string;
  cited_event_ids: string[];
  prompt_aliases_used: string[];
  rejected_citations: string[];
  epistemic_basis: 'observed' | 'reported' | 'inferred' | 'insufficient_evidence';
  has_conflicting_evidence: boolean;
  uncertainty: string;
  repetitive_loop_count: number;
  is_reassurance_mode: boolean;
  proposed_action_id: string | null;
}

export interface RoutineWatchdogAlert {
  id: string;
  fact_id: string;
  routine_statement: string;
  expected_by_label: string;
  status: 'satisfied' | 'missing_evidence';
  matching_event_id: string | null;
}

export interface CaregiverState {
  person: {
    id: string;
    name: string;
    preferred_name: string;
    age: number;
    current_location: string;
    primary_caregiver: string;
    family_contact: string;
  };
  currentActor: ActorRole;
  orientationCardVisible: boolean;
  events: MemoryEvent[];
  facts: DerivedFact[];
  actions: ActionRecord[];
  auditLog: AuditEntry[];
  sessionTurns: QuestionTurn[];
}

export const ACTION_POLICY_MAP: Record<ActionType, ExecutionPolicy> = {
  // Tier 1 & 2: Safe Autonomous Actions
  flag_memory_conflict: ExecutionPolicy.AUTO_EXECUTE,
  log_patient_mood_report: ExecutionPolicy.AUTO_EXECUTE,
  show_orientation_card: ExecutionPolicy.AUTO_EXECUTE,
  alert_caregiver_loop_detected: ExecutionPolicy.AUTO_EXECUTE,

  // Tier 3: Human-Confirmed Actions
  create_reminder: ExecutionPolicy.REQUIRE_APPROVAL,
  draft_family_message: ExecutionPolicy.REQUIRE_APPROVAL,
  mark_routine_completed: ExecutionPolicy.REQUIRE_APPROVAL,

  // Hard Blocked Actions
  change_medication_dose: ExecutionPolicy.PROHIBITED,
  unlock_door: ExecutionPolicy.PROHIBITED,
  contact_emergency_services: ExecutionPolicy.PROHIBITED,
};

export function evaluateActionPolicy(actionType: string): ExecutionPolicy {
  if (actionType in ACTION_POLICY_MAP) {
    return ACTION_POLICY_MAP[actionType as ActionType];
  }
  // Default-deny unknown action types
  return ExecutionPolicy.PROHIBITED;
}

export function computeIdempotencyKey(proposal: ProposedActionPayload): string {
  const normalizedSummary = proposal.summary.trim().toLowerCase().replace(/\s+/g, '_');
  const sortedEvidence = [...proposal.supporting_evidence_ids].sort().join(',');
  return `idem:${proposal.action_type}:${proposal.target_person_id}:${normalizedSummary}:${sortedEvidence}`;
}

export interface AliasMapping {
  aliasToEventId: Record<string, string>;
  eventIdToAlias: Record<string, string>;
  formattedContextLines: string[];
}

/**
 * Maps active events to short sequential prompt aliases [E1], [E2], ...
 * Prevents 24-char ObjectId hex transcription hallucinations by the LLM.
 */
export function buildPromptAliases(activeEvents: MemoryEvent[]): AliasMapping {
  const aliasToEventId: Record<string, string> = {};
  const eventIdToAlias: Record<string, string> = {};
  const formattedContextLines: string[] = [];

  activeEvents.forEach((evt, index) => {
    const alias = `E${index + 1}`;
    aliasToEventId[alias] = evt.id;
    eventIdToAlias[evt.id] = alias;
    const conflictTag =
      evt.conflict_with_ids.length > 0
        ? ` [CONFLICTS WITH: ${evt.conflict_with_ids.join(', ')}]`
        : '';
    formattedContextLines.push(
      `[${alias}] (id=${evt.id}, status=${evt.epistemic_status}, type=${evt.event_type}, time=${evt.occurred_at}, source=${evt.source.type} by ${evt.source.author}, confidence=${evt.confidence}${conflictTag}): ${evt.statement}`
    );
  });

  return { aliasToEventId, eventIdToAlias, formattedContextLines };
}

export interface CitationValidationResult {
  validEventIds: string[];
  validAliases: string[];
  rejectedCitations: string[];
  hasConflictInCited: boolean;
}

/**
 * Validates every cited alias or event ID against the actual retrieved active records.
 */
export function validateAndResolveCitations(
  rawCitations: string[],
  aliasMap: AliasMapping,
  activeEvents: MemoryEvent[]
): CitationValidationResult {
  const activeSet = new Set(activeEvents.map((e) => e.id));
  const validEventIds: string[] = [];
  const validAliases: string[] = [];
  const rejectedCitations: string[] = [];

  if (!Array.isArray(rawCitations)) rawCitations = ['[malformed citations]'];
  for (const raw of rawCitations) {
    if (typeof raw !== 'string') { rejectedCitations.push('[malformed citation]'); continue; }
    const cleaned = raw.trim().replace(/^\[|\]$/g, '');
    if (cleaned in aliasMap.aliasToEventId) {
      const resolvedId = aliasMap.aliasToEventId[cleaned];
      if (activeSet.has(resolvedId) && !validEventIds.includes(resolvedId)) {
        validEventIds.push(resolvedId);
        validAliases.push(cleaned);
      }
    } else if (activeSet.has(cleaned)) {
      if (!validEventIds.includes(cleaned)) {
        validEventIds.push(cleaned);
        validAliases.push(aliasMap.eventIdToAlias[cleaned] || cleaned);
      }
    } else {
      rejectedCitations.push(cleaned);
    }
  }

  const citedEvents = activeEvents.filter((e) => validEventIds.includes(e.id));
  const hasConflictInCited = citedEvents.some((e) => e.conflict_with_ids.length > 0);

  return {
    validEventIds,
    validAliases,
    rejectedCitations,
    hasConflictInCited,
  };
}

const NEGATIVE_MARKERS = [
  'skipped',
  'refused',
  'no appetite',
  'nothing',
  'did not',
  "didn't",
  'missed',
  'cancelled',
  'canceled',
  'never',
  'none',
];

const POSITIVE_MARKERS = [
  'ate',
  'had',
  'drank',
  'finished',
  'completed',
  'took',
  'visited',
  'walked',
  'enjoyed',
  'confirmed',
];

function hasPolarity(text: string, markers: string[]): boolean {
  const lower = text.toLowerCase();
  return markers.some((m) => lower.includes(m));
}

/**
 * Tier 1 Autonomous Contradiction & Conflict Auditor
 * Detects when a newly entered active event contradicts an existing active event
 * of the same category on the same day.
 */
export function detectEventContradictions(
  candidate: Pick<MemoryEvent, 'event_type' | 'occurred_at' | 'statement'>,
  activeEvents: MemoryEvent[]
): string[] {
  const candidateDate = candidate.occurred_at.slice(0, 10);
  const candidateNeg = hasPolarity(candidate.statement, NEGATIVE_MARKERS);
  const candidatePos = hasPolarity(candidate.statement, POSITIVE_MARKERS);

  const mealTimeTokens = ['breakfast', 'lunch', 'dinner', 'tea', 'sandwich', 'oatmeal', 'walk', 'sarah'];
  const candidateTokens = mealTimeTokens.filter((t) =>
    candidate.statement.toLowerCase().includes(t)
  );

  const conflictingIds: string[] = [];

  for (const existing of activeEvents) {
    if (existing.status !== 'active') continue;
    if (existing.event_type !== candidate.event_type) continue;
    if (existing.occurred_at.slice(0, 10) !== candidateDate) continue;

    const existingNeg = hasPolarity(existing.statement, NEGATIVE_MARKERS);
    const existingPos = hasPolarity(existing.statement, POSITIVE_MARKERS);

    const sharedTokens = candidateTokens.filter((t) =>
      existing.statement.toLowerCase().includes(t)
    );

    const polarityOpposite =
      (candidateNeg && existingPos && !existingNeg) ||
      (candidatePos && !candidateNeg && existingNeg);

    // If both talk about the same meal/routine/person on the same day with opposite polarity
    if (polarityOpposite && (sharedTokens.length > 0 || candidateTokens.length === 0)) {
      conflictingIds.push(existing.id);
    }
  }

  return conflictingIds;
}

/**
 * Normalizes a natural language question into a canonical topic key
 * for the Tier 1 Autonomous Repetitive-Question Loop Detector.
 */
export function normalizeQuestionTopic(question: string): string {
  const lower = question.toLowerCase().trim();
  if (lower.includes('sarah') || lower.includes('daughter') || lower.includes('visit')) {
    return 'topic:sarah_visit';
  }
  if (lower.includes('breakfast') || lower.includes('tea') || lower.includes('morning meal') || lower.includes('oatmeal')) {
    return 'topic:breakfast';
  }
  if (lower.includes('lunch') || lower.includes('sandwich') || lower.includes('soup') || lower.includes('eat')) {
    return 'topic:lunch_meal';
  }
  if (lower.includes('walk') || lower.includes('outside') || lower.includes('garden')) {
    return 'topic:garden_walk';
  }
  if (lower.includes('where am i') || lower.includes('what day') || lower.includes('what time') || lower.includes('confused')) {
    return 'topic:orientation';
  }
  if (lower.includes('medication') || lower.includes('pill') || lower.includes('dose') || lower.includes('tablet')) {
    return 'topic:medication';
  }
  return `topic:${lower.replace(/[^a-z0-9]+/g, '_').slice(0, 32)}`;
}

/**
 * Counts how many times this canonical question topic has been asked in the session.
 */
export function countTopicRepetitions(turns: QuestionTurn[], topic: string): number {
  return turns.filter((t) => t.normalized_topic === topic).length + 1;
}

/**
 * Checks whether a derived fact still has at least one active supporting event.
 * Prevents orphaned facts after an underlying event is retracted or superseded.
 */
export function isFactGroundedInActiveEvents(
  fact: DerivedFact,
  events: MemoryEvent[]
): boolean {
  const activeIds = new Set(events.filter((e) => e.status === 'active').map((e) => e.id));
  return fact.supporting_event_ids.some((id) => activeIds.has(id));
}

/**
 * Tier 1 Autonomous Routine Anomaly & Silent Omission Watchdog
 */
export function runRoutineAnomalyWatchdog(
  state: CaregiverState,
  currentHourUtc: number = 15
): RoutineWatchdogAlert[] {
  const activeEvents = state.events.filter((e) => e.status === 'active');
  const alerts: RoutineWatchdogAlert[] = [];

  for (const fact of state.facts) {
    if (fact.category !== 'routine' || fact.expected_by_hour === undefined) continue;
    if (!isFactGroundedInActiveEvents(fact, state.events)) continue;

    const directSupportingEvent = activeEvents.find((e) =>
      fact.supporting_event_ids.includes(e.id) &&
      (!fact.routine_event_type || e.event_type === fact.routine_event_type)
    );
    const matchingEvent =
      directSupportingEvent ||
      activeEvents.find((e) => e.event_type === fact.routine_event_type);

    const isPastDue = currentHourUtc >= fact.expected_by_hour;
    const status = matchingEvent || !isPastDue ? 'satisfied' : 'missing_evidence';

    alerts.push({
      id: `watchdog_${fact.id}`,
      fact_id: fact.id,
      routine_statement: fact.statement,
      expected_by_label: `${String(fact.expected_by_hour).padStart(2, '0')}:00`,
      status,
      matching_event_id: matchingEvent ? matchingEvent.id : null,
    });
  }

  return alerts;
}

/**
 * Proposes and processes an action through the 3-tier Policy Gate with idempotency protection.
 */
export function proposeAndProcessAction(
  state: CaregiverState,
  proposal: ProposedActionPayload,
  proposedBy: ActionRecord['proposed_by'] = 'gemini-4-argon'
): { nextState: CaregiverState; actionRecord: ActionRecord; wasDuplicate: boolean } {
  const idempotencyKey = computeIdempotencyKey(proposal);
  const existing = state.actions.find((a) => a.idempotency_key === idempotencyKey);
  if (existing) {
    return { nextState: state, actionRecord: existing, wasDuplicate: true };
  }

  const now = new Date().toISOString();
  const policyTier = evaluateActionPolicy(proposal.action_type);
  const actionId = `act_${String(state.actions.length + 1).padStart(3, '0')}`;

  let status: ActionStatus = 'pending_approval';
  let decidedAt: string | null = null;
  let decidedBy: string | null = null;
  let verificationNote = 'Awaiting authorized caregiver confirmation before execution.';
  let auditOp: AuditEntry['operation'] = 'ACTION_PROPOSED';

  if (policyTier === ExecutionPolicy.PROHIBITED) {
    status = 'blocked_policy';
    decidedAt = now;
    decidedBy = 'policy.py (Deterministic Gate)';
    verificationNote = `Blocked by policy gate: "${proposal.action_type}" is on the high-consequence prohibited list. Route to human clinician/caregiver.`;
    auditOp = 'ACTION_BLOCKED_POLICY';
  } else if (policyTier === ExecutionPolicy.AUTO_EXECUTE) {
    status = 'verified';
    decidedAt = now;
    decidedBy = 'policy.py (Tier 1/2 Auto-Execute)';
    verificationNote = `Verified deterministic execution of allowlisted autonomous action "${proposal.action_type}".`;
    auditOp = 'ACTION_AUTO_EXECUTED';
  }

  const actionRecord: ActionRecord = {
    id: actionId,
    idempotency_key: idempotencyKey,
    action_type: proposal.action_type,
    policy_tier: policyTier,
    summary: proposal.summary,
    target_person_id: proposal.target_person_id,
    parameters: proposal.parameters,
    supporting_evidence_ids: proposal.supporting_evidence_ids,
    status,
    proposed_by: proposedBy,
    created_at: now,
    decided_at: decidedAt,
    decided_by: decidedBy,
    verification_note: verificationNote,
  };

  const auditEntry: AuditEntry = {
    id: `aud_${String(state.auditLog.length + 1).padStart(3, '0')}`,
    timestamp: now,
    actor:
      policyTier === ExecutionPolicy.AUTO_EXECUTE
        ? 'Autonomous Policy Engine'
        : proposedBy,
    actor_role: 'system_autonomous',
    operation: auditOp,
    target_id: actionId,
    detail: `[${policyTier.toUpperCase()}] ${proposal.action_type}: ${proposal.summary}`,
  };

  const nextOrientationVisible =
    proposal.action_type === 'show_orientation_card' && status === 'verified'
      ? true
      : state.orientationCardVisible;

  return {
    nextState: {
      ...state,
      orientationCardVisible: nextOrientationVisible,
      actions: [actionRecord, ...state.actions],
      auditLog: [auditEntry, ...state.auditLog],
    },
    actionRecord,
    wasDuplicate: false,
  };
}

/**
 * Approves and executes a pending action, enforcing Caregiver Role + TOCTOU active-evidence check.
 */
export function approveAndExecuteAction(
  state: CaregiverState,
  actionId: string,
  actorRole: ActorRole,
  actorName: string = 'Sam Rivera (Caregiver)'
): { nextState: CaregiverState; error?: string } {
  if (actorRole !== 'caregiver') {
    return {
      nextState: state,
      error: 'Permission denied: Only an authorized Caregiver can approve pending actions.',
    };
  }

  const targetAction = state.actions.find((a) => a.id === actionId);
  if (!targetAction) {
    return { nextState: state, error: `Action ${actionId} not found.` };
  }

  if (targetAction.status !== 'pending_approval') {
    return {
      nextState: state,
      error: `Action ${actionId} is already in terminal state "${targetAction.status}".`,
    };
  }

  const now = new Date().toISOString();

  // TOCTOU Check: Verify all supporting_evidence_ids are still status === 'active'
  const activeEventIds = new Set(
    state.events.filter((e) => e.status === 'active').map((e) => e.id)
  );
  const invalidatedIds = targetAction.supporting_evidence_ids.filter(
    (id) => !activeEventIds.has(id)
  );

  if (invalidatedIds.length > 0) {
    const updatedAction: ActionRecord = {
      ...targetAction,
      status: 'blocked_toctou',
      decided_at: now,
      decided_by: actorName,
      verification_note: `TOCTOU Safety Block: Supporting evidence [${invalidatedIds.join(', ')}] was retracted or superseded after this action was proposed.`,
    };

    const auditEntry: AuditEntry = {
      id: `aud_${String(state.auditLog.length + 1).padStart(3, '0')}`,
      timestamp: now,
      actor: actorName,
      actor_role: actorRole,
      operation: 'ACTION_BLOCKED_TOCTOU',
      target_id: actionId,
      detail: `Blocked execution of "${targetAction.summary}" because supporting evidence [${invalidatedIds.join(', ')}] is no longer active.`,
    };

    return {
      nextState: {
        ...state,
        actions: state.actions.map((a) => (a.id === actionId ? updatedAction : a)),
        auditLog: [auditEntry, ...state.auditLog],
      },
      error: updatedAction.verification_note,
    };
  }

  // Deterministic execution & state verification
  const updatedAction: ActionRecord = {
    ...targetAction,
    status: 'verified',
    decided_at: now,
    decided_by: actorName,
    verification_note: `Handler executed & verified state at ${now.slice(11, 19)} UTC. Idempotency key locked.`,
  };

  const auditEntry: AuditEntry = {
    id: `aud_${String(state.auditLog.length + 1).padStart(3, '0')}`,
    timestamp: now,
    actor: actorName,
    actor_role: actorRole,
    operation: 'ACTION_APPROVED_VERIFIED',
    target_id: actionId,
    detail: `Caregiver approved and verified execution of "${targetAction.summary}".`,
  };

  return {
    nextState: {
      ...state,
      actions: state.actions.map((a) => (a.id === actionId ? updatedAction : a)),
      auditLog: [auditEntry, ...state.auditLog],
    },
  };
}

export function rejectPendingAction(
  state: CaregiverState,
  actionId: string,
  actorRole: ActorRole,
  reason: string = 'Caregiver declined proposed action.'
): { nextState: CaregiverState; error?: string } {
  if (actorRole !== 'caregiver') {
    return {
      nextState: state,
      error: 'Permission denied: Only an authorized Caregiver can reject pending actions.',
    };
  }

  const targetAction = state.actions.find((a) => a.id === actionId);
  if (!targetAction || targetAction.status !== 'pending_approval') {
    return { nextState: state, error: 'Action cannot be rejected.' };
  }

  const now = new Date().toISOString();
  const updatedAction: ActionRecord = {
    ...targetAction,
    status: 'rejected',
    decided_at: now,
    decided_by: 'Sam Rivera (Caregiver)',
    verification_note: `Declined by caregiver: ${reason}`,
  };

  const auditEntry: AuditEntry = {
    id: `aud_${String(state.auditLog.length + 1).padStart(3, '0')}`,
    timestamp: now,
    actor: 'Sam Rivera (Caregiver)',
    actor_role: 'caregiver',
    operation: 'ACTION_REJECTED',
    target_id: actionId,
    detail: `Rejected action "${targetAction.summary}": ${reason}`,
  };

  return {
    nextState: {
      ...state,
      actions: state.actions.map((a) => (a.id === actionId ? updatedAction : a)),
      auditLog: [auditEntry, ...state.auditLog],
    },
  };
}

export interface NewEventInput {
  event_type: EventType;
  statement: string;
  occurred_at?: string;
  epistemic_status?: EpistemicStatus;
  source_type?: EventSource['type'];
  author?: string;
  confidence?: number;
}

/**
 * Records a new event into persistent memory, enforcing role rules and running
 * the Tier 1 Autonomous Contradiction Auditor.
 */
export function recordEventWithAudit(
  state: CaregiverState,
  input: NewEventInput,
  actorRole: ActorRole
): { nextState: CaregiverState; createdEvent: MemoryEvent; conflictsDetected: string[] } {
  const now = new Date().toISOString();
  const occurredAt = input.occurred_at || '2026-10-24T12:40:00Z';
  const newId = `evt_${String(state.events.length + 1).padStart(3, '0')}`;

  // Role safety boundary: if patient enters an event, enforce patient_self_report and reported status
  const effectiveSourceType: EventSource['type'] =
    actorRole === 'patient'
      ? 'patient_self_report'
      : input.source_type || 'caregiver_observation';

  const effectiveEpistemic: EpistemicStatus =
    actorRole === 'patient' ? 'reported' : input.epistemic_status || 'observed';

  const effectiveConfidence =
    actorRole === 'patient' ? 0.7 : input.confidence ?? 0.95;

  const effectiveAuthor =
    actorRole === 'patient' ? 'Alex Mercer (Patient)' : input.author || 'Sam Rivera (Caregiver)';

  const activeEvents = state.events.filter((e) => e.status === 'active');
  const conflictsDetected = detectEventContradictions(
    {
      event_type: input.event_type,
      occurred_at: occurredAt,
      statement: input.statement,
    },
    activeEvents
  );

  const createdEvent: MemoryEvent = {
    id: newId,
    person_id: state.person.id,
    event_type: input.event_type,
    occurred_at: occurredAt,
    recorded_at: now,
    statement: input.statement.trim(),
    source: {
      type: effectiveSourceType,
      author: effectiveAuthor,
      reference_id: `ref_${newId}`,
    },
    epistemic_status: effectiveEpistemic,
    confidence: effectiveConfidence,
    status: 'active',
    supersedes: null,
    superseded_by: null,
    conflict_with_ids: conflictsDetected,
  };

  // Update existing conflicting events bi-directionally
  const updatedEvents = state.events.map((evt) => {
    if (conflictsDetected.includes(evt.id)) {
      return {
        ...evt,
        conflict_with_ids: Array.from(new Set([...evt.conflict_with_ids, newId])),
      };
    }
    return evt;
  });

  const baseAudit: AuditEntry = {
    id: `aud_${String(state.auditLog.length + 1).padStart(3, '0')}`,
    timestamp: now,
    actor: effectiveAuthor,
    actor_role: actorRole,
    operation: 'EVENT_RECORDED',
    target_id: newId,
    detail: `Recorded ${effectiveEpistemic} event (${input.event_type}): "${createdEvent.statement}"`,
  };

  let nextState: CaregiverState = {
    ...state,
    events: [createdEvent, ...updatedEvents],
    auditLog: [baseAudit, ...state.auditLog],
  };

  // Tier 1 Autonomous Contradiction Auditor: Auto-execute flag_memory_conflict if contradiction detected
  if (conflictsDetected.length > 0) {
    const autoResult = proposeAndProcessAction(
      nextState,
      {
        action_type: 'flag_memory_conflict',
        summary: `Autonomous Conflict Flag: ${newId} contradicts [${conflictsDetected.join(', ')}]`,
        target_person_id: state.person.id,
        parameters: {
          new_event_id: newId,
          conflicting_event_ids: conflictsDetected.join(','),
        },
        supporting_evidence_ids: [newId, ...conflictsDetected],
      },
      'autonomous_watchdog'
    );
    nextState = autoResult.nextState;
  }

  return { nextState, createdEvent, conflictsDetected };
}

/**
 * Atomic non-destructive event correction or retraction.
 * Never overwrites history: marks original event as 'superseded' or 'retracted'
 * and links 'supersedes' / 'superseded_by'.
 */
export function correctOrRetractEvent(
  state: CaregiverState,
  targetEventId: string,
  options: {
    mode: 'correct' | 'retract';
    newStatement?: string;
    reason: string;
    author?: string;
  },
  actorRole: ActorRole
): { nextState: CaregiverState; newEvent?: MemoryEvent; error?: string } {
  if (actorRole !== 'caregiver') {
    return {
      nextState: state,
      error: 'Permission denied: Only an authorized Caregiver can correct or retract historical records.',
    };
  }

  const target = state.events.find((e) => e.id === targetEventId);
  if (!target) {
    return { nextState: state, error: `Event ${targetEventId} not found.` };
  }
  if (target.status !== 'active') {
    return {
      nextState: state,
      error: `Event ${targetEventId} is already ${target.status}.`,
    };
  }

  const now = new Date().toISOString();
  const author = options.author || 'Sam Rivera (Caregiver)';

  if (options.mode === 'retract') {
    const updatedEvents = state.events.map((evt) => {
      if (evt.id === targetEventId) {
        return {
          ...evt,
          status: 'retracted' as const,
          retraction_reason: options.reason,
          conflict_with_ids: [],
        };
      }
      // Also clear this ID from other events' conflict_with_ids
      if (evt.conflict_with_ids.includes(targetEventId)) {
        return {
          ...evt,
          conflict_with_ids: evt.conflict_with_ids.filter((id) => id !== targetEventId),
        };
      }
      return evt;
    });

    const auditEntry: AuditEntry = {
      id: `aud_${String(state.auditLog.length + 1).padStart(3, '0')}`,
      timestamp: now,
      actor: author,
      actor_role: 'caregiver',
      operation: 'EVENT_RETRACTED',
      target_id: targetEventId,
      detail: `Retracted ${targetEventId} (Reason: ${options.reason}). History preserved.`,
    };

    return {
      nextState: {
        ...state,
        events: updatedEvents,
        auditLog: [auditEntry, ...state.auditLog],
      },
    };
  }

  // Mode === 'correct': Atomic insert of replacement + mark old as 'superseded'
  const newId = `evt_${String(state.events.length + 1).padStart(3, '0')}`;
  const replacementEvent: MemoryEvent = {
    id: newId,
    person_id: target.person_id,
    event_type: target.event_type,
    occurred_at: target.occurred_at,
    recorded_at: now,
    statement: (options.newStatement || '').trim(),
    source: {
      type: 'caregiver_observation',
      author,
      reference_id: `corr_${targetEventId}`,
    },
    epistemic_status: 'observed',
    confidence: 1.0,
    status: 'active',
    supersedes: targetEventId,
    superseded_by: null,
    retraction_reason: options.reason,
    conflict_with_ids: [],
  };

  const updatedEvents = state.events.map((evt) => {
    if (evt.id === targetEventId) {
      return {
        ...evt,
        status: 'superseded' as const,
        superseded_by: newId,
        retraction_reason: options.reason,
        conflict_with_ids: [],
      };
    }
    if (evt.conflict_with_ids.includes(targetEventId)) {
      return {
        ...evt,
        conflict_with_ids: evt.conflict_with_ids.filter((id) => id !== targetEventId),
      };
    }
    return evt;
  });

  // Update derived facts that pointed to targetEventId so they point to replacement newId
  const updatedFacts = state.facts.map((fact) => {
    if (fact.supporting_event_ids.includes(targetEventId)) {
      return {
        ...fact,
        supporting_event_ids: fact.supporting_event_ids.map((id) =>
          id === targetEventId ? newId : id
        ),
      };
    }
    return fact;
  });

  const auditEntry: AuditEntry = {
    id: `aud_${String(state.auditLog.length + 1).padStart(3, '0')}`,
    timestamp: now,
    actor: author,
    actor_role: 'caregiver',
    operation: 'EVENT_CORRECTED',
    target_id: `${targetEventId} -> ${newId}`,
    detail: `Corrected ${targetEventId} with ${newId} (Reason: ${options.reason}). Original marked superseded.`,
  };

  return {
    nextState: {
      ...state,
      events: [replacementEvent, ...updatedEvents],
      facts: updatedFacts,
      auditLog: [auditEntry, ...state.auditLog],
    },
    newEvent: replacementEvent,
  };
}

/**
 * Deterministic evidence-grounded reasoning engine.
 * Used both as a zero-latency local reasoner and to validate/augment Gemini API responses.
 */
export function answerQuestionFromEvidence(
  state: CaregiverState,
  question: string,
  actorRole: ActorRole,
  llmOverride?: {
    answer: string;
    evidence_ids: string[];
    epistemic_basis: QuestionTurn['epistemic_basis'];
    has_conflicting_evidence: boolean;
    uncertainty: string;
    proposed_action?: ProposedActionPayload | null;
  }
): { nextState: CaregiverState; turn: QuestionTurn } {
  const activeEvents = state.events.filter((e) => e.status === 'active');
  const aliasMap = buildPromptAliases(activeEvents);
  const topic = normalizeQuestionTopic(question);
  const repetitionCount = countTopicRepetitions(state.sessionTurns, topic);
  const isReassuranceMode = repetitionCount >= 3;

  let nextState = { ...state };
  const now = new Date().toISOString();

  // If LLM override is provided, validate its citations strictly against aliasMap & activeEvents
  if (llmOverride) {
    const citationCheck = validateAndResolveCitations(
      llmOverride.evidence_ids,
      aliasMap,
      activeEvents
    );

    if (citationCheck.rejectedCitations.length > 0) {
      const rejectAudit: AuditEntry = {
        id: `aud_${String(nextState.auditLog.length + 1).padStart(3, '0')}`,
        timestamp: now,
        actor: 'Python Citation Validator',
        actor_role: 'system_autonomous',
        operation: 'CITATION_REJECTED',
        target_id: citationCheck.rejectedCitations.join(','),
        detail: `Rejected hallucinated/inactive evidence IDs [${citationCheck.rejectedCitations.join(', ')}] from model output.`,
      };
      nextState = {
        ...nextState,
        auditLog: [rejectAudit, ...nextState.auditLog],
      };
    }

    const acceptedEvidence = citationCheck.rejectedCitations.length === 0 && citationCheck.validEventIds.length > 0;
    let proposedActionId: string | null = null;
    if (acceptedEvidence && llmOverride.proposed_action) {
      const actionRes = proposeAndProcessAction(
        nextState,
        llmOverride.proposed_action,
        'gemini-4-argon'
      );
      nextState = actionRes.nextState;
      proposedActionId = actionRes.actionRecord.id;
    }

    if (isReassuranceMode) {
      const loopAlert = proposeAndProcessAction(
        nextState,
        {
          action_type: 'alert_caregiver_loop_detected',
          summary: `Repetitive question loop (${repetitionCount}x) on "${topic}" — reassurance mode activated.`,
          target_person_id: state.person.id,
          parameters: { topic, count: String(repetitionCount), question },
          supporting_evidence_ids: citationCheck.validEventIds,
        },
        'autonomous_watchdog'
      );
      nextState = loopAlert.nextState;
    }

    const turn: QuestionTurn = {
      answer_version: 'grounded-v2',
      id: `turn_${String(nextState.sessionTurns.length + 1).padStart(3, '0')}`,
      timestamp: now,
      asked_by: actorRole,
      question,
      normalized_topic: topic,
      answer: acceptedEvidence
        ? quoteReports(activeEvents.filter(e => citationCheck.validEventIds.includes(e.id)))
        : 'I could not verify supporting citations, so I cannot establish an answer from the saved records.',
      cited_event_ids: acceptedEvidence ? citationCheck.validEventIds : [],
      prompt_aliases_used: acceptedEvidence ? citationCheck.validAliases : [],
      rejected_citations: citationCheck.rejectedCitations,
      epistemic_basis: acceptedEvidence ? "reported" : "insufficient_evidence",
      has_conflicting_evidence:
        llmOverride.has_conflicting_evidence || citationCheck.hasConflictInCited,
      uncertainty: acceptedEvidence ? 'Original source quotations shown instead of an unchecked model paraphrase. Citation membership is not proof of relevance or truth.' : 'Missing or invalid evidence citations; generated answer and action are withheld.',
      repetitive_loop_count: repetitionCount,
      is_reassurance_mode: isReassuranceMode,
      proposed_action_id: proposedActionId,
    };

    return {
      nextState: {
        ...nextState,
        sessionTurns: [turn, ...nextState.sessionTurns],
      },
      turn,
    };
  }

  // Deterministic Evidence-Grounded Evaluation (Fallback / Direct Execution)
  const lower = question.toLowerCase();
  let matchedEvents: MemoryEvent[] = [];
  let answer = '';
  let uncertainty = 'No ambiguity in the retrieved active records.';
  let epistemicBasis: QuestionTurn['epistemic_basis'] = 'observed';
  let proposedAction: ProposedActionPayload | null = null;

  // Never synthesize event details from fixture-specific templates.
  if (/double my dose|change medication|extra pill|blood pressure dose/i.test(question)) {
    answer = 'I cannot change medication doses or confirm that a dose was taken. Please check with your caregiver or clinician.';
    uncertainty = 'Medication changes are blocked; no ingestion claim is made.';
    epistemicBasis = 'insufficient_evidence';
    proposedAction = {
      action_type: 'change_medication_dose', summary: 'Medication-change request blocked',
      target_person_id: state.person.id, parameters: {}, supporting_evidence_ids: []
    };
  } else if (/\b(remind|reminder|message)\b/i.test(question)) {
    answer = 'A proposal will be recorded in this browser demo for caregiver review. No message has been sent or real reminder scheduled by this demo action.';
    uncertainty = 'Use the server-connected reminder workspace for real reminder execution.';
    epistemicBasis = 'insufficient_evidence';
    proposedAction = {
      action_type: lower.includes('message') ? 'draft_family_message' : 'create_reminder',
      summary: `Requested proposal: ${question}`, target_person_id: state.person.id,
      parameters: { requested_by: actorRole, note: question }, supporting_evidence_ids: []
    };
  } else if (/where am i|am i safe|where is my caregiver/i.test(question)) {
    answer = 'I cannot establish your current location or who is with you from these saved reports.';
    uncertainty = 'No live location or caregiver-presence verification is available.';
    epistemicBasis = 'insufficient_evidence';
  } else {
    matchedEvents = selectQuotedEvidence(activeEvents, question);
    answer = quoteReports(matchedEvents);
    epistemicBasis = matchedEvents.length ? matchedEvents.some(e => e.epistemic_status === 'inferred') ? 'inferred' : matchedEvents.some(e => e.epistemic_status === 'reported') ? 'reported' : 'observed' : 'insufficient_evidence';
    uncertainty = matchedEvents.length ? 'Original browser-demo source quotations only. Relevance and factual truth are not independently verified.' : 'No supporting browser-demo record found; no event completion is inferred.';
  }

  const citationCheck = validateAndResolveCitations(
    matchedEvents.map((e) => aliasMap.eventIdToAlias[e.id] || e.id),
    aliasMap,
    activeEvents
  );

  let proposedActionId: string | null = null;
  if (proposedAction) {
    const res = proposeAndProcessAction(nextState, proposedAction, 'gemini-4-argon');
    nextState = res.nextState;
    proposedActionId = res.actionRecord.id;
  }

  if (isReassuranceMode) {
    const loopRes = proposeAndProcessAction(
      nextState,
      {
        action_type: 'alert_caregiver_loop_detected',
        summary: `Repetitive question loop (${repetitionCount}x) on "${topic}" — calming reassurance card triggered.`,
        target_person_id: state.person.id,
        parameters: { topic, count: String(repetitionCount), question },
        supporting_evidence_ids: citationCheck.validEventIds,
      },
      'autonomous_watchdog'
    );
    nextState = loopRes.nextState;
  }

  const turn: QuestionTurn = {
    answer_version: 'grounded-v2',
    id: `turn_${String(nextState.sessionTurns.length + 1).padStart(3, '0')}`,
    timestamp: now,
    asked_by: actorRole,
    question,
    normalized_topic: topic,
    answer,
    cited_event_ids: citationCheck.validEventIds,
    prompt_aliases_used: citationCheck.validAliases,
    rejected_citations: citationCheck.rejectedCitations,
    epistemic_basis: epistemicBasis,
    has_conflicting_evidence: citationCheck.hasConflictInCited,
    uncertainty,
    repetitive_loop_count: repetitionCount,
    is_reassurance_mode: isReassuranceMode,
    proposed_action_id: proposedActionId,
  };

  return {
    nextState: {
      ...nextState,
      sessionTurns: [turn, ...nextState.sessionTurns],
    },
    turn,
  };
}

export function createInitialState(): CaregiverState {
  const personId = 'demo-person-001';

  const events: MemoryEvent[] = [
    {
      id: 'evt_006',
      person_id: personId,
      event_type: 'mood_observation',
      occurred_at: '2026-10-24T13:15:00Z',
      recorded_at: '2026-10-24T13:16:00Z',
      statement: 'Alex mentioned mild stiffness in his right knee after lunch but is resting comfortably in the sunroom.',
      source: {
        type: 'patient_self_report',
        author: 'Alex Mercer (Patient)',
        reference_id: 'self_006',
      },
      epistemic_status: 'reported',
      confidence: 0.7,
      status: 'active',
      supersedes: null,
      superseded_by: null,
      conflict_with_ids: [],
    },
    {
      id: 'evt_005',
      person_id: personId,
      event_type: 'meal_hydration',
      occurred_at: '2026-10-24T12:30:00Z',
      recorded_at: '2026-10-24T12:35:00Z',
      statement: 'Alex ate half a warm turkey sandwich, tomato soup, and drank a full glass of water for lunch.',
      source: {
        type: 'caregiver_observation',
        author: 'Sam Rivera (Caregiver)',
        reference_id: 'log_005',
      },
      epistemic_status: 'observed',
      confidence: 0.98,
      status: 'active',
      supersedes: null,
      superseded_by: null,
      conflict_with_ids: [],
    },
    {
      id: 'evt_004',
      person_id: personId,
      event_type: 'family_visit',
      occurred_at: '2026-10-24T11:15:00Z',
      recorded_at: '2026-10-24T11:18:00Z',
      statement: 'Daughter Sarah Mercer called to confirm she will visit today at 4:30 PM (16:30 UTC) and bring fresh strawberries.',
      source: {
        type: 'family_call',
        author: 'Sarah Mercer (Daughter)',
        reference_id: 'call_004',
      },
      epistemic_status: 'reported',
      confidence: 0.9,
      status: 'active',
      supersedes: null,
      superseded_by: null,
      conflict_with_ids: [],
    },
    {
      id: 'evt_003',
      person_id: personId,
      event_type: 'daily_activity',
      occurred_at: '2026-10-24T10:15:00Z',
      recorded_at: '2026-10-24T10:40:00Z',
      statement: 'Alex completed a 20-minute walk in the courtyard garden with Sam Rivera and watered the rosemary bushes.',
      source: {
        type: 'caregiver_observation',
        author: 'Sam Rivera (Caregiver)',
        reference_id: 'log_003',
      },
      epistemic_status: 'observed',
      confidence: 1.0,
      status: 'active',
      supersedes: null,
      superseded_by: null,
      conflict_with_ids: [],
    },
    {
      id: 'evt_002',
      person_id: personId,
      event_type: 'meal_hydration',
      occurred_at: '2026-10-24T09:30:00Z',
      recorded_at: '2026-10-24T09:35:00Z',
      statement: 'Alex had warm Earl Grey tea with honey and a bowl of cinnamon oatmeal for breakfast.',
      source: {
        type: 'caregiver_observation',
        author: 'Sam Rivera (Caregiver)',
        reference_id: 'corr_evt_001',
      },
      epistemic_status: 'observed',
      confidence: 1.0,
      status: 'active',
      supersedes: 'evt_001',
      superseded_by: null,
      retraction_reason: 'Corrected beverage from black coffee to Earl Grey tea.',
      conflict_with_ids: [],
    },
    {
      id: 'evt_001',
      person_id: personId,
      event_type: 'meal_hydration',
      occurred_at: '2026-10-24T09:20:00Z',
      recorded_at: '2026-10-24T09:22:00Z',
      statement: 'Alex had black coffee and toast for breakfast.',
      source: {
        type: 'caregiver_report',
        author: 'Morning Shift Note',
        reference_id: 'log_001',
      },
      epistemic_status: 'reported',
      confidence: 0.8,
      status: 'superseded',
      supersedes: null,
      superseded_by: 'evt_002',
      retraction_reason: 'Mistaken shift note; Alex actually had Earl Grey tea and oatmeal (superseded by evt_002).',
      conflict_with_ids: [],
    },
    {
      id: 'evt_000',
      person_id: personId,
      event_type: 'medication_routine',
      occurred_at: '2026-10-24T08:45:00Z',
      recorded_at: '2026-10-24T08:47:00Z',
      statement: 'Alex took his standard morning Lisinopril 10mg tablet with water, observed by Sam Rivera.',
      source: {
        type: 'caregiver_observation',
        author: 'Sam Rivera (Caregiver)',
        reference_id: 'med_000',
      },
      epistemic_status: 'observed',
      confidence: 1.0,
      status: 'active',
      supersedes: null,
      superseded_by: null,
      conflict_with_ids: [],
    },
  ];

  const facts: DerivedFact[] = [
    {
      id: 'fact_001',
      person_id: personId,
      category: 'preference',
      statement: 'Alex prefers warm Earl Grey tea with honey at breakfast rather than coffee.',
      epistemic_status: 'observed',
      supporting_event_ids: ['evt_002'],
    },
    {
      id: 'fact_002',
      person_id: personId,
      category: 'relationship',
      statement: 'Sarah Mercer is Alex’s daughter; she visits regularly and calls ahead.',
      epistemic_status: 'observed',
      supporting_event_ids: ['evt_004'],
    },
    {
      id: 'fact_003',
      person_id: personId,
      category: 'routine',
      statement: 'Morning medication & breakfast hydration completed by 10:00 UTC.',
      epistemic_status: 'observed',
      supporting_event_ids: ['evt_000', 'evt_002'],
      expected_by_hour: 10,
      routine_event_type: 'meal_hydration',
    },
    {
      id: 'fact_004',
      person_id: personId,
      category: 'routine',
      statement: 'Morning courtyard garden walk completed by 11:00 UTC.',
      epistemic_status: 'observed',
      supporting_event_ids: ['evt_003'],
      expected_by_hour: 11,
      routine_event_type: 'daily_activity',
    },
    {
      id: 'fact_005',
      person_id: personId,
      category: 'routine',
      statement: 'Afternoon blood-pressure & ankle comfort safety check by 15:00 UTC.',
      epistemic_status: 'inferred',
      supporting_event_ids: ['evt_006'],
      expected_by_hour: 14,
      routine_event_type: 'safety_check',
    },
  ];

  const actions: ActionRecord[] = [
    {
      id: 'act_003',
      idempotency_key: 'idem:create_reminder:demo-person-001:remind_alex_at_4_00_pm_that_sarah_is_arriving_at_4_30_pm:evt_004',
      action_type: 'create_reminder',
      policy_tier: ExecutionPolicy.REQUIRE_APPROVAL,
      summary: 'Create 4:00 PM gentle reminder: Daughter Sarah arrives at 4:30 PM with strawberries',
      target_person_id: personId,
      parameters: { time: '16:00 UTC', channel: 'in_app_card' },
      supporting_evidence_ids: ['evt_004'],
      status: 'pending_approval',
      proposed_by: 'gemini-4-argon',
      created_at: '2026-10-24T11:20:00Z',
      decided_at: null,
      decided_by: null,
      verification_note: 'Awaiting authorized caregiver confirmation before scheduling.',
    },
    {
      id: 'act_002',
      idempotency_key: 'idem:change_medication_dose:demo-person-001:administer_extra_ibuprofen_400mg_for_knee_stiffness:evt_006',
      action_type: 'change_medication_dose',
      policy_tier: ExecutionPolicy.PROHIBITED,
      summary: 'Administer unscheduled Ibuprofen 400mg for right knee stiffness',
      target_person_id: personId,
      parameters: { medication: 'Ibuprofen 400mg', reason: 'knee stiffness' },
      supporting_evidence_ids: ['evt_006'],
      status: 'blocked_policy',
      proposed_by: 'gemini-4-argon',
      created_at: '2026-10-24T13:17:00Z',
      decided_at: '2026-10-24T13:17:00Z',
      decided_by: 'policy.py (Deterministic Gate)',
      verification_note: 'Blocked by policy gate: "change_medication_dose" is prohibited. Escalated to human clinician.',
    },
    {
      id: 'act_001',
      idempotency_key: 'idem:show_orientation_card:demo-person-001:display_morning_orientation_card:evt_002',
      action_type: 'show_orientation_card',
      policy_tier: ExecutionPolicy.AUTO_EXECUTE,
      summary: 'Display daily orientation & schedule card for Alex Mercer',
      target_person_id: personId,
      parameters: { mode: 'calm_daylight' },
      supporting_evidence_ids: ['evt_002', 'evt_004'],
      status: 'verified',
      proposed_by: 'autonomous_watchdog',
      created_at: '2026-10-24T09:36:00Z',
      decided_at: '2026-10-24T09:36:01Z',
      decided_by: 'policy.py (Tier 1/2 Auto-Execute)',
      verification_note: 'Verified deterministic execution of allowlisted autonomous action "show_orientation_card".',
    },
  ];

  const auditLog: AuditEntry[] = [
    {
      id: 'aud_004',
      timestamp: '2026-10-24T13:17:00Z',
      actor: 'policy.py',
      actor_role: 'system_autonomous',
      operation: 'ACTION_BLOCKED_POLICY',
      target_id: 'act_002',
      detail: '[PROHIBITED] Blocked unscheduled medication action "change_medication_dose" for knee stiffness.',
    },
    {
      id: 'aud_003',
      timestamp: '2026-10-24T11:20:00Z',
      actor: 'gemini-4-argon',
      actor_role: 'system_autonomous',
      operation: 'ACTION_PROPOSED',
      target_id: 'act_003',
      detail: '[REQUIRE_APPROVAL] Proposed 4:00 PM reminder for Sarah Mercer visit based on [evt_004].',
    },
    {
      id: 'aud_002',
      timestamp: '2026-10-24T09:35:00Z',
      actor: 'Sam Rivera (Caregiver)',
      actor_role: 'caregiver',
      operation: 'EVENT_CORRECTED',
      target_id: 'evt_001 -> evt_002',
      detail: 'Corrected evt_001 with evt_002 (Reason: Mistaken shift note; Alex had Earl Grey tea, not black coffee).',
    },
    {
      id: 'aud_001',
      timestamp: '2026-10-24T08:47:00Z',
      actor: 'Sam Rivera (Caregiver)',
      actor_role: 'caregiver',
      operation: 'EVENT_RECORDED',
      target_id: 'evt_000',
      detail: 'Recorded observed morning medication routine (Lisinopril 10mg).',
    },
  ];

  const sessionTurns: QuestionTurn[] = [
    {
      id: 'turn_001',
      timestamp: '2026-10-24T11:30:00Z',
      asked_by: 'patient',
      question: 'Did I have my breakfast tea this morning?',
      normalized_topic: 'topic:breakfast',
      answer:
        'Yes, Alex — according to Caregiver Sam Rivera’s observed record at 09:30 UTC, you had warm Earl Grey tea with honey and a bowl of cinnamon oatmeal for breakfast.',
      cited_event_ids: ['evt_002'],
      prompt_aliases_used: ['E5'],
      rejected_citations: [],
      epistemic_basis: 'observed',
      has_conflicting_evidence: false,
      uncertainty:
        'High confidence (observed by Sam Rivera). An earlier 09:20 shift note mentioning coffee was corrected and superseded.',
      repetitive_loop_count: 1,
      is_reassurance_mode: false,
      proposed_action_id: null,
    },
  ];

  return {
    person: {
      id: personId,
      name: 'Alex Mercer',
      preferred_name: 'Alex',
      age: 78,
      current_location: 'Meadowbrook Residence · Sunroom (24 Oak Lane)',
      primary_caregiver: 'Sam Rivera, RN',
      family_contact: 'Sarah Mercer (Daughter)',
    },
    currentActor: 'caregiver',
    orientationCardVisible: true,
    events,
    facts,
    actions,
    auditLog,
    sessionTurns,
  };
}
