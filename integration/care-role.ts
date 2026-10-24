// Explicit role identity lookups must not confuse distinct healthcare professions.
export function careRoleQuestion(question:unknown){
 if(typeof question!=='string')return null;
 const q=question.trim().toLowerCase().replace(/[’]/g,"'").replace(/\s+/g,' ').replace(/[?.!]+$/,'').trim();
 const role='(psychotherapist|physiotherapist|psychologist|psychiatrist|therapist|doctor|nurse|caregiver|physio|daughter|son|wife|husband|mother|father|sister|brother|granddaughter|grandson|partner|friend)';
 // Anchored identity patterns: event, medication and calling requests stay on their own routes.
 const patterns=[
  new RegExp('^(?:my |the )?'+role+'$'),
  new RegExp("^(?:(?:please|can you|could you) (?:tell me )?)?(?:who(?: is|'s)|what is the name of) my "+role+'$'),
  new RegExp('^(?:please )?(?:tell me about|remind me who|show me) my '+role+'(?: is)?$')
 ];
 for(const pattern of patterns){const match=q.match(pattern);if(match)return match[1]==='physio'?'physiotherapist':match[1];}
 return null;
}
export function careRoleAnswer(context:any,role:string){
 const section=context.sections.personal_records;
 const exact=(record:any)=>record.person?.name&&record.person?.relationship?.toLowerCase()===role&&new RegExp('\\b'+role+'\\b','i').test(record.originalText||'')&&(record.originalText||'').includes(record.person.name);
 const records=(section?.records||[]).filter(exact);
 const filtered={...context,sections:{personal_records:{...section,records}}};
 if(section?.status==='unavailable'||!section?.complete)return {status:'no_support',answer:'I could not check all your saved care contacts just now. Please ask your caregiver to help.',context:filtered};
 const reports=(section.records||[]).filter((r:any)=>!r.person&&r.sourceType==='user_report'&&new RegExp('\\b'+role+'\\b','i').test(r.originalText||''));
 if(reports.length){
  const claims=reports.slice(0,3).map((r:any)=>({text:'You told me: "'+r.originalText+'"',citations:[{section:'personal_records',recordId:r._id,sourceId:r._id,quote:r.originalText}]}));
  return {status:'answered',answer:claims.map((c:any)=>c.text).join(' '),claims,context:{...context,sections:{personal_records:{...section,records:reports.slice(0,3)}}},conversational:false,verification:'stored_user_report_relationship'};
 }
 if(records.length){
  const claims=records.map((r:any)=>({text:`${r.person.name} is your ${role}.`,citations:[{section:'personal_records',recordId:r._id,sourceId:r._id,quote:r.originalText}]}));
  return {status:'answered',answer:claims.map((c:any)=>c.text).join(' '),claims,context:filtered,conversational:false,verification:'approved_exact_care_role'};
 }
 const physio=role==='psychotherapist'&&(section.records||[]).some((r:any)=>r.person?.relationship==='physiotherapist');
 return {status:'no_support',answer:`I do not have a saved person listed as your ${role}.`+(physio?' Did you mean your physiotherapist, who helps with movement and exercises?':' Your caregiver can help check.'),context:filtered};
}
