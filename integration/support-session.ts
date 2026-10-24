import { randomUUID } from 'node:crypto';
import { immediateSupport } from './response-speed';

// Ephemeral conversation state, scoped to the authenticated actor. Not a location sensor or an alert service.
export class SupportSessions {
  private sessions = new Map<string, { actor: string; expires: number; lastQuestion?: string; repeats?: number; history?: string[] }>();
  history(token: string, actor: string) {
    const state = this.sessions.get(token);
    return state?.actor === actor && state.expires > Date.now() ? [...(state.history || [])] : [];
  }
  respond(question: unknown, token: unknown, actor: string, now = Date.now()) {
    for (const [id, state] of this.sessions) if (state.expires <= now) this.sessions.delete(id);
    if (typeof question !== 'string' || question.length > 1000) return null;
    const greeting = /^(?:hi|hello|hey|thanks|thank you|what can you do|how are you)[!?. ]*$/i.test(question.trim());
    const initial = greeting ? 'Hello. I can help you recall saved information about familiar people, daily activities and plans. What would you like help with?' : immediateSupport(question);
    const normalized = question.toLowerCase().replace(/[’]/g, "'").trim().replace(/[?!.,]+$/g, '');
    const contact = /^(?:(?:please|can you|could you|would you|help me|i want to|i need to)\s+)*(?:call|contact|phone|ring|message|reach|notify|alert)\b.*\b(?:care\s*giver|carer|guardian|daughter|son|family|relative)\b/.test(normalized);
    const unable = /\b(?:can't|cannot|cant|unable|don't know how|do not know how)\b.*\b(?:use (?:my |the )?phone|call|contact|walk|see (?:a |any )?(?:sign|staff|person))\b/.test(normalized);
    let id = typeof token === 'string' ? token : '';
    const state = this.sessions.get(id);
    const active = state?.actor === actor && state.expires > now;
    if (!initial && !contact && !active) return null;
    if (!active) { id = randomUUID(); if (this.sessions.size >= 200) this.sessions.delete(this.sessions.keys().next().value!); }
    if (/\b(?:i am|i'm|im) (?:home|okay|ok|with my caregiver)\b|\bend help\b/i.test(question)) {
      this.sessions.delete(id);
      return { status: 'support', answer: "Thank you for telling me. You can ask me about your saved memories whenever you like.", supportSession: null, locationKnown: false, caregiverContacted: false };
    }
    // A session token provides context, not permission to capture every subsequent message.
    // Only explicit help follow-ups remain here; all other input goes to Gemini memory interpretation.
    const helpFollowup = /^(?:yes|no|please|yes please|help me|what should i say|what do i say|how do i call|how can i contact my caregiver)$/i.test(normalized);
    const newQuestion = /^(?:who|what|when|where|why|how|is|are|do|does|did|can|could|will|would|has|have|tell|show|remind)\b/i.test(normalized);
    const locationReport = !newQuestion && (/^(?:i am|i'm|im|i can see|i see|there is|there's)\s+(?:in|at|near|outside|a |the )/i.test(normalized)
      || /^(?:in|at|near|outside)\s+\S/i.test(normalized)
      || /^(?:[A-Z][a-z]+)(?: [A-Z][a-z]+){0,3}$/.test(question.trim()) && !/\b(my|name|daughter|medicine|today|tomorrow|visiting|visit)\b/i.test(question));
    if (!initial && !contact && !unable && !helpFollowup && !locationReport) { this.sessions.delete(id); return null; }
    const repeats = active && state.lastQuestion === normalized ? (state.repeats || 0) + 1 : 0;
    this.sessions.set(id, { actor, expires: now + 10 * 60 * 1000, lastQuestion: normalized, repeats, history: [...(active ? state.history || [] : []), question].slice(-6) });
    let answer = initial ? initial + (greeting ? '' : ' What town or nearby landmark can you see?') :
      "Thank you for telling me. I am treating that as information you reported, not a verified location. Can you see a shop name, street sign, station, or a staff member nearby? If you can, ask a staff member or trusted person to help you contact your caregiver. I haven't contacted anyone for you.";
    if (!initial && /\b(?:in|at|near|outside|guildford|gulidford|station|shop|street)\b/i.test(question)) {
      answer = "Thank you for telling me where you think you are. I haven't verified your location. Can you see a nearby shop name, street sign, or station sign? If you can, ask a staff member or trusted person to help you contact your caregiver. I haven't contacted anyone for you.";
    }
    if (contact) {
      answer = repeats > 0
        ? "I still haven't contacted your caregiver. This app cannot place calls or send messages. Can you open your phone's Contacts, or ask a nearby staff member to help you make the call?"
        : "I can't place a call or send a message from this app yet, and I haven't contacted your caregiver. If you can, open your phone's Contacts and call your caregiver. Would you like help explaining what to say?";
    } else if (unable) {
      answer = "If you can see a staff member or a trusted person nearby, you can say: 'I'm lost and need help contacting my caregiver.' I haven't contacted anyone for you.";
    } else if (active && /^(?:yes|please|yes please|help me|what should i say)$/i.test(normalized)) {
      answer = "You can say: 'I'm lost and need help. Can you help me contact my caregiver?' Tell them the town or landmark you can see. I haven't placed a call or sent a message.";
    } else if (repeats > 0) {
      answer = "I hear you. If you can, ask a nearby staff member or trusted person: 'I'm lost. Can you help me contact my caregiver?' I can't verify your location or make the call from this app.";
    }
    return { status: 'support', answer, supportSession: id, locationKnown: false, caregiverContacted: false, conversational: true };
  }
}
