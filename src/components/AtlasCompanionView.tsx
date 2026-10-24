import React, { useEffect, useRef, useState } from 'react';
import { memoryApi } from '../lib/memoryApi';

export function AtlasCompanionView({ accessKey, onAccessKeyChange }: { accessKey: string; onAccessKeyChange: (value: string) => void }) {
  const [session, setSession] = useState<any>(null);
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<any>(null);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [reminderError, setReminderError] = useState('');
  const [busy, setBusy] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const version = useRef(0);
  useEffect(() => {
    version.current++; activeRequest.current?.abort(); setSession(null); setResult(null); setPrompts([]);
    return () => { version.current++; activeRequest.current?.abort(); };
  }, [accessKey]);
  useEffect(() => {
    if (!session) return;
    const stop = new AbortController(); let inFlight = false;
    async function poll() {
      if (inFlight) return; inFlight = true;
      try {
        const data = await memoryApi(accessKey, '/prompts', undefined, stop.signal);
        if (!stop.signal.aborted) { setPrompts(data.prompts); setReminderError(''); }
      } catch { if (!stop.signal.aborted) { setReminderError('Reminders are temporarily unavailable.'); setPrompts([]); } }
      finally { inFlight = false; }
    }
    void poll(); const timer = setInterval(poll, 3000);
    return () => { stop.abort(); clearInterval(timer); };
  }, [session, accessKey]);
  async function ask(e: React.FormEvent) {
    e.preventDefault(); setError(''); setResult(null); setBusy(true);
    const generation = version.current, stop = new AbortController(); activeRequest.current?.abort(); activeRequest.current = stop;
    try {
      const data = await memoryApi(accessKey, '/ask', { question }, stop.signal);
      if (generation === version.current) setResult(data);
    } catch (e) { if (!stop.signal.aborted) setError(e instanceof Error ? e.message : 'Could not check saved records.'); }
    finally { if (generation === version.current) setBusy(false); }
  }
  const field = 'w-full rounded-lg border border-slate-300 bg-white p-3';
  const when = (value: string) => `${new Intl.DateTimeFormat('en-GB', { timeZone: result?.context?.timezone || session?.timezone || 'Europe/London', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))} (${result?.context?.timezone || session?.timezone || 'Europe/London'})`;
  const button = 'rounded-lg bg-slate-900 text-white px-4 py-3 text-sm disabled:opacity-40';
  return <section className="space-y-5">
    <h1 className="text-2xl font-semibold">Your memory companion</h1>
    <p className="text-slate-600">Ask about saved reports, familiar people and scheduled plans. Your care team reviews the records. This prototype uses fictional data.</p>
    <form className="flex gap-3" onSubmit={e => { e.preventDefault(); setError(''); setBusy(true); void memoryApi(accessKey, '/status').then(setSession).catch(e => setError(e.message)).finally(() => setBusy(false)); }}>
      <input className={field} aria-label="Companion access key" type="password" placeholder="Memory access key" autoComplete="off" disabled={busy} value={accessKey} onChange={e => onAccessKeyChange(e.target.value)} />
      <button className={button} disabled={busy || !accessKey}>Connect companion</button>
    </form>
    {error && <p role="alert" className="bg-red-50 text-red-800 p-4 rounded-lg">{error}</p>}
    {session && <>
      <p className="text-sm text-slate-500">{session.mode === 'mongodb' ? 'Connected to saved Atlas records' : 'Local test memory'} · {session.patient_id}</p>
      <form className="rounded-xl border bg-white p-5 space-y-3" onSubmit={e => void ask(e)}>
        <label className="block font-medium" htmlFor="atlas-question">What would you like to remember?</label>
        <input id="atlas-question" className={field} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Did the physiotherapist visit yesterday?" disabled={busy} />
        <button className={button} disabled={busy || !question.trim()}>{busy ? 'Checking saved reports…' : 'Ask about saved records'}</button>
      </form>
      {result && <section aria-label="Atlas answer" className="rounded-xl border bg-white p-5 space-y-4">
        <p className="whitespace-pre-line text-lg">{result.answer || (result.status === 'evidence_only' ? 'Here are the saved reports returned for your question. A conversational AI answer is not available.' : result.message)}</p>
        {result.context?.complete === false && <p className="text-amber-800">Some information could not be checked completely. An empty section does not mean an activity did not happen.</p>}
        {Object.entries(result.context?.sections || {}).map(([name, section]: [string, any]) => <div key={name} className="border-t pt-3">
          <h2 className="font-medium">{{ episodes: 'Past reports', daily_logs: 'Daily activity reports', personal_records: 'Familiar people and personal information', plans: 'Scheduled plans—not completed events' }[name]}</h2>
          {section.day && <p className="text-sm text-slate-500">{section.day} · {section.timezone}</p>}
          {name === 'episodes' && section.records.length > 0 && <p className="text-sm text-slate-500">Top retrieved report; retrieval rank does not independently verify the answer.</p>}
          {section.status === 'unavailable' ? <p>Could not check these records.</p> : !section.records.length ? <p>No matching saved records were returned.</p> : section.records.slice(0, name === 'episodes' ? 1 : undefined).map((r: any) => <article key={r.id || r._id} className="mt-3 rounded-lg bg-slate-50 p-3">
            <p>{r.originalText || r.gist || `${r.kind} planned for ${when(r.eventStart)}`}</p>
            <p className="mt-1 text-sm text-slate-500">{r.sourceType || 'Source-linked report'}{r.outcome ? ` · ${r.outcome}` : ''}{r.occurredAt || r.start ? ` · ${when(r.occurredAt || r.start)}` : ''}</p>
            {r.evidence?.map((s: any) => <blockquote key={s.id} className="mt-2 text-sm">{s.source_type}: {s.text || 'Uninspected media; no factual claim confirmed.'}</blockquote>)}
          </article>)}
          {name === 'episodes' && section.records.length > 1 && <details className="mt-3 text-sm"><summary>Other retrieved candidates—not verified answers</summary>{section.records.slice(1).map((r: any) => <p key={r.id} className="mt-2">{r.gist}</p>)}</details>}
        </div>)}
      </section>}
      <section aria-label="Live reminders" className="rounded-xl border bg-white p-5 space-y-3"><h2 className="font-semibold">Reminders</h2>
        {reminderError && <p role="status" className="text-amber-800">{reminderError}</p>}
        {!prompts.length && !reminderError && <p className="text-slate-500">No current reminders returned.</p>}
        {prompts.filter(p => +new Date(p.expiresAt) > Date.now()).map(p => <article key={p._id} className="border-t pt-3"><p>{p.message}</p><div className="mt-3 flex gap-2">
          {['acknowledged', 'snoozed', 'dismissed'].map(action => <button key={action} className={button} disabled={busy} onClick={() => { setBusy(true); setError(''); void memoryApi(accessKey, '/prompts/respond', { prompt_id: p._id, action }).then(() => setPrompts(old => old.filter(item => item._id !== p._id))).catch(e => setError(e.message)).finally(() => setBusy(false)); }}>{action === 'acknowledged' ? 'Okay' : action === 'snoozed' ? 'Remind me in a minute' : 'Dismiss'}</button>)}
        </div></article>)}
      </section>
    </>}
  </section>;
}
