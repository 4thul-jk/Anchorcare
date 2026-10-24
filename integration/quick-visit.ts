import {routeQuestion} from './question-routing';
// A narrow read-only shortcut: approved schedule fields do not require waiting on inference.
export function quickVisitRequest(question:unknown,timezone:string,now:Date){
 if(typeof question!=='string')return null;
 const q=question.toLowerCase();
 if(/\b(did|visited|came|yesterday|was|were|earlier|last night|completed)\b/.test(q))return null;
 if(!/\b(visiting|visitors|visits|going to visit|going to come|coming|dropping by|stopping by)\b/.test(q)&&!/\b(will|is|are|anyone|anybody)\b.*\bvisit\b/.test(q))return null;
 const request=routeQuestion(question,timezone,now);
 return request.include.includes('plans')?request:null;
}
