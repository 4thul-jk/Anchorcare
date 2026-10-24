import React, { useState } from 'react';
import {
  ActorRole,
  CaregiverState,
  MemoryEvent,
  QuestionTurn,
  RoutineWatchdogAlert,
  buildPromptAliases,
} from '../lib/caregiverEngine';

interface CompanionViewProps {
  state: CaregiverState;
  watchdogAlerts: RoutineWatchdogAlert[];
  isAsking: boolean;
  onAskQuestion: (question: string) => Promise<void>;
  onSimulateRepetitiveLoop: () => Promise<void>;
  onToggleOrientationCard: () => void;
  onNavigateTab: (tab: 'companion' | 'memory' | 'policy' | 'codebase') => void;
}

export const CompanionView: React.FC<CompanionViewProps> = ({
  state,
  watchdogAlerts,
  isAsking,
  onAskQuestion,
  onSimulateRepetitiveLoop,
  onToggleOrientationCard,
  onNavigateTab,
}) => {
  const [questionInput, setQuestionInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showAliasPrompt, setShowAliasPrompt] = useState(false);

  const activeEvents = state.events.filter((e) => e.status === 'active');
  const aliasMap = buildPromptAliases(activeEvents);
  const latestTurn: QuestionTurn | undefined = state.sessionTurns[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = questionInput.trim();
    if (!trimmed) {
      setValidationError('Please enter a question to check against recorded memories.');
      return;
    }
    setValidationError(null);
    await onAskQuestion(trimmed);
    setQuestionInput('');
  };

  const handlePresetQuestion = async (q: string) => {
    setValidationError(null);
    setQuestionInput(q);
    await onAskQuestion(q);
    setQuestionInput('');
  };

  const getEventById = (id: string): MemoryEvent | undefined =>
    state.events.find((e) => e.id === id);

  const missingRoutineAlerts = watchdogAlerts.filter(
    (a) => a.status === 'missing_evidence'
  );

  return (
    <div className="space-y-8">
      {/* Orientation & Daily Grounding Card (Tier 2 Autonomous Feature) */}
      {state.orientationCardVisible && (
        <section
          aria-label="Daily Orientation and Grounding Summary"
          className="bg-white border border-slate-200 rounded-xl p-6"
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <p className="text-xs font-medium text-slate-500">
                Daily Orientation Card · Auto-Pinned by Policy Engine (show_orientation_card)
              </p>
              <h2 className="text-2xl font-bold text-slate-900 mt-1 text-balance">
                Good afternoon, {state.person.preferred_name}. Today is Saturday, 24 October 2026.
              </h2>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onToggleOrientationCard}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Hide Orientation Card
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5">
            <div>
              <p className="text-xs text-slate-500">Current Location</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">
                {state.person.current_location}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                On-Duty Caregiver: {state.person.primary_caregiver}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Morning & Midday Summary</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">
                Breakfast tea, garden walk, and lunch completed
              </p>
              <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                Grounded in evt_002 · evt_003 · evt_005
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Next Confirmed Activity</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">
                Daughter Sarah visiting at 4:30 PM (16:30 UTC)
              </p>
              <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                Source: evt_004 · Family phone report (11:15 UTC)
              </p>
            </div>
          </div>
        </section>
      )}

      {!state.orientationCardVisible && (
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-5 py-3">
          <span className="text-xs text-slate-600">
            Orientation card is hidden.
          </span>
          <button
            type="button"
            onClick={onToggleOrientationCard}
            className="px-3 py-1.5 text-xs font-medium text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Show Orientation Card
          </button>
        </div>
      )}

      {/* Main 2-Column Split: Left = Q&A Input + Latest Grounded Response, Right = Autonomous Watchdogs & Prompt Alias Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-6">
          {/* Question Entry Card */}
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Evidence-Grounded Memory Q&A
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Original browser demo records using alias citations [E1..E{activeEvents.length}]. Use the persistent memory workspace for Atlas retrieval.
                </p>
              </div>
              <span className="text-xs text-slate-500 font-mono tabular-nums shrink-0">
                Active Actor: {state.currentActor === 'caregiver' ? 'Caregiver (Sam)' : 'Patient (Alex)'}
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="memory-question-input"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Ask a question about recorded events, meals, visits, or routines
                </label>
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    id="memory-question-input"
                    type="text"
                    value={questionInput}
                    onChange={(e) => {
                      setQuestionInput(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    placeholder="e.g., Did I have my breakfast tea today? When is Sarah visiting?"
                    className="flex-1 px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                  />
                  <button
                    type="submit"
                    disabled={isAsking}
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    {isAsking ? 'Verifying Evidence...' : 'Ask Grounded Assistant'}
                  </button>
                </div>
                {validationError && (
                  <p role="alert" className="text-xs font-medium text-red-600 mt-1.5">
                    {validationError}
                  </p>
                )}
              </div>

              {/* Preset Test Scenarios */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500 mb-2">
                  One-Click Verification Scenarios (Tests Grounding, Abstention, Loops & Policy Refusal):
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handlePresetQuestion('Did I have breakfast and tea this morning?')}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    Ask: Breakfast & Corrected Tea
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetQuestion('When is my daughter Sarah visiting today?')}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    Ask: Sarah’s 4:30 PM Visit
                  </button>
                  <button
                    type="button"
                    onClick={onSimulateRepetitiveLoop}
                    className="px-3 py-1.5 text-xs font-medium text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    Simulate 3x Repeated Question Loop
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetQuestion('Did the physical therapist visit me yesterday evening?')}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    Test Missing Evidence Abstention
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetQuestion('Can you double my blood pressure medication dose today?')}
                    className="px-3 py-1.5 text-xs font-medium text-red-900 bg-red-100 hover:bg-red-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                  >
                    Test Prohibited Medication Change
                  </button>
                </div>
              </div>
            </form>
          </section>

          {/* Latest Grounded Response & Evidence Verification Breakdown */}
          {latestTurn && (
            <section
              aria-label="Latest Grounded Caregiver Response"
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
            >
              {/* Unboxed Metadata Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100 text-xs text-slate-500">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">Grounded Response</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Epistemic Basis:{' '}
                    <strong className="text-slate-800 uppercase">{latestTurn.epistemic_basis}</strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    Topic Repetitions: {latestTurn.repetitive_loop_count}x
                  </span>
                </div>
                <span className="font-mono tabular-nums">
                  {latestTurn.timestamp.slice(11, 19)} UTC
                </span>
              </div>

              {/* Autonomous Reassurance Mode Banner when loop count >= 3 */}
              {latestTurn.is_reassurance_mode && (
                <div
                  role="status"
                  className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 space-y-1"
                >
                  <p className="text-xs font-bold">
                    Tier 1 Autonomous Loop Detector Activated (Asked {latestTurn.repetitive_loop_count}x in current session)
                  </p>
                  <p className="text-xs text-amber-900">
                    Switched response tone to calming reassurance and automatically logged{' '}
                    <code className="font-mono">alert_caregiver_loop_detected</code> in the Caregiver Action Ledger.
                  </p>
                </div>
              )}

              {/* Conflicting Evidence Warning if detected */}
              {latestTurn.has_conflicting_evidence && (
                <div
                  role="alert"
                  className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-950 space-y-1"
                >
                  <p className="text-xs font-bold">
                    Conflicting Active Memories Detected
                  </p>
                  <p className="text-xs text-red-900">
                    Multiple active events contradict each other on this topic. The assistant will not silently pick one until a caregiver resolves the conflict.
                  </p>
                </div>
              )}

              {/* Question & Answer Prose */}
              <div className="space-y-2">
                <p className="text-xs text-slate-500">
                  Question asked: <span className="font-medium text-slate-800">"{latestTurn.question}"</span>
                </p>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <p className="text-base font-medium text-slate-900 leading-relaxed">
                    {latestTurn.answer_version === 'grounded-v2' ? latestTurn.answer : 'This is a historical browser-demo answer that has not passed the updated checks. Ask the question again to retrieve source reports.'}
                  </p>
                </div>
              </div>

              {/* Uncertainty & Epistemic Boundary Area (Separate Area per Milestone 3) */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-700">
                  Uncertainty & Epistemic Provenance Note
                </p>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {latestTurn.answer_version === 'grounded-v2' ? latestTurn.uncertainty : 'Historical answer retained for review; its claims are not displayed as verified information.'}
                </p>
              </div>

              {/* Verified Supporting Evidence Records */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-700">
                    Verified Supporting Evidence Records ({latestTurn.cited_event_ids.length})
                  </p>
                  <span className="text-xs text-slate-500 font-mono tabular-nums">
                    Rejected Hallucinated IDs: {latestTurn.rejected_citations.length}
                  </span>
                </div>

                {latestTurn.cited_event_ids.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">
                    Zero evidence records cited (Safe abstention or policy refusal).
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {latestTurn.cited_event_ids.map((id) => {
                      const ev = getEventById(id);
                      if (!ev) return null;
                      const alias = aliasMap.eventIdToAlias[ev.id] || ev.id;
                      return (
                        <div key={ev.id} className="py-3 text-xs space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-slate-500 font-mono tabular-nums">
                            <span>
                              <strong className="text-slate-900">[{alias}]</strong> → {ev.id} ·{' '}
                              {ev.event_type} · {ev.epistemic_status.toUpperCase()}
                            </span>
                            <span>
                              {ev.occurred_at.slice(0, 16).replace('T', ' ')} UTC · Conf:{' '}
                              {ev.confidence.toFixed(2)}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-900">{ev.statement}</p>
                          <p className="text-xs text-slate-500">
                            Source: {ev.source.type} · Logged by {ev.source.author}
                            {ev.supersedes ? ` · Supersedes ${ev.supersedes}` : ''}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* Right Column: Autonomous Safety Watchdogs & Prompt Alias Context Inspector */}
        <div className="lg:col-span-5 space-y-6">
          {/* Autonomous Watchdogs Panel */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Autonomous Safety & Memory Watchdogs
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Demonstration checks over browser state; these are not continuous Atlas monitoring.
              </p>
            </div>

            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {/* Watchdog 1: Routine Anomaly & Silent Omission Monitor */}
              <div className="py-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900">
                    01. Routine Anomaly Watchdog
                  </span>
                  <span className="font-mono tabular-nums text-amber-800 font-medium">
                    {missingRoutineAlerts.length} Missing Check
                  </span>
                </div>
                <div className="space-y-1.5">
                  {watchdogAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start justify-between gap-3 text-xs py-1"
                    >
                      <span className="text-slate-700">{alert.routine_statement}</span>
                      <span
                        className={`font-mono tabular-nums shrink-0 font-medium ${
                          alert.status === 'satisfied' ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {alert.status === 'satisfied'
                          ? `Verified (${alert.matching_event_id})`
                          : `Due ${alert.expected_by_label} (Missing)`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Watchdog 2: Contradiction Auditor */}
              <div className="py-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900">
                    02. Epistemic Contradiction Auditor
                  </span>
                  <span className="font-mono tabular-nums text-slate-700 font-medium">
                    {activeEvents.filter((e) => e.conflict_with_ids.length > 0).length} Conflicts Active
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Compares newly logged events against active same-day records to flag opposite-polarity claims automatically.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigateTab('memory')}
                  className="text-xs font-semibold text-slate-900 underline hover:text-slate-700 pt-1"
                >
                  Open Memory Ledger to test conflict detection
                </button>
              </div>

              {/* Watchdog 3: Policy Gate Summary */}
              <div className="pt-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900">
                    03. Deterministic Policy Demo (TypeScript)
                  </span>
                  <span className="font-mono tabular-nums text-slate-700 font-medium">
                    {state.actions.filter((a) => a.status === 'pending_approval').length} Pending Approval
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  Enforces 3-tier execution rules, idempotency keys, and TOCTOU active-evidence verification.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigateTab('policy')}
                  className="text-xs font-semibold text-slate-900 underline hover:text-slate-700 pt-1"
                >
                  Review Pending Caregiver Approvals
                </button>
              </div>
            </div>
          </section>

          {/* Prompt Alias Context Inspector ([E1..En]) */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Prompt Alias Context ([E1..E{activeEvents.length}])
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Short alias mapping prevents 24-char ObjectId hallucination typos
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAliasPrompt((prev) => !prev)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {showAliasPrompt ? 'Hide Raw Context' : 'Inspect Prompt Context'}
              </button>
            </div>

            {showAliasPrompt ? (
              <pre className="p-3.5 bg-slate-900 text-slate-100 text-xs font-mono rounded-lg overflow-x-auto leading-relaxed">
                {aliasMap.formattedContextLines.join('\n\n')}
              </pre>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {activeEvents.slice(0, 5).map((ev, idx) => (
                  <div key={ev.id} className="py-2 flex items-start justify-between gap-3">
                    <span className="font-mono font-semibold text-slate-900 shrink-0">
                      [E{idx + 1}] → {ev.id}
                    </span>
                    <span className="text-slate-600 truncate">{ev.statement}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
