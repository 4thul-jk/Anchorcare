import {ApiError} from '../engram-retrieval/src/validation.js';
import {localDayKey,shiftDay,dayBounds} from '../engram-retrieval/src/memory-model.js';
// One supported calendar day per retrieval. Never silently choose one of several dates.
export function explicitQuestionDay(question:string,timezone:string,now:Date):string|undefined{
 const q=question.toLowerCase(),today=localDayKey(now,timezone),days=new Set<string>();
 if(/\b(last week|last month|next week|next month|last year)\b/.test(q))throw new ApiError(400,'Please ask about one day: today, yesterday, tomorrow or a YYYY-MM-DD date.');
 for(const date of q.match(/\b\d{4}-\d{2}-\d{2}\b/g)||[])days.add(date);
 if(/\b(today|tonight)\b/.test(q))days.add(today);
 if(/\b(yesterday|last night)\b/.test(q))days.add(shiftDay(today,-1));
 if(/\btomorrow\b/.test(q))days.add(shiftDay(today,1));
 if(days.size>1)throw new ApiError(400,'Please ask about one day at a time so I do not mix past events with upcoming plans.');
 const day=[...days][0];
 if(day){try{dayBounds(day,timezone);}catch{throw new ApiError(400,'Invalid date in question');}}
 return day;
}
