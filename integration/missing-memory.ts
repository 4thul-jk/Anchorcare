// Deterministic conversational fallbacks: no invented facts and no extra model latency.
export function missingMemoryReply(question:unknown,reason:'missing'|'uncertain'='uncertain'){
 const q=typeof question==='string'?question:'';
 if(/\b(medicines?|medications?|pills?|tablets?|dosage|dose)\b/i.test(q)){
  if(/\b(did i|have i|already|taken|took)\b/i.test(q))return "I'm not sure whether you've taken your medicine. Let's check with your caregiver so you don't have to guess.";
  return "I'm not sure whether any medicine is due right now. Your caregiver can check your medication plan with you.";
 }
 if(/\b(visiting|visitors?|visit|coming)\b/i.test(q))return "I'm not sure who's coming from the information I have. Your caregiver may be able to confirm the plans.";
 if(/\b(where|left|find)\b/i.test(q))return "I'm not sure where that is from what you've told me so far. Do you remember where you last had it?";
 if(/\b(daughter|son|wife|husband|mother|father|sister|brother|friend)\b/i.test(q))return "I don't have enough information about them yet. What would you like to remember about them?";
 return reason==='missing'?"I don't have that detail yet. Can you tell me a little more about what you'd like to remember?":"I'm not sure about that from the information I have. Can you tell me a little more so I can help?";
}
