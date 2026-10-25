/** A typed breakfast preference selects a meal, not a completed eating event. */
export function breakfastChoice(text: string): string | null {
 const q = text.trim().replace(/[.!]+$/, '');
 if (!q || /[?]|\b(?:who|where|when|why|did|have i|allergic|allergy|cannot|can't|don't|do not|not want)\b/i.test(q)) return null;
 const match = q.match(/^(?:i\s+(?:would\s+like|want|like|prefer|choose)|i['’]d\s+(?:like|prefer)|i['’]ll\s+have|can i have|could i have)\s+(.+)$/i);
 if (!match) {
  // Short replies to the breakfast question are choices too.
  return /^(?:cereals?|steak|porridge|oatmeal|toast|eggs?|pancakes?|fruit|yog[hu]urt|rice|bread|sandwich|coffee|tea)(?:\s+(?:and|with)\s+[a-z ]+)?(?:,? please)?$/i.test(q) ? q.replace(/,? please$/i,'') : null;
 }
 const meal = match[1].replace(/\s+(?:for breakfast|please|instead|today)$/i, '').trim();
 if (!meal || meal.length > 70 || /\b(?:know|see|call|help|remember|go|sam|sarah|daughter|medicine|medication)\b/i.test(meal)) return null;
 return meal;
}


export function storyDecision(scene: number, text: string): 'choice' | 'question' | 'next_day' | null {
 const q=text.trim().toLowerCase();
 const question=/^(who|what|where|when|why|how|did|have i|is |are |can you|could you|tell me|remind me|show me)|\?/.test(q);
 if ([2,3,4,12,14].includes(scene)) return question ? 'question' : null;
 if (scene===1) return breakfastChoice(text) ? 'choice' : null;
 if (scene===11) return /^(?:yes|continue|next day|tomorrow|go to sleep|i want to sleep|sleep|rest)[.! ]*$/.test(q) ? 'next_day' : null;
 if (question) return null;
 if (/\b(rest|not now|not yet|no thanks|rather not|sit quietly|stay here|skip)\b/.test(q)) return 'choice';
 const relevant:Record<number,RegExp>={
  0:/\b(glasses|spectacles)\b.*\b(on|in|by|beside|under|keep|wear)\b|\b(keep|wear)\b.*\b(glasses|them)\b/,
  5:/\b(album|pictures|photos|sarah|sit|talk)\b/,
  6:/\b(walk|water|garden|flowers|rosemary|sit|bench)\b/,
  7:/\b(thanks|thank you|okay|ok|wait)\b/,
  8:/\b(exercise|stretch|join|david|decline)\b/,
  9:/\b(stay|cafe|entrance|wait)\b/,
  10:/\b(wait|stay)\b/,
  13:/\b(glasses|them)\b.*\b(on|in|by|beside|under|keep|wear)\b/,
 };
 return relevant[scene]?.test(q) ? 'choice' : null;
}
