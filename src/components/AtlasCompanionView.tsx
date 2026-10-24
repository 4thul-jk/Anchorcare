import { SavedMemoryImage } from './SavedMemoryImage';
import { runCompanionJob } from '../lib/companionJob';
import { VoiceQuestionInput } from './VoiceQuestionInput';
import React, { useEffect, useRef, useState } from 'react';
import { memoryApi } from '../lib/memoryApi';

export function AtlasCompanionView({ accessKey, onAccessKeyChange }: { accessKey: string; onAccessKeyChange: (value: string) => void }) {
  const [session, setSession] = useState<any>(null);
  const [autoConnecting,setAutoConnecting]=useState(!accessKey);
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<any>(null);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [reminderError, setReminderError] = useState('');
  const [reminderNotice, setReminderNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [replyProgress,setReplyProgress]=useState('');
  const [pictures,setPictures]=useState<any[]>([]);
  const [pictureNotice,setPictureNotice]=useState('');
  const submitting=useRef(false);
  const currentJob=useRef<{id:string;key:string}|null>(null);
  function cancelReply(){activeRequest.current?.abort();const job=currentJob.current;currentJob.current=null;if(job)void memoryApi(job.key,'/asks/'+job.id+'/cancel',{}).catch(()=>{});}
  const activeRequest = useRef<AbortController | null>(null);
  const version = useRef(0);
  const supportSession = useRef<string | null>(null);
  useEffect(() => {
    version.current++; supportSession.current = null; cancelReply(); setReplyProgress(''); if (typeof window !== 'undefined') window.speechSynthesis?.cancel(); setSession(null); setResult(null); setPrompts([]); setReminderNotice(''); setPictures([]);setPictureNotice('');setBusy(false); submitting.current=false;
    return () => { version.current++; cancelReply(); window.speechSynthesis?.cancel(); };
  }, [accessKey]);
  useEffect(()=>{
    if(accessKey){setAutoConnecting(false);return;}
    const stop=new AbortController();setAutoConnecting(true);
    void memoryApi('', '/status',undefined,stop.signal).then(data=>{if(!stop.signal.aborted)setSession(data);}).catch(()=>{}).finally(()=>{if(!stop.signal.aborted)setAutoConnecting(false);});
    return()=>stop.abort();
  },[accessKey]);
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
  function ask(e: React.FormEvent) {e.preventDefault();void submitQuestion(question);}
  async function submitQuestion(value:string) {
    if (busy || submitting.current || !value.trim()) return; submitting.current=true; setQuestion(value); window.speechSynthesis?.cancel(); setError(''); setResult(null); setBusy(true);
    const generation = ++version.current, stop = new AbortController(); cancelReply(); activeRequest.current = stop;
    let previewShown=false;
    setPictures([]);setPictureNotice('');
    let pictureRequest=0,lastPictureReferences='';
    function loadPictures(referenceIds:string[]=[]){
      const requestNo=++pictureRequest;
      void memoryApi(accessKey,'/recall-images',{question:value,reference_ids:referenceIds},stop.signal).then(data=>{
        if(generation!==version.current||stop.signal.aborted||requestNo!==pictureRequest)return;
        setPictures(data.images);setPictureNotice('');
        if(data.images.length){previewShown=true;submitting.current=false;setBusy(false);}
        else if(data.requested)setPictureNotice('No approved saved picture matched this question. Your caregiver can add one.');
      }).catch(()=>{if(generation===version.current&&!stop.signal.aborted&&requestNo===pictureRequest)setPictureNotice('Saved pictures are temporarily unavailable.');});
    }
    function picturesFromAnswer(answer:any,force=false){
      const refs=[...new Set<string>((answer.claims||[]).flatMap((claim:any)=>(claim.citations||[]).map((c:any)=>c.recordId)))].sort().slice(0,20);
      const signature=refs.join('|');if(force||signature&&signature!==lastPictureReferences){lastPictureReferences=signature;loadPictures(refs);}
    }
    loadPictures();
    try {
      setReplyProgress('I am checking your saved information...');
      const data = await runCompanionJob(accessKey,{question:value,supportSession:supportSession.current},{signal:stop.signal,
        onJob:id=>{if(generation===version.current&&!stop.signal.aborted)currentJob.current={id,key:accessKey};else void memoryApi(accessKey,'/asks/'+id+'/cancel',{}).catch(()=>{});},
        onProgress:message=>{if(generation===version.current)setReplyProgress(previewShown?'You can ask another question while I finish checking this reply.':message);},
        onInterim:interim=>{if(generation===version.current&&!stop.signal.aborted){setResult(interim);picturesFromAnswer(interim);if(interim.status==='answered'){previewShown=true;submitting.current=false;setBusy(false);}}}
      });
      if (generation === version.current) { supportSession.current = data.supportSession || null; setResult(data);picturesFromAnswer(data,true); }
    } catch (e) { if (!stop.signal.aborted && generation===version.current && !previewShown) setError(e instanceof Error ? e.message : 'Could not check saved records.'); }
    finally { if (generation === version.current) { submitting.current=false; setBusy(false); setReplyProgress(''); currentJob.current=null; } }
  }
  const field = 'w-full rounded-lg border border-slate-300 bg-white p-3';
  const when = (value: string) => `${new Intl.DateTimeFormat('en-GB', { timeZone: result?.context?.timezone || session?.timezone || 'Europe/London', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))} (${result?.context?.timezone || session?.timezone || 'Europe/London'})`;
  const button = 'rounded-lg bg-slate-900 text-white px-4 py-3 text-sm disabled:opacity-40';
  return <section className="space-y-5">
    <h1 className="text-2xl font-semibold">Your memory companion</h1>
    <p className="text-slate-600">Ask about saved reports, familiar people and scheduled plans. Your care team reviews the records. This prototype uses fictional data.</p>
    {autoConnecting&&<p role="status">Opening your demo companion...</p>}
    {!autoConnecting&&!session?.demoAutoLogin&&<form className="flex gap-3" onSubmit={e => { e.preventDefault(); setError(''); setBusy(true); void memoryApi(accessKey, '/status').then(setSession).catch(e => setError(e.message)).finally(() => setBusy(false)); }}>
      <input className={field} aria-label="Companion access key" type="password" placeholder="Memory access key" autoComplete="off" disabled={busy} value={accessKey} onChange={e => onAccessKeyChange(e.target.value)} />
      <button className={button} disabled={busy || !accessKey}>Connect companion</button>
    </form>}
    {error && <p role="alert" className="bg-red-50 text-red-800 p-4 rounded-lg">{error}</p>}
    {session && <>
      <p className="text-sm text-slate-500">{session.demoAutoLogin?'Demo patient · Connected':session.mode === 'mongodb' ? 'Access key accepted · Atlas mode' : 'Local test memory'} · {session.patient_id}</p>
      <form className="rounded-xl border bg-white p-5 space-y-3" onSubmit={e => void ask(e)}>
        <label className="block font-medium" htmlFor="atlas-question">What would you like to remember?</label>
        <input id="atlas-question" className={field} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Did the physiotherapist visit yesterday?" disabled={busy} />
        <VoiceQuestionInput onTranscript={setQuestion} onQuestion={text=>void submitQuestion(text)} disabled={busy} />
        <button className={button} disabled={busy || !question.trim()}>{busy ? 'Preparing your answer...' : 'Ask about saved records'}</button>
      </form>
      {replyProgress && <div role="status" className="rounded-lg bg-blue-50 p-3"><p>{replyProgress}</p><button type="button" className="mt-2 rounded border px-3 py-2" onClick={()=>{version.current++;cancelReply();submitting.current=false;setReplyProgress('');setBusy(false);setResult(null);}}>Cancel reply</button></div>}
      {pictures.length>0&&<section aria-label="Saved pictures" className="space-y-3"><h2 className="text-xl font-semibold">Saved pictures to help you remember</h2><p className="text-sm text-slate-600">Selected using caregiver labels and saved records.</p><div className="grid md:grid-cols-2 gap-4">{pictures.map(image=><SavedMemoryImage key={image._id} image={image} accessKey={accessKey}/>)}</div></section>}
      {pictureNotice&&<p role="status" className="text-slate-600">{pictureNotice}</p>}
      {result && <section aria-label="Atlas answer" className="rounded-xl border bg-white p-5 space-y-4">
        <p aria-live="polite" className="whitespace-pre-line text-lg">{result.answer || (result.status === 'evidence_only' ? result.message || 'Here are the saved reports returned for your question. A conversational AI answer is not available.' : result.message)}</p>
        {result.status === 'support' && result.supportSession && <button className="rounded-lg border px-4 py-2" onClick={() => { version.current++; cancelReply(); submitting.current=false; setReplyProgress(''); setBusy(false); supportSession.current = null; window.speechSynthesis?.cancel(); setResult(null); setQuestion(''); }}>Return to memory questions</button>}
        {result.answer && typeof window !== 'undefined' && 'speechSynthesis' in window && <div className="flex gap-3"><button className={button} onClick={() => { window.speechSynthesis.cancel(); const speech = new SpeechSynthesisUtterance(result.answer); speech.lang = 'en-GB'; speech.rate = 0.9; window.speechSynthesis.speak(speech); }}>Read aloud</button><button className={button} onClick={() => window.speechSynthesis.cancel()}>Stop speaking</button></div>}
        {result.context?.complete === false && <p className="text-amber-800">Some information could not be checked completely. An empty section does not mean an activity did not happen.</p>}
        {result.context && <details open={result.status !== 'answered'} className="border-t pt-3"><summary className="cursor-pointer font-medium">View supporting saved records</summary>
        {Object.entries(result.context?.sections || {}).map(([name, section]: [string, any]) => <div key={name} className="border-t pt-3">
          <h2 className="font-medium">{{ episodes: 'Past reports', daily_logs: 'Daily activity reports', personal_records: 'Familiar people and personal information', plans: 'Scheduled plans (not completed events)' }[name]}</h2>
          {section.day && <p className="text-sm text-slate-500">{section.day} · {section.timezone}</p>}
          {name === 'episodes' && section.records.length > 0 && <p className="text-sm text-slate-500">Top retrieved report; retrieval rank does not independently verify the answer.</p>}
          {section.status === 'unavailable' ? <p>Could not check these records.</p> : !section.records.length ? <p>No matching saved records were returned.</p> : section.records.slice(0, name === 'episodes' ? 1 : undefined).map((r: any) => <article key={r.id || r._id} className="mt-3 rounded-lg bg-slate-50 p-3">
            <p>{r.originalText || r.gist || `${r.kind} planned for ${when(r.eventStart)}`}</p>
            <p className="mt-1 text-sm text-slate-500">{r.sourceType || 'Source-linked report'}{r.outcome ? ` · ${r.outcome}` : ''}{r.occurredAt || r.start ? ` · ${when(r.occurredAt || r.start)}` : ''}</p>
            {r.evidence?.map((s: any) => <blockquote key={s.id} className="mt-2 text-sm">{s.source_type}: {s.text || 'Uninspected media; no factual claim confirmed.'}</blockquote>)}
          </article>)}
          {name === 'episodes' && section.records.length > 1 && <details className="mt-3 text-sm"><summary>Other retrieved candidates - not verified answers</summary>{section.records.slice(1).map((r: any) => <p key={r.id} className="mt-2">{r.gist}</p>)}</details>}
        </div>)}
        </details>}
      </section>}
      <section aria-label="Live reminders" className="rounded-xl border bg-white p-5 space-y-3"><h2 className="font-semibold">Reminders</h2>
        {reminderNotice && <p role="status" className="text-green-800">{reminderNotice}</p>}
        {reminderError && <p role="status" className="text-amber-800">{reminderError}</p>}
        {!prompts.length && !reminderError && <p className="text-slate-500">No current reminders returned.</p>}
        {prompts.filter(p => +new Date(p.expiresAt) > Date.now()).map(p => <article key={p._id} className="border-t pt-3"><p>{p.message}</p><div className="mt-3 flex gap-2">
          {(p.kind === 'medication' ? ['taken', 'not_taken', 'unsure', 'snoozed'] : ['acknowledged', 'snoozed', 'dismissed']).map(action => <button key={action} className={button} disabled={busy} onClick={() => { setBusy(true); setError(''); void memoryApi(accessKey, p.kind === 'medication' && action !== 'snoozed' ? '/medication/respond' : '/prompts/respond', { prompt_id: p._id, action }).then(data => { setPrompts(old => old.filter(item => item._id !== p._id)); setReminderNotice(data.message || (action === 'snoozed' ? 'Reminder snoozed for one minute.' : 'Response saved.')); }).catch(e => setError(e.message)).finally(() => setBusy(false)); }}>{action === 'taken' ? 'Taken (my report)' : action === 'not_taken' ? 'Not taken' : action === 'unsure' ? 'Unsure' : action === 'acknowledged' ? 'Okay' : action === 'snoozed' ? 'Remind me in a minute' : 'Dismiss'}</button>)}
        </div></article>)}
      </section>
    </>}
  </section>;
}
