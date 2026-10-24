import { checkedSourceQuotes } from './source-quotes';
// Format current approved visit fields when generation times out. This is not LLM output.
export function visitFallback(context: any, question: unknown) {
 if(typeof question!=='string'||!context.sections?.plans||!context.sections?.personal_records)return null;
 if(!/\b(visits?|visiting|visitors|coming|dropping by|stopping by)\b/i.test(question))return null;
 const generic=/\b(who|any|anyone|anybody|visitors)\b/i.test(question);
 const claims=[];
 for(const plan of context.sections.plans.records){
  if(plan.kind!=='visit'||plan.reviewStatus!=='approved'||plan.eventStatus!=='planned')continue;
  const person=context.sections.personal_records.records.find((r:any)=>r.personId===plan.personId&&r.person?.name&&typeof r.originalText==='string'&&r.originalText.includes(r.person.name));
  if(!person)continue;
  const relation=person.person.relationship;
  const questionNames=person.person.name.toLowerCase().split(/\s+/).filter((s:string)=>s.length>2);
  const questionWords=new Set(question.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]);
  const namesPerson=questionNames.some((name:string)=>questionWords.has(name));
  const namesRelation=typeof relation==='string'&&person.originalText.toLowerCase().includes(relation.toLowerCase())&&question.toLowerCase().includes(relation.toLowerCase());
  if(!generic&&!namesPerson&&!namesRelation)continue;
  claims.push({text:'Scheduled visit from approved records',citations:[{section:'plans',recordId:plan._id,sourceId:plan._id,quote:new Date(plan.eventStart).toISOString()},{section:'personal_records',recordId:person._id,sourceId:person._id,quote:person.originalText}]});
 }
 if(!claims.length||claims.length>10)return null;
 const result=checkedSourceQuotes(context,{status:'supported',claims});
 return result.allowed?{...result,answer:result.answer!.split('\n').filter(line=>!line.startsWith('A saved personal record says:')).join('\n')}:null;
}
