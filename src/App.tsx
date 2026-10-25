import React, { useEffect, useState } from 'react';
import {
  ActionType,
  ActorRole,
  CaregiverState,
  NewEventInput,
  ProposedActionPayload,
  answerQuestionFromEvidence,
  approveAndExecuteAction,
  buildPromptAliases,
  correctOrRetractEvent,
  countTopicRepetitions,
  createInitialState,
  normalizeQuestionTopic,
  proposeAndProcessAction,
  recordEventWithAudit,
  rejectPendingAction,
  runRoutineAnomalyWatchdog,
} from './lib/caregiverEngine';
import { CompanionView } from './components/CompanionView';
import { MemoryLedgerView } from './components/MemoryLedgerView';
import { PolicyActionsView } from './components/PolicyActionsView';
import { PythonCodebaseView } from './components/PythonCodebaseView';
import { EngramMemoryView } from './components/EngramMemoryView';
import { AtlasLedgerView } from './components/AtlasLedgerView';
import { AtlasCompanionView } from './components/AtlasCompanionView';

const STORAGE_KEY = 'anchorcare_state_v1';

export default function App() {
  const [showMemoryBackend, setShowMemoryBackend] = useState(false);
  const [memoryAccessKey, setMemoryAccessKey] = useState('');
  const [state, setState] = useState<CaregiverState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.events) && Array.isArray(parsed.actions)) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage read errors
    }
    return createInitialState();
  });

  const [activeTab, setActiveTab] = useState<'companion' | 'memory' | 'policy' | 'codebase'>(
    'companion'
  );
  const [isAsking, setIsAsking] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }, [state]);

  const activeEvents = state.events.filter((e) => e.status === 'active');
  const pendingApprovalCount = state.actions.filter(
    (a) => a.status === 'pending_approval'
  ).length;
  const conflictCount = activeEvents.filter(
    (e) => e.conflict_with_ids.length > 0
  ).length;
  const watchdogAlerts = runRoutineAnomalyWatchdog(state, 15);

  const handleResetDemo = () => {
    const fresh = createInitialState();
    setState(fresh);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      // Ignore
    }
  };

  const handleRoleSwitch = (role: ActorRole) => {
    setState((prev) => ({
      ...prev,
      currentActor: role,
    }));
  };

  const handleAskQuestion = async (question: string) => {
    setIsAsking(true);
    try {
      const currentActive = state.events.filter((e) => e.status === 'active');
      const aliasMap = buildPromptAliases(currentActive);
      const topic = normalizeQuestionTopic(question);
      const repCount = countTopicRepetitions(state.sessionTurns, topic);

      // Call server-side Gemini endpoint (/api/gemini/reason), falling back to deterministic engine
      let llmOverride: Parameters<typeof answerQuestionFromEvidence>[3] = undefined;
      try {
        const response = await fetch('/api/gemini/reason', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question,
            formattedContextLines: aliasMap.formattedContextLines,
            actorRole: state.currentActor,
            repetitionCount: repCount,
            personId: state.person.id,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (!data.useLocalEngine && data.result) {
            const r = data.result;
            let proposedAction: ProposedActionPayload | null = null;
            if (r.proposed_action_type && r.proposed_action_type.trim() !== '') {
              proposedAction = {
                action_type: r.proposed_action_type as ActionType,
                summary:
                  r.proposed_action_summary ||
                  `Proposed ${r.proposed_action_type} for ${question}`,
                target_person_id: state.person.id,
                parameters: { source: 'gemini_structured_output' },
                supporting_evidence_ids: (r.evidence_ids || [])
                  .map((a: string) => aliasMap.aliasToEventId[a.replace(/^\[|\]$/g, '')] || a)
                  .filter(Boolean),
              };
            }
            llmOverride = {
              answer: r.answer,
              evidence_ids: r.evidence_ids || [],
              epistemic_basis: r.epistemic_basis || 'observed',
              has_conflicting_evidence: Boolean(r.has_conflicting_evidence),
              uncertainty: r.uncertainty || 'Grounded in retrieved evidence.',
              proposed_action: proposedAction,
            };
          }
        }
      } catch {
        // Use deterministic local engine on network failure
      }

      setState((prev) => {
        const res = answerQuestionFromEvidence(
          prev,
          question,
          prev.currentActor,
          llmOverride
        );
        return res.nextState;
      });
    } finally {
      setIsAsking(false);
    }
  };

  const handleSimulateRepetitiveLoop = async () => {
    setState((prev) => {
      const q1 = answerQuestionFromEvidence(
        prev,
        'When is my daughter Sarah visiting today?',
        'patient'
      );
      const q2 = answerQuestionFromEvidence(
        q1.nextState,
        'What time did Sarah say she is coming?',
        'patient'
      );
      const q3 = answerQuestionFromEvidence(
        q2.nextState,
        'Is Sarah visiting me this afternoon?',
        'patient'
      );
      return q3.nextState;
    });
  };

  const handleRecordEvent = (input: NewEventInput) => {
    const res = recordEventWithAudit(state, input, state.currentActor);
    setState(res.nextState);
    return {
      conflictsDetected: res.conflictsDetected,
      createdEvent: res.createdEvent,
    };
  };

  const handleCorrectOrRetract = (
    targetEventId: string,
    options: { mode: 'correct' | 'retract'; newStatement?: string; reason: string }
  ) => {
    const res = correctOrRetractEvent(state, targetEventId, options, state.currentActor);
    if (!res.error) {
      setState(res.nextState);
    }
    return { error: res.error };
  };

  const handleProposeAction = (proposal: ProposedActionPayload) => {
    const res = proposeAndProcessAction(state, proposal, 'caregiver_manual');
    setState(res.nextState);
    return {
      actionRecord: res.actionRecord,
      wasDuplicate: res.wasDuplicate,
    };
  };

  const handleApproveAction = (actionId: string) => {
    const res = approveAndExecuteAction(state, actionId, state.currentActor);
    setState(res.nextState);
    return { error: res.error };
  };

  const handleRejectAction = (actionId: string) => {
    const res = rejectPendingAction(state, actionId, state.currentActor);
    setState(res.nextState);
    return { error: res.error };
  };

  const handleSimulateToctouScenario = () => {
    setState((prev) => {
      // 1. Ensure caregiver role so retraction & approval attempt run
      const withCaregiver: CaregiverState = { ...prev, currentActor: 'caregiver' };
      // 2. Retract evt_004 (which act_003 depends on)
      const afterRetract = correctOrRetractEvent(
        withCaregiver,
        'evt_004',
        {
          mode: 'retract',
          reason: 'Sarah called back to reschedule visit until 6:00 PM.',
        },
        'caregiver'
      );
      // 3. Attempt to approve act_003 -> triggers TOCTOU block
      const afterApproveAttempt = approveAndExecuteAction(
        afterRetract.nextState,
        'act_003',
        'caregiver'
      );
      return afterApproveAttempt.nextState;
    });
  };

  return (
    <div className="anchorcare-app min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 bg-white border-b border-slate-200">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#companion"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('companion');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-display"
        >
          Engram
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav
          aria-label="Primary Workspace Views"
          className="flex items-center gap-6 text-sm font-medium text-slate-600 overflow-x-auto"
        >
          <a href="/simulation" className="py-1 whitespace-nowrap text-emerald-800 font-semibold">2D judge demo</a>
          <a
            href="#companion"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('companion');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'companion'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Patient Companion
          </a>
          <a
            href="#memory"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('memory');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'memory'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Memory Ledger
          </a>
          <a
            href="#policy"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('policy');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'policy'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Policy & Actions
          </a>
          <a
            href="#codebase"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('codebase');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'codebase'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Python Codebase
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleResetDemo}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Reset browser samples
          </button>
        </div>
      </header>

      {/* Workspace Context & Actor Role Toolbar (Below the Fold) */}
      <details className="workspace-context bg-white border-b border-slate-200 px-6 py-3.5"><summary>Demo profile &amp; caregiver workspace</summary>
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">
              Patient Profile: {state.person.name} (Age {state.person.age})
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{state.person.id}</span>
            <span aria-hidden="true">·</span>
            <span>Sample Memories: <strong className="font-mono tabular-nums text-slate-900">{activeEvents.length}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Conflicts Flagged: <strong className="font-mono tabular-nums text-slate-900">{conflictCount}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Pending Approvals: <strong className="font-mono tabular-nums text-slate-900">{pendingApprovalCount}</strong></span>
          </div>

          {/* Interactive Role Switcher (P0 Security Fix) */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-slate-500">
              Browser sample role:
            </span>
            <div
              role="group"
              aria-label="Select Active Actor Role"
              className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            >
              <button
                type="button"
                onClick={() => handleRoleSwitch('caregiver')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  state.currentActor === 'caregiver'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Caregiver: Sam Rivera
              </button>
              <button
                type="button"
                onClick={() => handleRoleSwitch('patient')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  state.currentActor === 'patient'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Patient: Alex Mercer
              </button>
            </div>
          </div>
        </div>
      </details>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        <button type="button" className="mb-6 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium" onClick={() => setShowMemoryBackend(v => !v)}>{showMemoryBackend ? 'Return to main app' : 'Caregiver memory tools'}</button>
        {showMemoryBackend ? <EngramMemoryView accessKey={memoryAccessKey} onAccessKeyChange={setMemoryAccessKey} /> : <>
        {activeTab === 'companion' && (
          <>
          <AtlasCompanionView accessKey={memoryAccessKey} onAccessKeyChange={setMemoryAccessKey} />
          <details className="mt-8 rounded-xl border p-4"><summary className="cursor-pointer text-sm">Original browser companion demo — separate from Atlas</summary>
          <CompanionView
            state={state}
            watchdogAlerts={watchdogAlerts}
            isAsking={isAsking}
            onAskQuestion={handleAskQuestion}
            onSimulateRepetitiveLoop={handleSimulateRepetitiveLoop}
            onToggleOrientationCard={() =>
              setState((prev) => ({
                ...prev,
                orientationCardVisible: !prev.orientationCardVisible,
              }))
            }
            onNavigateTab={setActiveTab}
          />
          </details>
          </>
        )}

        {activeTab === 'memory' && (
          <>
          <AtlasLedgerView accessKey={memoryAccessKey} onAccessKeyChange={setMemoryAccessKey} />
          <details className="mt-8 rounded-xl border p-4"><summary className="cursor-pointer text-sm">Original browser sample ledger — separate from Atlas</summary>
          <MemoryLedgerView
            state={state}
            onRecordEvent={handleRecordEvent}
            onCorrectOrRetract={handleCorrectOrRetract}
          />
          </details>
          </>
        )}

        {activeTab === 'policy' && (
          <PolicyActionsView
            state={state}
            onProposeAction={handleProposeAction}
            onApproveAction={handleApproveAction}
            onRejectAction={handleRejectAction}
            onSimulateToctouScenario={handleSimulateToctouScenario}
          />
        )}

        {activeTab === 'codebase' && <PythonCodebaseView />}
        </>}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Engram — Hybrid Evidence-Grounded Memory Assistant & Policy Engine Prototype
          </span>
          <span>
            Synthetic Data Only · Original Browser Demo + Server Memory Workspace
          </span>
        </div>
      </footer>
    </div>
  );
}
