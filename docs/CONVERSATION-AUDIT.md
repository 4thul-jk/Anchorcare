# Conversation cross-check — 24 October 2026

## Outcome

78 application/integration tests and 99 underlying memory-service tests passed (177 total). TypeScript and production build passed. Added 26 audit tests, including table-driven topic-switch cases. Real microphone hardware and arbitrary future LLM phrasing are not covered by these tests.

## Reproduced and fixed

- An active support session could interpret title-cased questions such as Who Is Sarah as a place name. Explicit question prefixes now prevent that classification.
- I am confused about my medicine entered disorientation support. Questions about a known memory topic now proceed to retrieval rather than the lost-person script.
- Where am I? and the unpunctuated i dont know where i am did not enter location-uncertainty support. Both now receive an honest unknown-location response without invented GPS.
- The provider-failure router missed Will Sarah visit today?, Any visits today?, pills and tablets. It now recognises these forms.
- A Gemini tool call could propose today when the user explicitly asked yesterday. A shared date validator checks question dates before inference and validates the tool day against the explicit user day.
- A question containing yesterday and tomorrow could silently select one date. It now asks for one day at a time. Last night and tonight map explicitly to calendar days; London DST bounds are preserved.
- Repeated submits are ignored while a request is pending. Changing the access key resets the busy state as well as the authenticated session and result.

## Tested transitions

Each memory query is tested after I am lost; the same matrix is also exercised after hello and contact my caregiver, including repeats with the old token.

| Input | Required routing |
| --- | --- |
| is anyone visiting me today? | Memory plans and relationships |
| Is Anyone Visiting Today | Memory plans, not a place report |
| Who Is Sarah | Personal records, not a place report |
| Can you tell me my name? / my name | Personal records |
| I cannot remember my name | Memory retrieval, not location support |
| I am confused about my medicine | Memory retrieval |
| When did I call my daughter? | Past memory, not a new phone request |
| Has my daughter visited? | Past memory |
| Tell me about Sarah | Memory retrieval |
| Do I have visitors today? | Scheduled plans |
| Did I take my pills yesterday? | Medication daily reports |
| I am in Guildford | Unverified user-reported place in active help context |
| Can you call my caregiver? | Contact capability response, no execution |
| I cannot use my phone | Help follow-up |

Other tests cover session expiry, actor isolation, invalid provider calls, unsupported arguments, malicious patient overrides, draft/cancelled reminders, stale citations, transactions, uncertainty, and timezone conversion.

## Live Argon + Atlas verification

Started a lost-person conversation, then sent these follow-ups with its support token:

- is anyone visiting me today? -> HTTP 200, Gemini tool selection, plans + personal_records, natural answer identifies Sarah Mercer and 3 PM scheduled visit.
- Can you tell me my name? -> HTTP 200, deterministic routing fallback, personal_records, natural answer identifies Alex Mercer.
- I am confused about my medicine yesterday -> HTTP 200, Gemini tool selection, daily_logs, evidence_only after generation timeout. No location advice or claim of ingestion.
- Who visited yesterday and who is coming tomorrow? -> HTTP 400 with a user-facing clarification to ask one day at a time.

A successful routing test does not mean every Gemini answer will be fluent. Model timeouts and rejected prose still return uncertainty or source evidence. The application must never replace that with unrelated location instructions or fabricated patient facts. There is no claim that all possible language errors have been eliminated.

## Re-run

Use the supported bundled Node runtime or Node >=22.12.0. Run npm test, npm run test:memory, npm run lint and npm run build. The regression matrix is integration/conversation-audit.test.ts. Live API checks require the private environment configuration and the running local server; do not paste keys or database URLs into reports.
