# Engram × Jhonny: playable judge demo

Open **http://127.0.0.1:3000/simulation** with the local server running (`npm run dev`). There is also a **2D judge demo** link in the main navigation. Hosting and Telegram remain paused.

## Present it

1. Open the page in a wide desktop browser for a side-by-side world and conversation view. It also adapts to phone widths.
2. Optionally enable **Voice on** for browser speech synthesis.
3. Start in **Play as Alex · first person** and choose actions and conversation options. For automatic playback, select **Overview & walkthrough**, then **Watch the walkthrough**: 22 moments span two simulated days. Duration depends on model latency; a bounded timeout produces a labelled, source-backed fallback.
4. Judges can pause, choose destinations, trigger activities, and ask their own questions. Clicking a destination only moves Alex; activity buttons save events. Speech input is optional browser speech recognition, not Gemini Live audio.
5. Inspect **A memory trail you can inspect** below the scene. The conversation's expandable evidence lists actual source IDs.
6. **Restart story** removes only that run's simulation records and starts a fresh isolated patient. It does not delete the main weekly demo dataset.

## Original day-one scenarios

| Moment | Demonstration |
| --- | --- |
| Breakfast at 08:00 | Event ingestion, evidence source and daily log |
| Glasses placed at 09:00 | A small episodic memory |
| Ask where the glasses are | Actual database-backed recall |
| Sarah visits at 10:00 | Person relationship and labelled placeholder illustration |
| Ask about Sarah | Natural answer checked against evidence; picture display |
| Garden walk at 11:00 | Exercise activity in the daily journal |
| Advance to 13:50 | Existing Engram scheduler produces David's 14:00 visit reminder |
| Ask for a daily recap | Connected answer grounded in this run's accumulated logs |
| Outside familiar area at 14:05 | Explicitly simulated location and request for support |
| Ask for help | Offer of caregiver assistance |
| Simulate contact at 14:10 | Clearly labelled simulated receipt; no real contact |

## What is real, and what is simulated?

Real: the configured MongoDB connection; the existing EngramService, TeamContract and LifeRecords ingestion/schema; persisted source evidence; scoped retrieval; Gemini/provider invocation and answer checking; the existing reminder reconciliation/job/prompt code; per-run reset; source IDs.

Simulated: Alex, other characters, movement, events, scenario review approvals, clock advancement, location and caregiver acknowledgment. The scene is a controlled scenario, not a self-directed AI world. The automatic walkthrough chooses actions; Gemini does not autonomously decide to place real calls. There is no actual GPS collection, camera recording, emergency call, SMS or Telegram delivery from this screen. The simulation reads its small structured record set; it does not claim every question exercises Atlas Vector Search, native reranking, or Stream Processing.

The photograph card is an openly labelled fictional illustration. Recording input uses optional browser recognition; the ordinary companion remains the interface for the existing audio/camera workflow.

## Data and security

- Separate reserved database `engram_alex_simulation`, household `engram-simulation`.
- A unique `sim_...` patient per run. Main patient `demo-person-001` is untouched.
- No new schema changes required. Existing source/log/plan collections are reused.
- Local demo authorization is required; the API is disabled for public/production requests. Do not remove that check to publish it. A future deployment needs proper isolated-demo authorization.
- The opaque run ID is sent in a request header. Server validates actions against a fixed whitelist, enforces limits, checks scope, and disallows reset while a mutation is active.
- Runs are held in process memory for two hours, with a ten-run cap. After a backend restart, **Restart story** starts again; old database simulation records may remain for inspection because the in-memory run registry was lost. Do not confuse them with main patient data. Close/restart is not a database cleanup operation.
- The clock only moves forward. Reminder deadlines use Europe/London local time, including the daylight-saving change.

## Files and verification

- `integration/simulation.ts`: local API and simulation engine.
- `src/components/SimulationDemo.tsx`, `simulation.css`: map, playback, interaction, conversation and evidence UI.
- `integration/simulation.test.ts`: isolation, idempotency, scheduler, invalid operations and reset safety.
- `integration/verify-simulation.ts`: live Atlas end-to-end check; creates and removes its own disposable run. Run `npx tsx integration/verify-simulation.ts` while localhost is running. It invokes the configured model and uses quota.

Initial validation: all 189 tests passed. Live Atlas test saved seven events, produced one scheduler reminder, answered the glasses question with cited database evidence, and reset its own run. The browser walkthrough reached 11/11, including a Gemini-checked Sarah answer and labelled fallback answers. Real microphone input and audio playback still require manual device checks.

Suggested narration: “The world is simulated, but the memory operations are real. Watch an event become a saved record, then watch Jhonny retrieve it. We keep planned events separate from completed ones. The assistance receipt is simulated, so this screen never pretends a real caregiver has been contacted.”

## Two-day first-person update — 25 October 2026

The default mode is now **Play as Alex · first person**. Judges see a perspective room illustration and choose actions and spoken lines. Nothing auto-plays in that mode. **Overview & walkthrough** retains an automatic 22-moment journey across two days. Timings below are simulated London times, not wall-clock waiting periods.

Day one choices include breakfast (08:00), glasses on the bookshelf (09:00), Sarah’s visit (10:00), a garden walk (11:00), lunch (12:30), David’s reminder (13:50), the optional lost/contact scenario (14:05–14:10), David’s actual visit (14:30), and dinner (18:00).

Choose **Begin the second morning** from the bedroom to move to day two at 07:00. Skipped day-one events are never invented. Day two offers toast and eggs (08:00), glasses moved beside the kettle (09:00), Sarah’s visit reminder (10:50), Sarah returning with Emma’s drawing (11:00), rosemary watering (12:00), an album reminder (16:50), and album time (17:00).

**Best judge sequence:**
1. Day one: living room → leave glasses → welcome Sarah (optionally also David).
2. Bedroom → begin the second morning.
3. Ask “Who visited me yesterday?” or “Tell me about yesterday.”
4. Kitchen → move glasses beside the kettle.
5. Compare “Where were my glasses yesterday?” against “Where are my glasses now?”
6. Use the Day 1 / Day 2 / Both days filters on the memory trail.

Conversation choices include accepting or declining simulated caregiver contact. Scripted dialogue with Sarah is explicitly labelled and is not silently turned into factual memory. Questions to Jhonny read the run’s stored records. Plans remain separate from evidence that a visit happened. Earlier reminders are labelled as generated, not as proof the associated activity was completed.

Page refresh now resumes the same tab’s run using sessionStorage and a scoped state endpoint. Restart story resets both simulated days. A backend restart still clears the in-process registry; the page then starts a fresh run. Older simulation documents can remain for inspection, as described above.

Verification: **193 tests passed**, TypeScript and production build passed. Live Atlas verification stored 12 test events across two days and generated three reminders. Yesterday’s glasses answer referenced the bookshelf on day one; the latest answer referenced the kettle counter on day two. Both answers used labelled database fallback during this test. Its disposable run was removed afterward. Physical microphone and speech playback were not tested.

## Free-play sandbox — 25 October 2026

Free play is enabled by default. Room activities remain available on both days, including completed activities. Repeating an activity creates a new memory at the current simulation time; retrying the same request ID does not duplicate it. Conversation and navigation choices do not consume other choices. The café is directly accessible from room navigation.

The clock is paused until the player chooses +5 minutes, +30 minutes, +1 hour, +3 hours, or Next morning. Actions use the displayed time, not the old walkthrough's suggested hour. Time moves forward only; review older records with the day filter or ask about yesterday. This preserves a truthful chronology instead of rewriting existing events. Advancing time reconciles each reminder due time crossed, so jumping several hours does not silently skip scheduled reminders. The sandbox ends at the end of day two; Restart story starts a separate fresh run.

The optional guided walkthrough retains its original timing and idempotent story actions. It does not use repeatable sandbox actions. All data remains fictional and isolated. Tests cover retained choices, repeat timestamps, request idempotency, day-two access to old activities, reminder windows, and rejection of backward/out-of-range time changes.

## Database isolation update — 25 October 2026

All new Alex simulation runs use the reserved database `engram_alex_simulation`, through their own MongoDB store connection. Main `MONGODB_DATABASE` is not changed. Config rejects the main database using this reserved name. Each run additionally has its own sim_ patient and engram-simulation household. Simulation requests use their own run registry and only that store; main patient APIs do not read it. Same backend logic and configured model provider are reused, but model prompts receive only the simulation's scoped evidence/history. No model training or fine-tuning occurs. The database can share the same Atlas cluster/credentials; this is application/database separation, not a separate MongoDB permission boundary.

Existing historical simulation records from before this change may remain scoped under engram-simulation in the former database. This change does not delete or migrate those records; new runs neither read nor update them. The local server restart expires old run handles and the UI creates a new isolated run.

## Judge usability polish — 25 October 2026

Replaced merged day-one/day-two menus with stable, room-specific sandbox menus. Completed actions remain repeatable with clear wording. Added a visible four-step judge journey and Next reminder, which jumps to the nearest future dueAt and processes the scheduler. Action confirmations now name the actual saved time rather than a hardcoded morning/day. Reduced scene transition delay to 250 ms; this does not change model network latency. Improved fallback recap wording and restricted garden questions to garden/rosemary records. Verified 196 regression tests, TypeScript, build, and the live Next reminder transition to 13:50 with David's 14:00 prompt. All new run data remains in engram_alex_simulation.

## Sandbox logic and conversational context repair — 25 October 2026

Confirmed issues: activity choices were absent from model history; scripted dialogue bypassed the backend; scenes used lifetime completion flags; oldest-50 retrieval lost recent events; equal timestamps had ambiguous order; expired reminders could be narrated as current after large jumps.

Repairs: action evidence enters run conversation history; dialogue submits to the same ask route; follow-ups resolve the most recently named unambiguous person and recent activity evidence; history is returned on state reload. Scene object flags derive from chronologically ordered records; a past visit no longer means the visitor is presently visible. Per-action simulationOrder resolves ties, retrieval covers the explicit 1000-action run limit, guided time jumps process crossed due times, and expired prompts are not presented as newly current. Descriptions no longer assert a second visit or two-day album review merely because an action originally belonged to the second scripted day.

Limits: this remains a bounded fictional event sandbox, not a physical world engine. Scenes are illustrations, character movement/presence and travel time are not physically simulated. Run state/history lasts in the server process and expires after two hours; database records alone do not reconstruct a run after restart. Main patient data is not used. Tests verify Sarah→she, David→he, tell me more, what did we do, same-time object movement, >50 events, and next-day object persistence.
