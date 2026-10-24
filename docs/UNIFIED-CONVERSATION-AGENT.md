# Unified conversation agent — 25 October 2026

Implemented on Athul's separate codex/unified-conversation-agent branch after incorporating origin/main c180062. No edits to teammate model definitions or canonical schemas, no migration, and no remote push. The active integration lives in the root port-3000 application; the separate backend/server.js and frontend/ applications are not started or treated as authoritative by this mode.

## Implemented flow

1. The demo patient opens the existing companion. Start conversation explicitly starts microphone capture. Browser speech recognition identifies a finished utterance and the recorder collects correctly labelled browser audio. A thought is bounded to 30 seconds in the UI and one MB of encoded audio in the server. Finish this thought supports manual turn endings. Without browser speech recognition, recorded audio is submitted for Gemini transcription. With recognition, its transcript is sent to Gemini; raw audio is additionally submitted/retained only when selected. Browser recognition may use its vendor speech service.
2. POST /api/engram/agent/turn sends the transcript and/or audio to the configured model. Gemini returns question/information/mixed/unclear, a verbatim question segment, quoted assertions, topics and category proposals. Source-quote membership is checked. Question-only turns cannot contain factual items. Mixed turns recall only the question segment. Negation/uncertainty is conservatively preserved for routine reports.
3. Classified transcripts and topics enter agent_capture_turns, scoped to the server-selected household and patient. A stable client turn ID plus input digest detects retries/content changes. Per-patient in-flight work and existing request budgets bound generation. Cancellation is propagated to the model call and checked before the classified record is saved.
4. If the user enabled the session camera option and the turn contains information, the browser opens a visible preview, takes one JPEG snapshot and stops the camera. It cannot capture a past event or the interval before classification. No video stream is archived. Questions do not open the camera. Denial leaves a text-only path. Audio retention is a separate option.
5. POST /agent/commit stores permitted capture files privately in the agent_capture_media GridFS bucket, with scoped agent_capture_assets metadata. Gemini describes the visible scene conservatively, without face identity, medical or verified-location inference; its description remains unverified and separate from the quoted user assertions. No camera data becomes an approved factual memory automatically.
6. New information uses existing services: dated past episodes -> TeamContract draft plus source; dated routine activities -> LifeRecords daily-log draft; personal information -> personal-record fact draft. Names are preserved in text, not guessed as person IDs. Unknown times and future intentions -> adapter-owned agent_capture_proposals. This preserves the original schemas and avoids pretending future plans already happened.
7. For question/mixed/help turns, the main screen uses the existing answer-job and approved MongoDB retrieval path, then checked Gemini wording. Its source IDs/status are linked to the capture journal. Replies can be read aloud with browser speech synthesis. While the agent speaks or processes, its microphone stream is stopped; it resumes after completion when the user has kept the session active. Stop aborts pending client work and stops capture hardware. Some already persisted drafts/media can remain after cancellation; Stop is not a delete operation.
8. Daily topics and verbatim questions remain in the journal. A daily consolidation runs for the preceding London-calendar day on the first worker opportunity each running day, and can be invoked manually for the current/selected day. It writes a bounded draft daily_log, explicitly marking questions as questions and user reports as reports. It does not turn Did I take medicine into medication_taken. Consolidation includes the latest 20 saved turns in a bounded 4,000-character view; full turns remain available. It is not a complete transcript export or clinical summary. The server must be running; this is not an independently hosted cron service.
9. Caregiver tools contain Conversation journal and capture review. They can inspect draft records, confirm missing dates, approve reports, schedule a confirmed visit using a scoped existing person ID, or curate a captured image into the existing approved gallery. Images become recallable only after explicit caregiver linking to an already approved person/episode. Medication and other unsupported future plans must use the appropriate existing caregiver workflow; generic model output never enables a medical reminder.

## Categories and persistence

| Category | Destination | State |
|---|---|---|
| Past event with explicit date and clock time | episodes + sources | draft |
| Routine report with explicit event time | daily_logs | draft, outcome preserves report uncertainty |
| Personal fact/preference/relationship | personal_records (kind fact) | draft; linking a full person card remains caregiver work |
| Future intention or unresolved event time | agent_capture_proposals | review queue |
| Question, topics and turn provenance | agent_capture_turns | question/context, not factual completion |
| Optional raw snapshot/audio | agent_capture_assets + agent_capture_media | private draft capture |
| Daily conversation consolidation | daily_logs, activity other | draft, uncertain/report-only |

The time gate requires an explicit supported calendar date reference and a clock time in the quoted statement before auto-creating a dated record. Missing/relative ambiguous times are queued, rather than silently substituting recording time. Even accepted model-resolved times remain draft metadata for caregiver review. A camera snapshot is present-time context, not evidence that a reported past event happened.

## Routes

Existing companion or local demo access protects POST /agent/turn and POST /agent/commit. All new work stays under the root origin and server-selected patient. These capture endpoints share the model-start limiter with answers. The existing two-question job concurrency limit does not replace the capture service's own in-flight guard.

Caregiver key required:
- GET /admin/agent/daily?day=YYYY-MM-DD — transcript/topic view, review proposals, bounded draft list and sanitized asset metadata.
- POST /admin/agent/consolidate — {day}, optional today default.
- POST /admin/agent/resolve — proposal_id, explicit ISO event_time; future visits also require action schedule_visit, confirm carer_verified and scoped person_id.
- GET /admin/agent/media/:id — scoped private bytes, not a public URL.
- POST /admin/agent/curate-image — explicit caregiver label, target_type/person-or-episode, target_id and confirm carer_verified.

Responses never return audio/image bytes inside the daily journal. Source sidecar metadata and canonical draft IDs link back to each turn. Media is not deleted automatically; retention, deletion UI, individual accounts and multi-instance dispatch locking remain production work. This prototype uses existing shared caregiver/companion keys and the explicit localhost-only demo exception.

## How to test

Open http://127.0.0.1:3000 and refresh. Use the new Talk with your companion panel. Direct memory lookup remains collapsed underneath.

- Type a fictional preference and Send: information -> personal draft; camera stays off unless enabled.
- Start conversation, allow your browser microphone prompt yourself, speak one thought and pause. Check the transcript and classification.
- Ask Who is my daughter?: question -> recall, pictures/read-aloud; no factual medicine/activity record should be created from the question.
- Say a mixed turn with an explicit past date/time plus a separate question: verify each part is routed separately.
- Enable the visible snapshot option, share a fictional report and allow the camera prompt yourself. Verify the preview appears, one snapshot is taken and the camera turns off.
- Use Stop conversation: verify OS/browser recording indicators stop. No background always-on microphone is installed.
- In caregiver tools, enter the caregiver key and load the Conversation journal. Review draft records, resolve dates, approve a report and recall it. Consolidate the day manually and approve the draft journal if appropriate.
- Future intentions remain proposals. Use the explicit confirmed-visit form only for a genuine demo visit; no automatic activation of vague or medication plans.

## Verification

Synthetic unit/HTTP tests cover question-fact separation, mixed routing validation, exact quote checking, retry identity, dated draft storage, uncertainty/negation, date-review proposals, future-plan gating, explicit media consent, scope isolation, journal consolidation and caregiver gallery approval. The HTTP fixture uses mocked classification and no Atlas or real media.

Live Gemini classifier probe: an entirely fictional mixed event/question was split correctly, with exact source quotes, in 6.027 seconds. Browser UI test: FICTIONAL DEMO TEST: I prefer peppermint tea. was classified information and saved as a personal draft in the connected Atlas demo. This intentionally creates one clearly fictional turn and draft; it is not auto-approved. No live microphone or camera was activated by the agent during testing. Physical capture and OS permissions require user testing. The new screenshot is saved in ../tmp/unified-conversation-agent.png.

The London Bridge records from the earlier separate writer are not batch-imported by this feature. Historical migration needs the schema-preserving adapter corrections described in the previous review. The new panel uses its own authenticated internal service route and does not rely on the incompatible legacy dispatcher or direct canonical Mongoose writes.

## Backtracking

Use the dedicated branch/commit for this feature. Switching back to the prior branch restores the previous UI. Existing canonical schemas remain unchanged; source rollback does not remove the explicitly created capture turn/draft or adapter-owned collections. Do not drop collections or delete teammate records to roll back code.

Final automated verification: 136 app tests and 99 memory tests passed (235 total); TypeScript and production build passed. The live Atlas journal confirmed the browser test as information -> personal_records draft. Original facts remain excluded from patient recall until caregiver approval.
