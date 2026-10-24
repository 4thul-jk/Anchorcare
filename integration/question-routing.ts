import {normaliseRecallQuery} from './query-language';
import { explicitQuestionDay } from './question-date';
import { text, ApiError } from '../engram-retrieval/src/validation.js';
import { dayBounds, localDayKey, shiftDay } from '../engram-retrieval/src/memory-model.js';

// Small inspectable router. Unhandled calendar language is not guessed by an LLM.
export function routeQuestion(value: unknown, timezone: string, now = new Date()) {
  const query = text(value, 'question', 1000), q = normaliseRecallQuery(query);
  const today = localDayKey(now, timezone);
  const explicit = explicitQuestionDay(q, timezone, now);
  const day = explicit || today;
  let bounds;
  try { bounds = dayBounds(day, timezone); } catch { throw new ApiError(400, 'Invalid date in question'); }
  const request: any = { query, limit: 20 };
  if (/\b(who is|who's|who am i|what(?:'s| is) my name|my name|daughter|son|wife|husband|prefer|favourite|favorite)\b/.test(q) && !/\b(visit|visiting|visited|coming|came|call|called|dropping by|stopping by)\b/.test(q)) {
    request.include = ['personal_records'];
  } else if (!/\b(did|visited|yesterday|was|were|came|completed|earlier)\b/.test(q) && (/\b(next|upcoming|scheduled|tomorrow|coming|will)\b/.test(q) || /\b(visiting|visitors|visits|going to visit|going to come|dropping by|stopping by)\b/.test(q) || /\bwhen\b.*\bvisit\b/.test(q))) {
    request.include = ['plans', 'personal_records'];
    if (explicit || /\b(tomorrow|today)\b/.test(q)) request.plan_range = { start: bounds.start.toISOString(), end: bounds.end.toISOString() };
  } else if (/\b(medicine|medication|dose|pills?|tablets?|exercise|breakfast|lunch|dinner|water|drink|hydration|sleep)\b/.test(q)) {
    request.include = ['daily_logs']; request.day = day;
    const activities: Array<[RegExp, string]> = [[/medicine|medication|dose|pills?|tablets?/, 'medication'], [/exercise/, 'exercise'], [/breakfast|lunch|dinner/, 'meal'], [/water|drink|hydration/, 'hydration'], [/sleep/, 'sleep']];
    request.activity = activities.find(([pattern]) => pattern.test(q))?.[1];
  } else {
    request.include = ['episodes'];
    if (explicit || /\b(today|yesterday|tomorrow)\b/.test(q)) request.time_range = { start: bounds.start.toISOString(), end: bounds.end.toISOString() };
  }
  return request;
}
