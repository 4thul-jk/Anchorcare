import {dayBounds,localDayKey} from '../../engram-retrieval/src/memory-model.js';
export class CaregiverAgent{
 constructor(private service:any){}
 async report(patient:string,kind='summary'){
  const scope=this.service.scope(patient),zone=this.service.cfg.timezone,day=localDayKey(this.service.clock(),zone),bounds=dayBounds(day,zone);
  const turns=await this.service.store.list('agent_capture_turns',{...scope,recordedAt:{$gte:bounds.start,$lt:bounds.end},state:'saved'},{recordedAt:-1},100);
  const alerts=await this.service.store.list('mobile_sos',{...scope,createdAt:{$gte:bounds.start,$lt:bounds.end}},{createdAt:-1},20);
  const care=turns.filter((t:any)=>t.careAssistance&&t.careAssistance.level!=='none');
  const time=(d:any)=>new Intl.DateTimeFormat('en-GB',{timeZone:zone,timeStyle:'short'}).format(new Date(d));
  if(kind==='alerts')return `Muse assistance report for ${day} (${zone}). ${alerts.length} assistance requests recorded; ${care.length} conversation turns flagged for human support. Absence of a record does not establish that no incident occurred.\n`+alerts.map((a:any)=>`${time(a.createdAt)}: ${a.reason}; call state ${a.callState}. Receipt or help is not confirmed.`).join('\n');
  const meaningful=turns.filter((t:any)=>t.outputs?.length&&!t.noSpeech).slice(0,12).reverse();
  return `Muse daily report for ${day} (${zone}). ${meaningful.length} reported updates shown; ${alerts.length} assistance requests. These are reports, not verified clinical observations.\n`+(meaningful.length?meaningful.map((t:any)=>`${time(t.recordedAt)} - ${t.transcript}`).join('\n'):'No meaningful updates were found in the checked conversation records. This does not mean nothing happened.');
 }
}
