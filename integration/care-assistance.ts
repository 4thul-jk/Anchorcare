// A prompt to seek human help, not a diagnosis or clinical severity score.
export function careAssessment(output:any,transcript:string){
 const value=output?.care_assistance;
 if(!value||value.level==='none')return {level:'none',quote:null};
 if(!['caregiver','urgent'].includes(value.level)||typeof value.quote!=='string'||!value.quote.trim()||!transcript.includes(value.quote))throw Error('Invalid care-assistance evidence');
 return {level:value.level,quote:value.quote};
}
export function fallbackCare(text:string){
 if(/\b(?:if|imagine|yesterday|last week|used to|no longer|not feeling unwell|not in pain)\b/i.test(text))return {level:'none',quote:null};
 const urgent=/\b(?:i (?:cannot|can't|cant) breathe|my chest (?:hurts|is (?:tight|heavy))|i (?:am|'m) bleeding (?:heavily|a lot)|i fell and (?:cannot|can't|cant) get up)\b/i.test(text);
 const concern=/\b(?:i (?:am|'m|feel) (?:unwell|sick|unsafe|scared)|i (?:am|'m) not feeling (?:very )?well|i (?:fell|need help)|i (?:cannot|can't|cant) (?:find my way|remember (?:if|whether) i took)|i (?:may|might) have taken (?:too much|extra))\b/i.test(text);
 return {level:urgent?'urgent':concern?'caregiver':'none',quote:urgent||concern?text:null};
}
export function careWording(level:string){return level==='urgent'?"This could need urgent help. Please call your local emergency services now, or ask someone nearby to call. Would you like me to request contact with your caretaker too? I haven't contacted anyone yet.":"I'd like to help you get some support. Would you like me to request contact with your caretaker? I haven't contacted anyone yet.";}
