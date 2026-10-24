import { text, ApiError } from '../engram-retrieval/src/validation.js';
import { dayBounds, localDayKey, shiftDay } from '../engram-retrieval/src/memory-model.js';

// Small inspectable router. Unhandled calendar language is not guessed by an LLM.
export function routeQuestion(value: unknown, timezone: string, now = new Date()) {
  const query = text(value, 'question', 1000), q = query.toLowerCase();
  const today = localDayKey(now, timezone);
  if (/\b(last week|last month|next week|next month|last year)\b/.test(q)) throw new ApiError(400, 'Please specify today, yesterday, tomorrow, or a date such as 2026-10-23. This prototype does not guess broader date ranges.');
  const explicit = q.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  const day = explicit || (/\byesterday\b/.test(q) ? shiftDay(today, -1) : /\btomorrow\b/.test(q) ? shiftDay(today, 1) : today);
  let bounds;
  try { bounds = dayBounds(day, timezone); } catch { throw new ApiError(400, 'Invalid date in question'); }
  const request: any = { query, limit: 20 };
  if (/\b(who is|who's|daughter|son|wife|husband|prefer|favourite|favorite)\b/.test(q) && !/\b(visit|visiting|visited|coming|came|call|called)\b/.test(q)) {
    request.include = ['personal_records'];
  } else if (!/\b(did|visited|yesterday|was|were)\b/.test(q) && (/\b(next|upcoming|scheduled|tomorrow|coming)\b/.test(q) || /\bwhen\b.*\b(visit|visiting)\b/.test(q))) {
    request.include = ['plans'];
    if (explicit || /\b(tomorrow|today)\b/.test(q)) request.plan_range = { start: bounds.start.toISOString(), end: bounds.end.toISOString() };
  } else if (/\b(medicine|medication|dose|exercise|breakfast|lunch|dinner|water|drink|hydration|sleep)\b/.test(q)) {
    request.include = ['daily_logs']; request.day = day;
    const activities: Array<[RegExp, string]> = [[/medicine|medication|dose/, 'medication'], [/exercise/, 'exercise'], [/breakfast|lunch|dinner/, 'meal'], [/water|drink|hydration/, 'hydration'], [/sleep/, 'sleep']];
    request.activity = activities.find(([pattern]) => pattern.test(q))?.[1];
  } else {
    request.include = ['episodes'];
    if (explicit || /\b(today|yesterday|tomorrow)\b/.test(q)) request.time_range = { start: bounds.start.toISOString(), end: bounds.end.toISOString() };
  }
  return request;
}
