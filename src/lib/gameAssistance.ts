// Game-only intent routing: never sends an external call or message.
export function gameAssistance(text:string,offerPending=false):'request'|'offer'|'decline'|'none'{
 const q=text.toLowerCase().replace(/forhelp/g,'for help').replace(/[’']/g,"'").trim();
 if(/\b(don't|do not|don't want to|never|not now|no thanks|cancel)\b/.test(q))return offerPending?'decline':'none';
 if(offerPending&&/^(yes|yes please|please|okay|ok|sure|go ahead)[.! ]*$/.test(q))return 'request';
 const command=/\b(call|contact|bring|get|ask|send|fetch)\b/.test(q);
 const target=/\b(sam|caregiver|caretaker|carer)\b/.test(q)||(/\b(her|him|them)\b/.test(q)&&(offerPending||/\bhelp\b/.test(q)));
 const hypothetical=/\b(if|pretend|example|would happen|what happens)\b/.test(q);
 if(command&&target&&!hypothetical)return 'request';
 if(/\b(i need help|help me|sos|i(?: am|'m) (?:feeling )?(?:sick|unwell|lost)|not feeling well)\b/.test(q))return 'offer';
 return 'none';
}
