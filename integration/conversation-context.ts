import {normaliseRecallQuery} from './query-language';
import {explicitQuestionDay} from './question-date';
export function datedMemoryFollowup(original:string,history:any[],timezone:string,now:Date){
 if(!/^(?:and\s+(?:what|how|when|who|where|did|was|were)\b|what about\b|how about\b|tell me more\b|what else\b|anything else\b)/i.test(original.trim())||explicitQuestionDay(original,timezone,now))return null;
 const previous=history.at(-1);if(!previous||['web','general_creative','directions','location_needed'].includes(previous.answerSource))return null;
 const anchor=new Date(previous.recordedAt||now);if(!Number.isFinite(+anchor))return null;
 const day=explicitQuestionDay(previous.recallQuery||previous.transcript||'',timezone,anchor);if(!day)return null;
 return /^(?:tell me more|what else|anything else)[.!? ]*$/i.test(original.trim())?'Give me more detail in a summary on '+day:original+' on '+day;
}
export function isConversationalRequest(text:string){return /^(?:i (?:want|need|would like) to (?:remember|see|know)|(?:please )?(?:show|tell|remind|help)\b|yes(?: please)?[.! ]*$|(?:no(?: thanks)?|not now|please do)[.! ]*$)/i.test(text.trim());}
export function resolveRecallQuery(original:string,proposed:unknown,history:any[]){
 const relation=normaliseRecallQuery(original).match(/\b(daughter|son|wife|husband|mother|father|sister|brother)\b/);
 if(relation&&/\b(looks?|appearance|picture|photo|image)\b/i.test(original)&&!/\b(visit|coming|when|call|contact)\b/i.test(original))return {query:'Show me a picture of my '+relation[1],unresolved:false};
 const prior=history.map(t=>[t.transcript,t.recallQuery,t.lastAnswer].filter(Boolean).join(' ')).join(' ');
 const words=(v:string)=>normaliseRecallQuery(v).match(/[\p{L}\p{N}]+/gu)||[];
 const allowed=new Set(words(original+' '+prior+' show see picture image photo remember who is what about me my the please tell more help would like a of your to do did can you'));
 if(typeof proposed==='string'&&proposed.trim()&&proposed.length<=1000){
  const safeWords=words(proposed).every(w=>allowed.has(w));
  const newAction=/\b(call|contact|message|alert|notify|sos)\b/i.test(proposed)&&!/\b(call|contact|message|alert|notify|sos)\b/i.test(original);
  if(safeWords&&proposed.trim().toLowerCase()!==original.trim().toLowerCase()&&!newAction&&!/\b(her|him|them|she|he)\b/i.test(proposed))return {query:proposed.trim(),unresolved:false};
 }
 const implicitPicture=/^(?:(?:maybe|please|yes)\s+)?(?:the\s+)?(?:name and (?:image|picture|photo)|(?:image|picture|photo)(?: please)?)[.!? ]*$/i.test(original.trim());
 const pronoun=/\b(her|him|them|she|he)\b/i.test(original)||/^(?:please )?(?:tell me more|what about that|and then)[.! ]*$/i.test(original);
 if(pronoun||implicitPicture){
  for(const turn of [...history].reverse()){
   const roles=[...new Set((normaliseRecallQuery(turn.recallQuery||turn.transcript||'').match(/\b(daughter|son|wife|husband|mother|father|sister|brother|caregiver|physiotherapist)\b/g)||[]))];
   if(roles.length>1)return {query:original,unresolved:true};
   if(roles.length===1)return {query:/\b(see|show|photo|picture|image)\b/i.test(original)?'Show me a picture of my '+roles[0]:'Tell me about my '+roles[0],unresolved:false};
  }
  return {query:original,unresolved:true};
 }
 if(/^i (?:want|would like) to see my (daughter|son|wife|husband)[.! ]*$/i.test(original))return {query:original.replace(/^i (?:want|would like) to see/i,'Show me a picture of'),unresolved:false};
 return {query:original,unresolved:false};
}
export function currentLocationReport(transcript:string){
 const match=transcript.replace(/\u2019/g,"'").trim().match(/^(?:(?:actually|currently|now)[, ]+)?(?:i am|i'm|im)\s+(?:currently\s+)?(?:at|in|near)\s+([^?!\n]{2,160})[.!]?$/i);
 if(!match||/\b(tomorrow|yesterday|last week|will|maybe|not|used to)\b/i.test(match[1]))return null;
 const location=match[1].split(/\s+(?:and|but|because)\s+|[.!]\s+(?=i\b)/i)[0].replace(/[.!]+$/,'').trim();
 return location.length>=2?location:null;
}
export function isLocationRecall(query:string){return /^(?:please\s+)?(?:where (?:am i|was i|did i (?:say|tell you)|is my (?:last|latest) (?:reported )?location)|what (?:is|was) my (?:last|latest) (?:reported )?location|(?:my|current|last|latest) location|i(?: am|'m|m) lost)\b/i.test(query.trim());}
export function locationWording(report:any,now:Date,timezone:string){
 if(!report)return "I don't have a location you've reported, and I can't see live GPS. Would you like help contacting your emergency contact?";
 const when=new Intl.DateTimeFormat('en-GB',{timeZone:timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(report.reportedAt));
 const stale=+now-+new Date(report.reportedAt)>15*60000;
 return `You told me you were at ${report.location} on ${when} (${timezone}). I can't confirm whether you're still there.`+(stale?' Would you like help contacting your emergency contact?':' Is that still where you are? If you need help, would you like to contact your emergency contact?');
}

