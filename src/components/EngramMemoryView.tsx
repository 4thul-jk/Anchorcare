import React, { useEffect, useRef, useState } from 'react';

export function EngramMemoryView({ accessKey, onAccessKeyChange }: { accessKey?: string; onAccessKeyChange?: (value: string) => void }) {
  const [localKey, setLocalKey] = useState('');
  const key = accessKey ?? localKey;
  const setKey = onAccessKeyChange ?? setLocalKey;
  const [session, setSession] = useState<any>(null);
  const [question, setQuestion] = useState('What was recorded about the brass compass?');
  const [report, setReport] = useState('FICTIONAL report: I put the brass compass on the desk.');
  const [lastEpisode, setLastEpisode] = useState('');
  const [lastPlan, setLastPlan] = useState('');
  const [result, setResult] = useState<any>(null);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const polling = useRef(false);

  async function api(path: string, payload?: any, signal?: AbortSignal) {
    const response = await fetch(`/api/engram${path}`, {
      method: payload === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AnchorCare-Key': key },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }), signal
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Memory service unavailable');
    return data;
  }
  async function act(task: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await task(); } catch (e) { setError(e instanceof Error ? e.message : 'Request failed'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (!session) return;
    const stop = new AbortController();
    const poll = async () => {
      if (polling.current) return;
      polling.current = true;
      try {
        const data = await api('/prompts', undefined, stop.signal);
        if (!stop.signal.aborted) setPrompts(data.prompts);
      } catch { if (!stop.signal.aborted) setError('Reminder connection unavailable. No delivery is confirmed.'); }
      finally { polling.current = false; }
    };
    void poll(); const timer = setInterval(poll, 3000);
    return () => { stop.abort(); clearInterval(timer); };
  }, [session, key]);

  const button = 'rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40';
  const field = 'w-full rounded-lg border border-slate-300 p-3 text-sm';
  return <section className="space-y-6">
    <div><h1 className="text-2xl font-semibold">Persistent memory and reminders</h1>
      <p className="text-slate-600 mt-2">Synthetic-data workspace connected to the server memory service. The original demo ledger remains a separate browser-based view.</p></div>
    <form className="flex gap-3" onSubmit={e => { e.preventDefault(); void act(async () => { setSession(await api('/status')); }); }}>
      <input className={field} type="password" aria-label="Memory access key" placeholder="Enter memory access key" value={key} onChange={e => { setKey(e.target.value); setSession(null); setResult(null); setPrompts([]); }} autoComplete="off" />
      <button className={button} disabled={busy || !key}>Connect</button>
    </form>
    {session && <p role="status">Storage: <strong>{session.mode === 'mongodb' ? 'MongoDB Atlas' : 'Local in-memory test'}</strong> · Patient: {session.patient_id} · Access: {session.actor} · Gemini: {session.geminiConfigured ? 'configured; live access not yet confirmed' : 'not configured—evidence display only'}</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-blue-50 p-4 text-blue-900">{message}</p>}
    {session && <>
      <form className="rounded-xl bg-white border p-5 space-y-3" onSubmit={e => { e.preventDefault(); void act(async () => {
        setResult(await api('/answer', { query: question }));
      }); }}>
        <h2 className="font-semibold">Ask from saved evidence</h2>
        <input className={field} aria-label="Memory question" value={question} onChange={e => setQuestion(e.target.value)} />
        <button className={button} disabled={busy || !question.trim()}>Retrieve and answer</button>
      </form>
      {result && <div className="space-y-4">
        <p className="rounded-xl bg-white border p-5">{result.answer || result.message}</p>
        {result.context?.warnings?.map((w: string, i: number) => <p key={i} className="text-amber-800">{w}</p>)}
        <div className="grid md:grid-cols-2 gap-4">{Object.entries(result.context?.sections || {}).map(([name, section]: [string, any]) => <section key={name} className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold">{{ episodes: 'Past events', daily_logs: 'Daily reports', personal_records: 'Personal information', plans: 'Scheduled intentions' }[name]} · {section.status}</h3>
          {section.records.map((r: any) => <div key={r.id || r._id} className="border-t mt-3 pt-3 text-sm">
            <p>{r.gist || r.originalText || `${r.kind} scheduled for ${r.eventStart}`}</p>
            <p className="text-slate-500 mt-1">{r.start || r.occurredAt || r.recordedAt || r.eventStart}</p>
            {r.evidence?.map((s: any) => <p key={s.id} className="mt-1">Source ({s.source_type}): {s.text || 'Uninspected media reference'}</p>)}
            {r.sourceType && <p className="text-slate-500">Source: {r.sourceType} · {r.outcome || 'personal report'}</p>}
          </div>)}
          {!section.records.length && <p className="text-sm text-slate-500 mt-2">{section.status === 'unavailable' ? 'Could not check this section.' : 'No records returned within this selection.'}</p>}
        </section>)}</div>
      </div>}
      {session.actor === 'caregiver' && <div className="grid md:grid-cols-2 gap-4">
        <section className="rounded-xl bg-white border p-5 space-y-3">
          <h2 className="font-semibold">Record and review an event</h2>
          <textarea aria-label="Original report" className={field} value={report} onChange={e => setReport(e.target.value)} />
          <button className={button} disabled={busy || !report.trim()} onClick={() => void act(async () => {
            const id = `anchor_${crypto.randomUUID()}`;
            await api('/episodes', { id, start: new Date(Date.now() - 1000).toISOString(), people: [], gist: report, status: 'auto', evidence: { text: report, source_type: 'caregiver_report' } });
            setLastEpisode(id); setMessage('Draft saved. It is excluded from patient recall until you approve it.');
          })}>Save draft report</button>
          {lastEpisode && <div className="flex gap-2"><button className={button} disabled={busy} onClick={() => void act(async () => {
            await api('/episodes/review', { id: lastEpisode, status: 'carer_verified' }); setMessage('Record approved. Atlas search indexing may take a short time.');
          })}>Approve saved report</button><button className={button} disabled={busy} onClick={() => void act(async () => {
            await api('/episodes/review', { id: lastEpisode, status: 'auto' }); setMessage('Approval withdrawn. The record is excluded from recall.');
          })}>Withdraw approval</button></div>}
        </section>
        <section className="rounded-xl bg-white border p-5 space-y-3">
          <h2 className="font-semibold">Approve a fictional photo-album reminder</h2>
          <p className="text-sm text-slate-600">Schedules in 15 seconds. Quiet hours, expiry and cooldown still apply.</p>
          <button className={button} disabled={busy} onClick={() => void act(async () => {
            const now = Date.now(); const id = `album_${crypto.randomUUID()}`;
            await api('/plans', { id, kind: 'photo_album', status: 'carer_verified', trigger_type: 'time', due_at: new Date(now + 15000).toISOString(), event_start: new Date(now + 15000).toISOString(), expires_at: new Date(now + 180000).toISOString() });
            setLastPlan(id); setMessage('Approved plan saved. This does not confirm the activity happened.');
          })}>Approve reminder</button>
          {lastPlan && <button className={button} disabled={busy} onClick={() => void act(async () => {
            await api('/plans/cancel', { plan_id: lastPlan }); setLastPlan(''); setPrompts([]); setMessage('Plan cancelled.');
          })}>Cancel reminder</button>}
        </section>
      </div>}
      <section className="rounded-xl bg-white border p-5 space-y-3"><h2 className="font-semibold">Current reminders</h2>
        {!prompts.length && <p className="text-sm text-slate-500">No deliverable prompts returned. Quiet hours or cooldown may apply.</p>}
        {prompts.map(p => <div key={p._id} className="border-t pt-3"><p>{p.message}</p><div className="flex gap-2 mt-2">{['acknowledged', 'snoozed', 'dismissed'].map(action => <button key={action} className={button} disabled={busy} onClick={() => void act(async () => {
          await api('/prompts/respond', { prompt_id: p._id, action }); setPrompts(previous => previous.filter(item => item._id !== p._id));
        })}>{action === 'acknowledged' ? 'Okay' : action === 'snoozed' ? 'Snooze one minute' : 'Dismiss'}</button>)}</div></div>)}
      </section>
    </>}
  </section>;
}
