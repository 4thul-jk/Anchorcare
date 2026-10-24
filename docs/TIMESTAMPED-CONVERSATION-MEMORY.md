# Timestamped conversation and location memory

Checkpoint: 25 October 2026. Branch: `codex/unified-conversation-agent`. This extends the automatic user-report checkpoint `8ccdf1d`. No teammate schema or remote main branch was changed.

## What happens

1. The browser assigns a conversation/session ID and stable turn ID. A server-owned recording/receipt anchor is captured before classification. Gemini receives the last eight turns from that same patient and conversation, including prior answers and their timestamps. Client-supplied history cannot override it.
2. Gemini separates assertions from questions and rewrites contextual questions for recall. A grounded rewrite checks its words against the current turn and stored context. It cannot introduce a call/contact action. A request such as “I need to remember her” becomes a daughter recall query if the context is clear, or a clarification if it is ambiguous.
3. Commit keeps the original words, `recordedAt`, `receivedAt`, `classifiedAt`, `savedAt`, timezone and session ID. The existing distinction between statement time and an actual event time remains: missing event times are never replaced with the time of speaking. Assistant replies retain `answeredAt` and bounded `lastAnswer` text. Retry IDs include the session in their input digest.
4. Explicit present first-person location statements additionally create a scoped `agent_location_reports` record with `reportedAt`, `storedAt`, `sourceType: user_report` and `verifiedGps: false`. No GPS is inferred from speech or pictures. Latest location recall sorts by reporting time; an explicit calendar-day query restricts reports to that London day.
5. Location replies say “You told me you were at ... on ...” and make clear that the current location is unconfirmed. No matching report produces an unknown-location reply and an offer to contact the emergency contact.
6. A contact offer is stored in `agent_contact_offers`, scoped to patient and conversation, expiring after five minutes. A direct next-turn yes/no consumes it once. Another conversation, an expired offer or a replay cannot accept it. Acceptance uses the existing policy-gated mobile SOS integration; it does not claim a phone call occurred. Actual calling still depends on enabled/configured providers and caregiver policy.
7. The screen displays timestamped user and companion messages. Reloading the tab restores the latest eight turns for its conversation. “Start a new conversation topic” clears active context, not stored memories. Daily journals now include each original turn timestamp.

## New/extended contracts

- Authenticated `GET /api/engram/agent/history?session_id=...`: last eight scoped conversation turns, bounded reply text, timestamps.
- `/agent/turn`: accepts `session_id`; returns `recallQuery`, optional clarification and time metadata.
- Existing `agent_capture_turns` gains conversation context/time/reply fields. Added own `agent_location_reports` and `agent_contact_offers` collections. Existing teammate episode/person/log schemas remain unchanged. No migration/backfill rewrites old data.
- Camera and original audio remain opt-in. Questions are not asserted as completed events. Medication and image review safeguards remain unchanged.

## Validation

- Application suite: 144 tests passed; type check and Vite production build passed.
- Regression cases cover original/latest location times, day filtering, patient/session isolation, daughter/pronoun continuity, ambiguous referents, forbidden contact rewrites, one-use and expired consent offers, and history authentication.
- Live Gemini check used only synthetic daughter history and a synthetic Guildford statement, without reading or exporting patient records: `gemini-4-argon` resolved the daughter follow-up in 3517 ms and classified `location_report` in 3059 ms.
- Microphone, camera and a real phone call were not tested by these checks. Typed turn tests and mocked/fixture tests do not establish clinical reliability.

## Demo test

Refresh localhost:3000. In Talk with your companion, send:

1. “I am in Guildford.”
2. “Where am I?” — expect Guildford with the original report date/time and an unconfirmed-current-location caveat.
3. “I am at London Bridge.” then “Where am I?” — expect the newer report.
4. “I want to see my daughter.” then “I need to remember her.” — expect daughter recall rather than a journal-only acknowledgement, using available approved family records/images.
5. Start a new conversation topic and ask “I need to remember her.” — expect clarification.
6. For an offered contact request, reply “yes please.” Expect the real integration status, including disabled/not-connected status when no phone provider is configured.

Limitations: bounded eight-turn context is not unlimited autobiographical memory; persistent structured records and journals supply longer-term retrieval. Location extraction supports explicit English present-tense first-person reports. User reports can be mistaken, and location wording is intentionally not a live-location guarantee. Old un-timestamped data is not assigned an invented historical time. Browser speech still requires permissions and runs only after Start.
