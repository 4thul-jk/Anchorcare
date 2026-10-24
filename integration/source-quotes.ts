import { validateContextCitations } from '../engram-retrieval/src/memory-context.js';

export function checkedSourceQuotes(context: any, output: any) {
  if (output?.status !== 'supported' || !validateContextCitations(context, output).allowed) return { allowed: false };
  const claims: any[] = [];
  const sources: Array<{citation:any;record:any;quote:string}> = [];
  for (const claim of output.claims) {
    const excerpts: string[] = [];
    for (const citation of claim.citations) {
      const record = context.sections[citation.section].records.find((r: any) => (r.id ?? r._id) === citation.recordId);
      let source: string;
      if (citation.section === 'episodes') source = record.evidence.find((s: any) => s.id === citation.sourceId).text;
      else if (citation.section === 'plans') source = record.eventStart instanceof Date ? record.eventStart.toISOString() : record.eventStart;
      else source = record.originalText;
      const quote = citation.quote;
      if (typeof source !== 'string' || typeof quote !== 'string' || !quote.trim() || quote.length > 1200 || !source.includes(quote)) return { allowed: false };
      // A partial year or date cannot stand in for the scheduled instant.
      if (citation.section === 'plans' && quote !== source) return { allowed: false };
      excerpts.push(`${citation.section === 'plans' ? 'Scheduled intention, not completion' : 'Saved source report'}: "${quote}"`);
      sources.push({citation,record,quote});
    }
    claims.push({ text: excerpts.join('\n'), citations: claim.citations });
  }
  const sentences: string[]=[];
  for(const {citation,record,quote} of sources) {
    if(citation.section==='plans') {
      if(record.reviewStatus!=='approved'||record.eventStatus!=='planned'||!Number.isFinite(+new Date(record.eventStart))) return {allowed:false};
      const matching=sources.find(s=>s.citation.section==='personal_records'&&s.record.personId===record.personId&&s.record.person?.name&&s.quote.includes(s.record.person.name));
      const name=matching?.record.person.name;
      const date=new Intl.DateTimeFormat('en-GB',{timeZone:context.timezone||'Europe/London',dateStyle:'full',timeStyle:'short'}).format(new Date(record.eventStart));
      sentences.push(`${name && record.kind==='visit' ? name+' is scheduled to visit' : record.kind==='visit' ? 'A visit is scheduled' : 'A saved plan is scheduled'} on ${date} (${context.timezone||'Europe/London'}). This is a plan, not confirmation that it happened.`);
    } else {
      sentences.push(`A saved ${citation.section==='personal_records'?'personal record':'report'} says: "${quote}"`);
    }
  }
  return { allowed: true, claims, answer: [...new Set(sentences)].join('\n'), verification: 'source_quote_integrity_only' };
}
