import React, { useState } from 'react';
import {
  CaregiverState,
  EpistemicStatus,
  EventType,
  MemoryEvent,
  NewEventInput,
  buildPromptAliases,
  isFactGroundedInActiveEvents,
} from '../lib/caregiverEngine';

interface MemoryLedgerViewProps {
  state: CaregiverState;
  onRecordEvent: (input: NewEventInput) => { conflictsDetected: string[]; createdEvent: MemoryEvent };
  onCorrectOrRetract: (
    targetEventId: string,
    options: { mode: 'correct' | 'retract'; newStatement?: string; reason: string }
  ) => { error?: string };
}

export const MemoryLedgerView: React.FC<MemoryLedgerViewProps> = ({
  state,
  onRecordEvent,
  onCorrectOrRetract,
}) => {
  const [eventType, setEventType] = useState<EventType>('meal_hydration');
  const [epistemicStatus, setEpistemicStatus] = useState<EpistemicStatus>('observed');
  const [statement, setStatement] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);

  // Filters
  const [showHistorical, setShowHistorical] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Correction / Retraction inline modal state
  const [editingEvent, setEditingEvent] = useState<MemoryEvent | null>(null);
  const [editMode, setEditMode] = useState<'correct' | 'retract'>('correct');
  const [replacementStatement, setReplacementStatement] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  const activeEvents = state.events.filter((e) => e.status === 'active');
  const aliasMap = buildPromptAliases(activeEvents);

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!statement.trim()) {
      setFormError('Event statement is required and cannot be blank.');
      return;
    }
    setFormError(null);

    const res = onRecordEvent({
      event_type: eventType,
      epistemic_status: epistemicStatus,
      statement: statement.trim(),
    });

    setStatement('');
    if (res.conflictsDetected.length > 0) {
      setFeedbackBanner({
        type: 'warning',
        text: `Recorded ${res.createdEvent.id}. Tier 1 Autonomous Contradiction Auditor detected conflict with [${res.conflictsDetected.join(', ')}] and auto-executed flag_memory_conflict!`,
      });
    } else {
      setFeedbackBanner({
        type: 'success',
        text: `Recorded event ${res.createdEvent.id} (${res.createdEvent.epistemic_status}, confidence ${res.createdEvent.confidence.toFixed(2)}).`,
      });
    }
  };

  const handleLoadConflictPreset = () => {
    setEventType('meal_hydration');
    setEpistemicStatus('reported');
    setStatement('Alex refused lunch today and had nothing to eat at 12:30 PM.');
    setFormError(null);
  };

  const openCorrectionDrawer = (evt: MemoryEvent, mode: 'correct' | 'retract') => {
    setEditingEvent(evt);
    setEditMode(mode);
    setReplacementStatement(evt.statement);
    setCorrectionReason('');
    setCorrectionError(null);
  };

  const handleConfirmCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    if (!correctionReason.trim()) {
      setCorrectionError('Please provide an audit reason for correcting or retracting this record.');
      return;
    }
    if (editMode === 'correct' && !replacementStatement.trim()) {
      setCorrectionError('Replacement statement cannot be empty.');
      return;
    }

    const result = onCorrectOrRetract(editingEvent.id, {
      mode: editMode,
      newStatement: replacementStatement.trim(),
      reason: correctionReason.trim(),
    });

    if (result.error) {
      setCorrectionError(result.error);
      return;
    }

    setFeedbackBanner({
      type: 'success',
      text:
        editMode === 'correct'
          ? `Atomically superseded ${editingEvent.id} and linked new active record. Original preserved in audit history.`
          : `Retracted ${editingEvent.id}. Record excluded from active retrieval while preserving audit trail.`,
    });
    setEditingEvent(null);
  };

  const filteredEvents = state.events.filter((evt) => {
    if (!showHistorical && evt.status !== 'active') return false;
    if (categoryFilter !== 'all' && evt.event_type !== categoryFilter) return false;
    if (
      searchQuery.trim() &&
      !evt.statement.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !evt.id.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-8">
      {feedbackBanner && (
        <div
          role="status"
          className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between gap-4 ${
            feedbackBanner.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : feedbackBanner.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-950'
              : 'bg-emerald-50 border-emerald-200 text-emerald-950'
          }`}
        >
          <span>{feedbackBanner.text}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-xs underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Split: Left = Log New Event Form, Right = Non-Destructive Correction Drawer or Derived Facts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Record Evidence-Grounded Event
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {state.currentActor === 'patient'
                  ? 'Patient Mode active: Entries are automatically tagged as patient_self_report (reported, confidence 0.70).'
                  : 'Caregiver Mode active: Entries are logged with full provenance and checked by the Autonomous Contradiction Auditor.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLoadConflictPreset}
              className="px-3 py-1.5 text-xs font-medium text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Load Contradictory Lunch Preset
            </button>
          </div>

          <form onSubmit={handleCreateEvent} className="space-y-4" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="event-type-select"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Event Category
                </label>
                <select
                  id="event-type-select"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value as EventType)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                >
                  <option value="meal_hydration">meal_hydration (Meals & Fluids)</option>
                  <option value="medication_routine">medication_routine (Medication)</option>
                  <option value="family_visit">family_visit (Family & Calls)</option>
                  <option value="daily_activity">daily_activity (Walks & Routines)</option>
                  <option value="mood_observation">mood_observation (Mood & Comfort)</option>
                  <option value="safety_check">safety_check (Safety Check)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="epistemic-status-select"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Epistemic Status
                </label>
                <select
                  id="epistemic-status-select"
                  value={state.currentActor === 'patient' ? 'reported' : epistemicStatus}
                  disabled={state.currentActor === 'patient'}
                  onChange={(e) => setEpistemicStatus(e.target.value as EpistemicStatus)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900 disabled:opacity-60"
                >
                  <option value="observed">observed (Directly witnessed)</option>
                  <option value="reported">reported (Second-hand / Self-report)</option>
                  <option value="inferred">inferred (Derived inference)</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="event-statement-input"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Event Statement
              </label>
              <textarea
                id="event-statement-input"
                rows={3}
                value={statement}
                onChange={(e) => {
                  setStatement(e.target.value);
                  if (formError) setFormError(null);
                }}
                placeholder="Describe what was observed or reported (e.g., Alex drank a full glass of water at 2:15 PM)..."
                className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
              />
              {formError && (
                <p role="alert" className="text-xs font-medium text-red-600 mt-1">
                  {formError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end">
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Record Event to Persistent Memory
              </button>
            </div>
          </form>
        </section>

        {/* Right Panel: Either Active Correction Drawer OR Derived Facts & Cascading Validity */}
        <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          {editingEvent ? (
            <form onSubmit={handleConfirmCorrection} className="space-y-4" noValidate>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editMode === 'correct'
                      ? `Supersede & Correct Record (${editingEvent.id})`
                      : `Retract Record (${editingEvent.id})`}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Original record is never overwritten; it will be marked {editMode === 'correct' ? 'superseded' : 'retracted'}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                <p className="text-slate-500 font-mono">
                  Original ({editingEvent.id} · {editingEvent.epistemic_status}):
                </p>
                <p className="font-medium text-slate-800">"{editingEvent.statement}"</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditMode('correct')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                    editMode === 'correct'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Supersede with Correction
                </button>
                <button
                  type="button"
                  onClick={() => setEditMode('retract')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                    editMode === 'retract'
                      ? 'bg-red-700 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  Retract Completely
                </button>
              </div>

              {editMode === 'correct' && (
                <div>
                  <label
                    htmlFor="replacement-statement-input"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Corrected Statement
                  </label>
                  <textarea
                    id="replacement-statement-input"
                    rows={2}
                    value={replacementStatement}
                    onChange={(e) => setReplacementStatement(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="correction-reason-input"
                  className="block text-xs font-medium text-slate-700 mb-1"
                >
                  Mandatory Audit Reason
                </label>
                <input
                  id="correction-reason-input"
                  type="text"
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="e.g., Clarified portion size with midday nurse..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              {correctionError && (
                <p role="alert" className="text-xs font-medium text-red-600">
                  {correctionError}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {editMode === 'correct'
                    ? 'Commit Atomic Correction'
                    : 'Commit Retraction'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Derived Facts & Cascading Provenance (facts Collection)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Each derived fact is linked to supporting event IDs. Retracting all supporting events automatically invalidates the fact.
                </p>
              </div>

              <div className="divide-y divide-slate-100 border-t border-slate-100">
                {state.facts.map((fact) => {
                  const isGrounded = isFactGroundedInActiveEvents(fact, state.events);
                  return (
                    <div key={fact.id} className="py-3 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2 text-slate-500 font-mono tabular-nums">
                        <span>
                          <strong className="text-slate-900">{fact.id}</strong> · {fact.category} ·{' '}
                          {fact.epistemic_status}
                        </span>
                        <span
                          className={
                            isGrounded
                              ? 'text-emerald-700 font-semibold'
                              : 'text-red-600 font-semibold'
                          }
                        >
                          {isGrounded
                            ? `Grounded in [${fact.supporting_event_ids.join(', ')}]`
                            : `Orphaned (Source Retracted)`}
                        </span>
                      </div>
                      <p
                        className={`text-sm ${
                          isGrounded
                            ? 'text-slate-900 font-medium'
                            : 'text-slate-400 line-through'
                        }`}
                      >
                        {fact.statement}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Persistent Events Table */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Persistent Event Memory Ledger (events Collection)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing {filteredEvents.length} of {state.events.length} total records · Active records receive [E1..En] prompt aliases
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              aria-label="Search memory events"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search statement or ID..."
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
            />

            <select
              aria-label="Filter by event category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
            >
              <option value="all">All Categories</option>
              <option value="meal_hydration">meal_hydration</option>
              <option value="medication_routine">medication_routine</option>
              <option value="family_visit">family_visit</option>
              <option value="daily_activity">daily_activity</option>
              <option value="mood_observation">mood_observation</option>
              <option value="safety_check">safety_check</option>
            </select>

            <button
              type="button"
              onClick={() => setShowHistorical((prev) => !prev)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                showHistorical
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {showHistorical ? 'Showing All History' : 'Active Records Only'}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                <th className="py-2.5 px-3.5">ID / Alias</th>
                <th className="py-2.5 px-3.5">Status & Provenance</th>
                <th className="py-2.5 px-3.5">Statement & Audit Links</th>
                <th className="py-2.5 px-3.5 text-right">Occurred (UTC)</th>
                <th className="py-2.5 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredEvents.map((evt) => {
                const alias = aliasMap.eventIdToAlias[evt.id];
                const isConflict = evt.conflict_with_ids.length > 0;
                return (
                  <tr
                    key={evt.id}
                    className={`hover:bg-slate-50/80 ${
                      evt.status !== 'active' ? 'bg-slate-50/50 text-slate-400' : ''
                    }`}
                  >
                    <td className="py-3 px-3.5 font-mono tabular-nums align-top whitespace-nowrap">
                      <span className="font-semibold text-slate-900">{evt.id}</span>
                      {alias && (
                        <span className="ml-1.5 text-slate-500">[{alias}]</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 align-top whitespace-nowrap">
                      <div className="font-medium text-slate-800">
                        {evt.status.toUpperCase()} · {evt.epistemic_status}
                      </div>
                      <div className="text-slate-500 font-mono tabular-nums">
                        {evt.event_type} · Conf {evt.confidence.toFixed(2)}
                      </div>
                      <div className="text-slate-500">{evt.source.author}</div>
                    </td>
                    <td className="py-3 px-3.5 align-top max-w-md space-y-1">
                      <p
                        className={`text-sm ${
                          evt.status === 'active'
                            ? 'text-slate-900 font-medium'
                            : 'line-through text-slate-400'
                        }`}
                      >
                        {evt.statement}
                      </p>
                      {evt.supersedes && (
                        <p className="text-xs text-emerald-700 font-mono">
                          Supersedes {evt.supersedes} ({evt.retraction_reason})
                        </p>
                      )}
                      {evt.superseded_by && (
                        <p className="text-xs text-slate-500 font-mono">
                          Superseded by {evt.superseded_by} ({evt.retraction_reason})
                        </p>
                      )}
                      {evt.status === 'retracted' && evt.retraction_reason && (
                        <p className="text-xs text-red-700 font-mono">
                          Retracted: {evt.retraction_reason}
                        </p>
                      )}
                      {isConflict && (
                        <p className="text-xs font-semibold text-amber-800 font-mono">
                          CONFLICTS WITH: [{evt.conflict_with_ids.join(', ')}]
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3.5 font-mono tabular-nums text-right align-top whitespace-nowrap text-slate-600">
                      {evt.occurred_at.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="py-3 px-3.5 text-right align-top whitespace-nowrap">
                      {evt.status === 'active' ? (
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openCorrectionDrawer(evt, 'correct')}
                            className="px-2.5 py-1 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                          >
                            Correct / Retract {evt.id}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono">Archived</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
