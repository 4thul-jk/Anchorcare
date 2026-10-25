// A source-backed fallback prevents available notes from being described as absent
// when the generative answer fails validation. Dates are already scoped by retrieval.
export function daySummaryFallback(context:any,question:string){
 if(!/\b(summary|summari[sz]e|recap|what happened|how was my day)\b/i.test(question))return null;
 const entries:any[]=[];
 for(const r of context.sections.daily_logs?.records||[]){if(typeof r.originalText==='string')entries.push({at:r.occurredAt,text:r.originalText,citation:{section:'daily_logs',recordId:r._id,sourceId:r._id,quote:r.originalText}});}
 for(const r of context.sections.episodes?.records||[]){const e=r.evidence?.find((s:any)=>typeof s.text==='string'&&s.text.trim()&&!s.inspection_required);if(e)entries.push({at:r.start,text:e.text,citation:{section:'episodes',recordId:r.id,sourceId:e.id,quote:e.text}});}
 const seen=new Set<string>(),selected=entries.sort((a,b)=>+new Date(a.at)-+new Date(b.at)).filter(e=>{const key=e.text.trim();if(!key||key.length>1200||seen.has(key))return false;seen.add(key);return true;}).slice(0,6);
 if(!selected.length)return null;
 const day=context.sections.daily_logs?.day;
 return {status:'answered',responseSource:'saved_day_notes',answer:`Here are some of the available notes${day?' for '+day:''}. `+selected.map(e=>e.text.replace(/^FICTIONAL DEMO\s*[—–:-]\s*/i,'').trim()).join(' '),claims:selected.map(e=>({text:e.text,citations:[e.citation]})),context,verification:'source_text_day_summary',conversational:false};
}
