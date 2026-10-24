export function immediateSupport(question: unknown): string | null {
  if (typeof question !== 'string') return null;
  const q = question.toLowerCase().replace(/[’]/g, "'");
  if (/\bconfused\b.*\b(?:about|medicine|medication|pills?|tablets?|name|daughter|breakfast|visit)\b/.test(q)) return null;
  if (/^(?:where am i|where are we)[?!. ]*$/.test(q) || /\b(?:i (?:don't|dont|do not) know|i cannot tell|i can't tell) where i am\b/.test(q)) return "I can't verify your current location. If you can, look for a nearby sign or ask a staff member to help you contact your caregiver. I haven't contacted anyone for you. What town or landmark can you see?";
  if (/\b(?:i am|i'm|im|i feel)\s+(?:lost|confused)\b|\b(?:cannot|can't|cant|don't|do not) know where i am\b/.test(q)) {
    return "I'm here to help. I can't see your current location. If you can, pause somewhere away from traffic and ask a nearby staff member or trusted person to help you contact your caregiver. I haven't contacted anyone for you.";
  }
  return null;
}
export async function within<T>(work: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Response deadline exceeded')), milliseconds); })]); }
  finally { clearTimeout(timer!); }
}
