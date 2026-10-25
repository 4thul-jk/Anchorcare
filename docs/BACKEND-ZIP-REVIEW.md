# Comparison with backend (1).zip

Reviewed 25 October 2026. Source: the user-supplied Downloads archive. Inspected source files without running its server, Telegram bot, TTS or database writes. The archive contains a .env file and embedded bot credentials; their values are excluded from this report. This review does not change schemas or application behaviour.

## Which backend is running?

The current app starts root `server.ts`, which mounts `integration/engram.ts`. The production Docker CMD does the same. It does not start the ZIP's separate `backend/server.js` Socket.IO server on port 5000. Existing repository backend files differ from the archive; the archive's three agents are absent at those exact paths. Adapted counterparts already exist under `integration/team-agents/`.

## Feature comparison

| ZIP logic | Current working Muse | Assessment |
| --- | --- | --- |
| Audio/text to Gemini | ConversationAgentPanel and integration/conversation-agent.ts | Implemented through HTTP recorded-audio turns, not Socket.IO |
| Camera frame supplied to Gemini | Consented snapshots and session report analysis | Implemented with a different flow; the ZIP attaches an optional frame directly to a turn |
| Extract useful memory and save it | Classified source-backed items; ordinary reports auto-available | Implemented with meaningful-information filtering and separate sensitive/timing safeguards |
| Recent conversation context | Scoped turn history; six preceding turns for memory answers | Implemented |
| Recall from MongoDB | Semantic/text retrieval plus dated daily logs, identities and plans | Implemented; ZIP instead supplies only the most recent ten Memory documents |
| Safety flags | Evidence-backed care assessment and policy-gated contact offers | Implemented with different escalation policy |
| Telegram notifications and caregiver commands | Adapted TelegramAgent and CaregiverAgent | Code exists; hosted notification/bot flags remain disabled and require private configuration |
| Timestamped history | Recording timestamps, explicit event times and timezone-aware recall | Implemented with separate recording/event times |
| Server-created speech audio | Current Muse uses browser speech synthesis | Not the same; ZIP's Translate TTS helper is not active in Muse |
| Socket.IO audio_response/conversation_update | HTTP answer jobs polled every 250 ms | Not implemented as Socket.IO; equivalent user flow uses a different transport |
| Retain original media | Private GridFS audio/snapshots with consent | Implemented; ZIP passes camera frames to inference but does not persist the image bytes in its memory/source writes |

## Integration defects in the ZIP

1. **Forwarding authentication mismatch.** anchorcareDispatcher.js sends Authorization: Bearer. The current mounted /api/engram integration expects X-AnchorCare-Key. The forwarded request will not authenticate against the current app with that header alone.
2. **Forwarding payload mismatch.** The ZIP sends subject_id, text, occurred_at and provenance. Current TeamContract.ingest requires patient_id, id, start, gist and original evidence/source IDs. Idempotency-Key alone does not supply the required episode ID. After authentication is fixed, the current payload still fails validation.
3. **Database/household mismatch.** The ZIP hardcodes anchorcare-demo/demo-person-001 and uses arthur_01 in several places. The hosted judge demo uses muse_public_demo/muse-public-demo/demo-person-001. Sharing an Atlas cluster does not make those scopes interchangeable. mongoose.connect also follows the database in its URI; a comment saying engram does not select that database.
4. **Writes may remain invisible to recall.** Directly written episodes have pending_caregiver_review. Current patient recall expects approved records; ordinary Muse auto-available reports use a different controlled path. Merely inserting episodes does not complete ingestion into usable memory.
5. **Event time can be wrong.** The ZIP writes eventStart: now even when extracted_memory.when describes the past, and substitutes recording time for missing event time. Recording time must remain separate from an asserted event time; future intentions must not become reported_completed events.
6. **People are names rather than canonical IDs.** ZIP personIds takes extracted names. The current contract checks for existing scoped person IDs.
7. **Unprotected access.** ZIP Socket.IO joins a client-supplied patientId, defaults sockets to arthur_01, permits any origin and exposes the caregiver endpoint without authentication. It must not replace the current scoped authentication layer.
8. **False safety alerts/claims.** Broad keywords such as help, fall and how many can trigger alerts without current-turn semantic evidence or negation handling. Some fallback speech claims a doctor/family is being notified regardless of confirmed delivery. Our active flow tracks the requested/queued/accepted state instead.
9. **Incorrect daily report window.** The ZIP caregiver agent labels the newest eight memories as today's summary without filtering a calendar day; all-time alert counts are also used.
10. **Credentials and Telegram access.** The archive includes .env and hardcoded bot credentials. Its Telegram bot accepts messages from arbitrary chats without the current caregiver allowlist. Rotate embedded bot credentials before using or sharing that code, and keep .env out of shared source archives.
11. **Failure fallback loses voice meaning.** If Gemini fails on audio without a text transcript, searchMemoriesAndRespond receives text=null rather than a recovered transcription. Its recent-memory keyword matching can select a different meal/day and hardcodes Arthur.
12. **Persistence is not acknowledged reliably.** Save errors are logged and the assistant response still proceeds, so a user can hear a saved-memory acknowledgment when the write failed. Direct canonical writes and background forwarding also have separate failure paths rather than one verified ingestion result.

## Recommendation

Keep the running Muse pipeline as the integration point. Adapt teammate input to the current authenticated ingest contract, the chosen database/household/patient and explicit source/event timestamps. Resolve person names to IDs and return an acknowledged save status. Reuse the already adapted Telegram/caregiver roles after configuration. Treat server-streamed speech or Socket.IO as an explicit transport upgrade, rather than swapping in this backend wholesale. No schema replacement is needed to obtain the core capabilities.
