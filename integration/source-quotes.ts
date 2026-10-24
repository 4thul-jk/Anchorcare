import { validateContextCitations } from '../engram-retrieval/src/memory-context.js';

export function checkedSourceQuotes(context: any, output: any) {
  if (output?.status !== 'supported' || !validateContextCitations(context, output).allowed) return { allowed: false };
  const claims: any[] = [];
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
      excerpts.push(`${citation.section === 'plans' ? 'Scheduled intention, not completion' : 'Saved source report'}: “${quote}”`);
    }
    claims.push({ text: excerpts.join('\n'), citations: claim.citations });
  }
  return { allowed: true, claims, answer: claims.map(c => c.text).join('\n'), verification: 'source_quote_integrity_only' };
}
