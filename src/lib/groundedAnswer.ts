import type { MemoryEvent } from './caregiverEngine';

const stop = new Set('a an the i me my we you your do did does have has had is are am was were will would can could should what when where who how why at in on to of for with and or this that it please tell know remember about any anything today yesterday morning afternoon evening time coming come'.split(' '));
function normalize(word: string) {
  const aliases: Record<string, string> = { visits: 'visit', visiting: 'visit', visited: 'visit', walks: 'walk', walked: 'walk', walking: 'walk', medicines: 'medication', medicine: 'medication', medications: 'medication', pills: 'medication', pill: 'medication', took: 'take', taken: 'take', drinks: 'drink', drank: 'drink', drinking: 'drink' };
  return aliases[word] || word;
}
function day(value: Date) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value); }

// Conservative literal retrieval for the original browser demo, not semantic AI.
export function selectQuotedEvidence(events: MemoryEvent[], question: string, now = new Date()) {
  const q = question.toLowerCase();
  if (/\b(tomorrow|last week|last month|next week)\b/.test(q)) return [];
  const tokens = [...new Set((q.match(/[\p{L}\p{N}]+/gu) || []).filter(w => !stop.has(w)).map(normalize))];
  if (!tokens.length) return [];
  const targetDay = q.includes('yesterday') ? day(new Date(+now - 86400000)) : /\b(today|this morning|this afternoon|this evening)\b/.test(q) ? day(now) : null;
  return events.filter(e => {
    if (e.status !== 'active') return false;
    if (targetDay && day(new Date(e.occurred_at)) !== targetDay) return false;
    const words = new Set((e.statement.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).map(normalize));
    return tokens.every(t => words.has(t));
  }).slice(0, 5);
}

export function quoteReports(events: MemoryEvent[]) {
  if (!events.length) return "I couldn't find a supporting record for that question.";
  const conflict = events.some(e => e.conflict_with_ids.length > 0);
  return `${conflict ? 'These records need reconciliation. ' : ''}Here is the saved report${events.length > 1 ? 's' : ''}; this does not independently confirm what happened:\n` +
    events.map(e => `${e.source.author} (${e.source.type}; ${e.occurred_at}) recorded: “${e.statement}”`).join('\n');
}
