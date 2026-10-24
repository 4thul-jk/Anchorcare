import React,{useEffect,useState} from 'react';
import {memoryApi} from '../lib/memoryApi';
export function MedicationCaregiverPanel({accessKey}:{accessKey:string}){
 const [label,setLabel]=useState('FICTIONAL DEMO medication-plan check'),[reference,setReference]=useState('FICTIONAL-CARE-PLAN-001'),[seconds,setSeconds]=useState(60);
 const [records,setRecords]=useState<any[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[note,setNote]=useState('');
 async function load(){const d=await memoryApi(accessKey,'/admin/medication-review');setRecords(d.records);}
 useEffect(()=>{setRecords([]);let active=true;void memoryApi(accessKey,'/admin/medication-review').then(d=>{if(active)setRecords(d.records);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[accessKey]);
 async function act(task:()=>Promise<void>){setBusy(true);setError('');try{await task();await load();}catch(e){setError(e instanceof Error?e.message:'Request failed');}finally{setBusy(false);}}
 const when=(v:string)=>new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',dateStyle:'medium',timeStyle:'short'}).format(new Date(v));
 return <section className="rounded-xl border bg-white p-5 space-y-4"><h2 className="font-semibold">Medication reminder simulation</h2>
 <p>Fictional test data only. This creates a single reminder to check an existing care plan. The app does not select a medicine or dose.</p>
 {error&&<p role="alert" className="text-red-700">{error}</p>}
 <form className="space-y-3" onSubmit={e=>{e.preventDefault();void act(async()=>{await memoryApi(accessKey,'/admin/medication-plans',{label,care_plan_ref:reference,scheduled_at:new Date(Date.now()+seconds*1000).toISOString()});});}}>
 <label className="block">Reminder label<input className="block border rounded p-2 w-full" value={label} onChange={e=>setLabel(e.target.value)} required maxLength={120}/></label>
 <label className="block">Approved care-plan reference<input className="block border rounded p-2 w-full" value={reference} onChange={e=>setReference(e.target.value)} required maxLength={200}/></label>
 <label className="block">Seconds from now (demo)<input className="block border rounded p-2" type="number" min={30} max={600} value={seconds} onChange={e=>setSeconds(Number(e.target.value))} required/></label>
 <button disabled={busy} className="border rounded px-4 py-2">Save draft schedule</button></form>
 <button className="border rounded px-4 py-2" disabled={busy} onClick={()=>void act(load)}>Refresh caregiver review</button>
 {!records.length&&<p>No medication reminder schedules saved.</p>}
 {records.map(({plan,response,responseState,reviewRequired,interpretation}:any)=><article className="border-t pt-3 space-y-2" key={plan._id}>
 <p className="font-medium">{plan.label}</p><p>{when(plan.eventStart)} (Europe/London) | {plan.reviewStatus} | {plan.eventStatus}</p><p>Care plan: {plan.carePlanRef}</p>
 {plan.reviewStatus==='draft'&&plan.eventStatus==='planned'&&<button className="border rounded px-3 py-2" disabled={busy||Date.parse(plan.eventStart)<=Date.now()} onClick={()=>void act(async()=>{await memoryApi(accessKey,'/admin/medication-plans/approve',{plan_id:plan._id,status:'carer_verified'});})}>Approve this care-plan reminder</button>}
 {plan.eventStatus==='planned'&&<button className="border rounded px-3 py-2 ml-2" disabled={busy} onClick={()=>void act(async()=>{await memoryApi(accessKey,'/plans/cancel',{plan_id:plan._id});})}>Cancel schedule</button>}
 <p>Response: {responseState}{reviewRequired?' | Caregiver review needed':''}</p><p className="text-sm text-slate-600">{interpretation}</p>
 {response&&!response.caregiverReviewed&&<div><label className="block">Review note<input className="border rounded p-2 w-full" value={note} onChange={e=>setNote(e.target.value)} placeholder="Record your follow-up; this does not verify ingestion"/></label><button className="border rounded px-3 py-2 mt-2" disabled={busy||!note.trim()} onClick={()=>void act(async()=>{await memoryApi(accessKey,'/admin/medication-review',{response_id:response._id,note});setNote('');})}>Record caregiver review</button></div>}
 {response?.caregiverReviewed&&<p>Reviewed: {response.caregiverNote}</p>}
 </article>)}
 </section>;
}
