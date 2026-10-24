import React, { useState } from 'react';

export function AtlasLedgerView({ accessKey, onAccessKeyChange }: { accessKey: string; onAccessKeyChange: (key: string) => void }) {
  const [session, setSession] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [statement, setStatement] = useState('');
  const [sourceType, setSourceType] = useState('caregiver_report');
  const [search, setSearch] = useState('');
  const [showHistory, setShowHistory] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [replacement, setReplacement] = useState('');
  const [reason, setReason] = useState('');
  const [truncated, setTruncated] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<any>(null);
  async function api(path: string, payload?: any) {
    const response = await fetch(`/api/engram${path}`, { method: payload === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AnchorCare-Key': accessKey },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }), signal: AbortSignal.timeout(30000) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Ledger service unavailable');
    return data;
  }
  async function reload() {
    const status = await api('/status');
    const ledger = await api('/ledger');
    setSession(status); setRecords(ledger.records); setTruncated(ledger.truncated);
  }
  async function run(task: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : 'Operation failed'); }
    finally { setBusy(false); }
  }
  async function review(id: string, status: string) {
    await api('/episodes/review', { id, status }); await reload();
    setMessage(status === 'carer_verified' ? 'Approved for patient recall.' : 'Approval withdrawn; excluded from recall.');
  }
  const field = 'w-full rounded-lg border border-slate-300 bg-white p-3 text-sm';
  const button = 'rounded-lg bg-slate-900 text-white px-4 py-2 text-sm disabled:opacity-40';
  const visible = records.filter(r => (showHistory || r.isCurrent) && (!search || `${r.summary} ${r.id}`.toLowerCase().includes(search.toLowerCase())));
  return <section className="space-y-5">
    <div><h1 className="text-2xl font-semibold">Memory Ledger</h1><p className="mt-2 text-slate-600">Saved source reports, caregiver review and correction history. Entries here are loaded from the server, not browser sample data.</p></div>
    <form className="flex gap-3" onSubmit={e => { e.preventDefault(); void run(reload); }}>
      <input type="password" aria-label="Ledger access key" placeholder="Caregiver or patient memory access key" className={field} value={accessKey} disabled={busy} autoComplete="off" onChange={e => { onAccessKeyChange(e.target.value); setSession(null); setRecords([]); setPendingDraft(null); }} />
      <button className={button} disabled={busy || !accessKey}>Load ledger</button>
    </form>
    {session && <p role="status">Storage: <strong>{session.mode === 'mongodb' ? 'MongoDB Atlas' : 'Local in-memory test'}</strong> · Patient: {session.patient_id} · Server access: {session.actor}</p>}
    {error && <p role="alert" className="bg-red-50 text-red-800 p-4 rounded-lg">{error}</p>}
    {message && <p role="status" className="bg-blue-50 text-blue-900 p-4 rounded-lg">{message}</p>}
    {session?.actor === 'caregiver' && <form className="rounded-xl border bg-white p-5 space-y-3" onSubmit={e => { e.preventDefault(); void run(async () => {
      // Keep the same payload/ID if a response is lost; retry cannot duplicate it.
      const draft = pendingDraft || { id: `ledger_${crypto.randomUUID()}`, start: new Date(Date.now() - 1000).toISOString(),
        people: [], status: 'auto', gist: statement.trim(), evidence: { text: statement.trim(), source_type: sourceType } };
      setPendingDraft(draft); await api('/episodes', draft); setPendingDraft(null); setStatement(''); await reload();
      setMessage('Draft saved with original source text. Review it before approval.');
    }); }}>
      <h2 className="font-semibold">Add a source report</h2>
      <textarea aria-label="Event source report" className={field} value={statement} disabled={busy || Boolean(pendingDraft)} onChange={e => setStatement(e.target.value)} placeholder="Enter the original caregiver note, patient report or transcript." />
      <label className="block text-sm">Original source<select className={field} aria-label="Event source type" value={sourceType} disabled={busy || Boolean(pendingDraft)} onChange={e => setSourceType(e.target.value)}>
        <option value="caregiver_report">Caregiver report</option><option value="user_report">Patient self-report</option><option value="recording_transcript">Recording transcript</option>
      </select></label>
      <p className="text-sm text-slate-500">Logged as a past report at the current time. Review does not prove the activity occurred. Future activities belong in plans.</p>
      <button className={button} disabled={busy || (!pendingDraft && !statement.trim())}>{pendingDraft ? 'Retry saving same draft' : 'Save draft'}</button>
    </form>}
    {session && <>
      <div className="flex gap-3 items-center"><input className={field} aria-label="Filter saved records" placeholder="Filter the loaded records" value={search} onChange={e => setSearch(e.target.value)} />
        <button className={button} disabled={busy} onClick={() => void run(reload)}>Refresh</button></div>
      {session.actor === 'caregiver' && <label className="text-sm flex gap-2"><input type="checkbox" checked={showHistory} onChange={e => setShowHistory(e.target.checked)} />Include superseded and retracted history</label>}
      {truncated && <p className="text-amber-800">Showing the most recent 200 records. This is not the complete history.</p>}
      {!visible.length && <p className="rounded-xl border bg-white p-5">No records returned for this view. Browser sample records have not been imported.</p>}
      {visible.map(record => <article key={record.id} className="rounded-xl border bg-white p-5 space-y-3">
        <div className="text-sm text-slate-500">{record.id} · {record.isCurrent ? record.reviewStatus === 'approved' ? 'Approved for recall' : 'Draft—excluded from recall' : record.supersededBy ? 'Superseded—history only' : 'Retracted—history only'}</div>
        <p className="text-lg">{record.summary}</p>
        <p className="text-sm text-slate-500">Event: {new Date(record.occurredAt).toLocaleString()} · Saved: {new Date(record.recordedAt).toLocaleString()}</p>
        {record.sources.map((source: any) => <blockquote key={source.id} className="border-l-2 pl-3 text-sm"><strong>{source.sourceType}</strong>: {source.content || 'Uninspected media reference'}</blockquote>)}
        {record.supersedes && <p className="text-sm">Replaces: {record.supersedes}</p>}
        {record.supersededBy && <p className="text-sm">Replaced by: {record.supersededBy}</p>}
        {(record.retractionReason || record.correctionReason) && <p className="text-sm">Reason: {record.retractionReason || record.correctionReason}</p>}
        {session.actor === 'caregiver' && record.isCurrent && <div className="flex flex-wrap gap-2">
          <button className={button} disabled={busy} onClick={() => void run(() => review(record.id, record.reviewStatus === 'approved' ? 'auto' : 'carer_verified'))}>{record.reviewStatus === 'approved' ? 'Withdraw approval' : 'Approve report'}</button>
          {['correct', 'retract'].map(mode => <button key={mode} className={button} disabled={busy} onClick={() => { setEditing({ record, mode }); setReplacement(record.summary); setReason(''); }}>{mode === 'correct' ? 'Correct with history' : 'Retract'}</button>)}
        </div>}
      </article>)}
    </>}
    {editing && <form className="rounded-xl border-2 border-blue-500 bg-white p-5 space-y-3" onSubmit={e => { e.preventDefault(); void run(async () => {
      await api('/ledger/change', { id: editing.record.id, mode: editing.mode, statement: replacement, reason });
      setEditing(null); await reload(); setMessage(editing.mode === 'correct' ? 'Original preserved; replacement saved as a draft. Review and approve it separately.' : 'Record retracted and retained in history.');
    }); }}>
      <h2 className="font-semibold">{editing.mode === 'correct' ? 'Correct report' : 'Retract report'}: {editing.record.id}</h2>
      {editing.mode === 'correct' && <textarea className={field} aria-label="Replacement report" value={replacement} onChange={e => setReplacement(e.target.value)} />}
      <input className={field} aria-label="Correction reason" placeholder="Why is this being changed?" value={reason} onChange={e => setReason(e.target.value)} />
      <button className={button} disabled={busy || !reason.trim() || (editing.mode === 'correct' && !replacement.trim())}>Confirm {editing.mode === 'correct' ? 'correction as draft' : 'retraction'}</button>
      <button className="ml-3 text-sm underline" type="button" disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
    </form>}
  </section>;
}
