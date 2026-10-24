import React, { useState } from 'react';
import {
  ACTION_POLICY_MAP,
  ActionRecord,
  ActionType,
  CaregiverState,
  ExecutionPolicy,
  ProposedActionPayload,
  evaluateActionPolicy,
} from '../lib/caregiverEngine';

interface PolicyActionsViewProps {
  state: CaregiverState;
  onProposeAction: (proposal: ProposedActionPayload) => {
    actionRecord: ActionRecord;
    wasDuplicate: boolean;
  };
  onApproveAction: (actionId: string) => { error?: string };
  onRejectAction: (actionId: string) => { error?: string };
  onSimulateToctouScenario: () => void;
}

export const PolicyActionsView: React.FC<PolicyActionsViewProps> = ({
  state,
  onProposeAction,
  onApproveAction,
  onRejectAction,
  onSimulateToctouScenario,
}) => {
  const [selectedActionType, setSelectedActionType] =
    useState<ActionType>('create_reminder');
  const [summaryInput, setSummaryInput] = useState(
    'Schedule 3:30 PM warm herbal tea and hydration check'
  );
  const [selectedEvidenceId, setSelectedEvidenceId] = useState('evt_005');
  const [simulatorFeedback, setSimulatorFeedback] = useState<{
    tone: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const activeEvents = state.events.filter((e) => e.status === 'active');
  const pendingActions = state.actions.filter(
    (a) => a.status === 'pending_approval'
  );

  const currentPolicyTier = evaluateActionPolicy(selectedActionType);

  const handleProposeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summaryInput.trim()) {
      setSimulatorFeedback({
        tone: 'error',
        message: 'Action summary is required to evaluate policy and idempotency key.',
      });
      return;
    }

    const res = onProposeAction({
      action_type: selectedActionType,
      summary: summaryInput.trim(),
      target_person_id: state.person.id,
      parameters: { triggered_via: 'policy_simulator' },
      supporting_evidence_ids: selectedEvidenceId ? [selectedEvidenceId] : [],
    });

    if (res.wasDuplicate) {
      setSimulatorFeedback({
        tone: 'warning',
        message: `Idempotency Protection Triggered: Duplicate request matched key "${res.actionRecord.idempotency_key.slice(0, 48)}...". Side effect prevented (returned existing ${res.actionRecord.id}).`,
      });
    } else if (res.actionRecord.status === 'blocked_policy') {
      setSimulatorFeedback({
        tone: 'error',
        message: `Policy Gate Blocked (${res.actionRecord.id}): "${selectedActionType}" is PROHIBITED. Logged to audit ledger and routed to human.`,
      });
    } else if (res.actionRecord.status === 'verified') {
      setSimulatorFeedback({
        tone: 'success',
        message: `Tier 1/2 Auto-Executed (${res.actionRecord.id}): "${selectedActionType}" passed deterministic verification immediately.`,
      });
    } else {
      setSimulatorFeedback({
        tone: 'warning',
        message: `Tier 3 Staged (${res.actionRecord.id}): "${selectedActionType}" requires explicit caregiver confirmation before execution.`,
      });
    }
  };

  const handleApproveClick = (actionId: string) => {
    const res = onApproveAction(actionId);
    if (res.error) {
      setSimulatorFeedback({
        tone: 'error',
        message: res.error,
      });
    } else {
      setSimulatorFeedback({
        tone: 'success',
        message: `Approved, executed deterministic handler, and verified outcome for ${actionId}.`,
      });
    }
  };

  const handleRejectClick = (actionId: string) => {
    const res = onRejectAction(actionId);
    if (res.error) {
      setSimulatorFeedback({
        tone: 'error',
        message: res.error,
      });
    } else {
      setSimulatorFeedback({
        tone: 'warning',
        message: `Declined pending action ${actionId}.`,
      });
    }
  };

  return (
    <div className="space-y-8">
      {simulatorFeedback && (
        <div
          role="status"
          className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between gap-4 ${
            simulatorFeedback.tone === 'error'
              ? 'bg-red-50 border-red-200 text-red-950'
              : simulatorFeedback.tone === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-emerald-50 border-emerald-200 text-emerald-950'
          }`}
        >
          <span>{simulatorFeedback.message}</span>
          <button
            type="button"
            onClick={() => setSimulatorFeedback(null)}
            className="text-xs underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Split: Left = Pending Caregiver Approvals + TOCTOU Guard Test, Right = Interactive Policy & Idempotency Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Pending Caregiver Confirmation Queue */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Pending Caregiver Approvals ({pendingActions.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Tier 3 actions proposed by Gemini 4 Argon awaiting human verification
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onSimulateToctouScenario();
                setSimulatorFeedback({
                  tone: 'error',
                  message:
                    'TOCTOU Simulation: Retracted supporting event evt_004 ("Sarah visit") and attempted to approve act_003. Execution blocked with status="blocked_toctou"!',
                });
              }}
              className="px-3 py-1.5 text-xs font-medium text-red-900 bg-red-100 hover:bg-red-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Simulate TOCTOU Stale-Evidence Block
            </button>
          </div>

          {state.currentActor === 'patient' && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-950">
              <strong>Role Lock Active:</strong> You are viewing as{' '}
              <strong>Patient (Alex Mercer)</strong>. Approval buttons are locked so a patient cannot self-authorize side effects. Switch to Caregiver in the toolbar to approve.
            </div>
          )}

          {pendingActions.length === 0 ? (
            <div className="py-6 text-center border-t border-slate-100 space-y-1">
              <p className="text-sm font-medium text-slate-700">
                No actions awaiting approval
              </p>
              <p className="text-xs text-slate-500">
                Use the Policy Simulator on the right to stage a new Tier 3 action.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {pendingActions.map((act) => (
                <div key={act.id} className="py-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 font-mono tabular-nums">
                    <span>
                      <strong className="text-slate-900">{act.id}</strong> · {act.action_type} ·{' '}
                      {act.policy_tier.toUpperCase()}
                    </span>
                    <span>
                      Evidence: [{act.supporting_evidence_ids.join(', ') || 'None'}]
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-slate-900">{act.summary}</p>

                  <p className="text-xs text-slate-500 font-mono truncate">
                    Idempotency Key: {act.idempotency_key}
                  </p>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleApproveClick(act.id)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Approve & Execute {act.id}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectClick(act.id)}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Decline {act.id}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Interactive Policy Gate & Idempotency Simulator */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Policy Gate & Idempotency Test Bench (TypeScript demo)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Test how the browser engine routes proposed intents across Auto-Execute, Approval, and Prohibited rules
            </p>
          </div>

          <form onSubmit={handleProposeSubmit} className="space-y-4" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="action-type-select"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Proposed Action Type
                </label>
                <select
                  id="action-type-select"
                  value={selectedActionType}
                  onChange={(e) => setSelectedActionType(e.target.value as ActionType)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                >
                  <optgroup label="Tier 3 — Require Human Approval">
                    <option value="create_reminder">create_reminder</option>
                    <option value="draft_family_message">draft_family_message</option>
                    <option value="mark_routine_completed">mark_routine_completed</option>
                  </optgroup>
                  <optgroup label="Tier 1/2 — Autonomous Allowlist">
                    <option value="show_orientation_card">show_orientation_card</option>
                    <option value="flag_memory_conflict">flag_memory_conflict</option>
                    <option value="alert_caregiver_loop_detected">alert_caregiver_loop_detected</option>
                  </optgroup>
                  <optgroup label="Prohibited — High-Consequence Blocklist">
                    <option value="change_medication_dose">change_medication_dose</option>
                    <option value="unlock_door">unlock_door</option>
                    <option value="contact_emergency_services">contact_emergency_services</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label
                  htmlFor="supporting-evidence-select"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Supporting Evidence ID
                </label>
                <select
                  id="supporting-evidence-select"
                  value={selectedEvidenceId}
                  onChange={(e) => setSelectedEvidenceId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                >
                  {activeEvents.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.id} — {ev.statement.slice(0, 38)}...
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="action-summary-input"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Action Intent Summary
              </label>
              <input
                id="action-summary-input"
                type="text"
                value={summaryInput}
                onChange={(e) => setSummaryInput(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <span className="text-xs text-slate-600 font-mono">
                Policy Classification:{' '}
                <strong
                  className={
                    currentPolicyTier === ExecutionPolicy.PROHIBITED
                      ? 'text-red-700'
                      : currentPolicyTier === ExecutionPolicy.REQUIRE_APPROVAL
                      ? 'text-amber-800'
                      : 'text-emerald-700'
                  }
                >
                  {currentPolicyTier.toUpperCase()}
                </strong>
              </span>

              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Submit Proposal to Policy Gate
              </button>
            </div>
          </form>

          {/* Policy Matrix Reference — Clean 2-Column Unboxed Hairline List */}
          <div className="pt-3 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-700 mb-2">
              Allowlist & Blocklist Matrix (ACTION_POLICY_MAP):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 divide-y divide-slate-100 text-xs font-mono">
              {(Object.entries(ACTION_POLICY_MAP) as [ActionType, ExecutionPolicy][]).map(
                ([type, policy]) => (
                  <div
                    key={type}
                    className="py-1.5 flex items-center justify-between gap-2"
                  >
                    <span className="text-slate-800">{type}</span>
                    <span
                      className={`font-semibold shrink-0 ${
                        policy === ExecutionPolicy.PROHIBITED
                          ? 'text-red-700'
                          : policy === ExecutionPolicy.REQUIRE_APPROVAL
                          ? 'text-amber-800'
                          : 'text-emerald-700'
                      }`}
                    >
                      {policy}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Action Ledger Table */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Deterministic Action Ledger (actions Collection)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tracks separate states: pending_approval, verified, rejected, blocked_policy, and blocked_toctou
          </p>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-2.5 px-3.5">Action ID</th>
                <th className="py-2.5 px-3.5">Action Type & Tier</th>
                <th className="py-2.5 px-3.5">Summary & Verification Outcome</th>
                <th className="py-2.5 px-3.5">Evidence IDs</th>
                <th className="py-2.5 px-3.5 text-right">Terminal Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {state.actions.map((act) => (
                <tr key={act.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-3.5 font-mono tabular-nums font-semibold text-slate-900 align-top whitespace-nowrap">
                    {act.id}
                  </td>
                  <td className="py-3 px-3.5 font-mono align-top whitespace-nowrap">
                    <div className="text-slate-900 font-medium">{act.action_type}</div>
                    <div className="text-slate-500">{act.policy_tier}</div>
                  </td>
                  <td className="py-3 px-3.5 align-top space-y-1 max-w-lg">
                    <p className="text-sm font-medium text-slate-900">{act.summary}</p>
                    <p className="text-xs text-slate-600">{act.verification_note}</p>
                  </td>
                  <td className="py-3 px-3.5 font-mono tabular-nums text-slate-600 align-top whitespace-nowrap">
                    {act.supporting_evidence_ids.join(', ') || 'None'}
                  </td>
                  <td className="py-3 px-3.5 font-mono text-right align-top whitespace-nowrap">
                    <span
                      className={`font-semibold ${
                        act.status === 'verified'
                          ? 'text-emerald-700'
                          : act.status === 'pending_approval'
                          ? 'text-amber-700'
                          : 'text-red-700'
                      }`}
                    >
                      {act.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Append-Only Audit Log */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Append-Only Governance Audit Trail (audit_logs Collection)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable chronological log of every event entry, memory correction, citation rejection, and policy decision
          </p>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-2.5 px-3.5">Audit ID</th>
                <th className="py-2.5 px-3.5">Timestamp (UTC)</th>
                <th className="py-2.5 px-3.5">Actor & Role</th>
                <th className="py-2.5 px-3.5">Operation</th>
                <th className="py-2.5 px-3.5">Target & Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {state.auditLog.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/80">
                  <td className="py-2.5 px-3.5 font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                    {entry.id}
                  </td>
                  <td className="py-2.5 px-3.5 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                    {entry.timestamp.slice(0, 19).replace('T', ' ')}
                  </td>
                  <td className="py-2.5 px-3.5 whitespace-nowrap">
                    <span className="font-medium text-slate-900">{entry.actor}</span>
                    <span className="text-slate-500"> · {entry.actor_role}</span>
                  </td>
                  <td className="py-2.5 px-3.5 font-mono font-semibold text-slate-800 whitespace-nowrap">
                    {entry.operation}
                  </td>
                  <td className="py-2.5 px-3.5 text-slate-700">
                    <span className="font-mono text-slate-500 mr-2">[{entry.target_id}]</span>
                    {entry.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
