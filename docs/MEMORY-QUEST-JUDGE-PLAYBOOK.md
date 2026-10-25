# Memory Quest — judge playbook

Open http://127.0.0.1:3000/simulation. The default is the arcade map. All writes go to engram_alex_simulation; the main patient database is not used.

## A five-minute route
1. Select Living room, then Put my glasses on the bookshelf. Watch the Inside Engram panel show episodes + daily_logs + sources.
2. Ask Where are my glasses? using a choice or the conversation input. Linked evidence shows what supports the answer.
3. Invite Sarah, then ask Who is she? or show my daughter. This demonstrates relationship context and the labelled illustration.
4. Click Next reminder. The real scheduler produces a prompt at the controlled due time. A planned visit is not a completed visit.
5. Move to Café, select I don’t recognise this place, then Yes, ask Sam to help. The receipt is explicitly simulated: no real call, SMS or Telegram is sent.
6. Click Next morning and ask what happened yesterday. The clock changes; the saved memories do not disappear.

## Use the product, not only scripted choices
In Talk to Jhonny, type a fictional assertion such as "I like mint tea without sugar." The /api/simulation/converse route calls the same ConversationAgent classifier and commit logic as the main app, with a simulation-scoped service and isolated MongoDB store. The trace lists actual output collection IDs/statuses; information may become a personal report, dated log, episode or timing proposal. A question is not a completed event. Greetings remain conversation only. Gemini failures display an error instead of falsely claiming storage succeeded. Useful information and transcript provenance are retained. Camera/audio-file capture is not part of this game; optional speech input uses browser recognition.

Scripted activities use controlled fixture ingestion; they do not pretend to be Gemini-classified camera observations. XP measures feature exploration, never a dementia patient's performance or health. Plans and information needing review retain the main backend's safeguards. Public web/directions tools are not exposed through this isolated simulation.

## Verification — 25 October 2026
199 tests pass, TypeScript and production build pass. The new test verifies ordinary personal-information input through ConversationAgent, exact simulation scope, idempotent turn writes, and cleanup of conversation records. Previous tests cover date-aware recall, repeat actions, reminders, contact simulation, and main-database isolation. Live model calls can still time out; checked database fallbacks remain labelled for recall. Sessions expire with the server run registry; this is a local bounded two-day demo, not a deployed persistent game service.

## Daily XP and decision dialogue — 25 October 2026
The game now grants 100 XP per simulated day. Successful activity/conversation choices cost 5 XP; replaying the same activity request ID does not charge twice. Navigation, clock controls and SOS scenario choices are free so an exhausted budget never blocks assistance or advancing to tomorrow. XP resets by simulation calendar day, not page refresh. This is a demo resource, not a measure of cognitive ability or patient health. At day-two exhaustion, restart starts a new run.

Players can place glasses on the bookshelf, kitchen counter or bedside table. Latest recorded placement drives recall. Blue/green/purple favourite-colour choices write a preference in personal_records and a dated decision in daily_logs/episodes. The walkthrough shows scripted Alex/Sarah/Sam/David dialogue alongside Jhonny replies in world-panel speech bubbles. Scripted character lines are labelled and do not independently prove a real event; chosen activities and ordinary input use their respective saved-record paths. Pausing during dialogue prevents the next action from executing.

### Animated walkthrough (25 October 2026)
The Arcade world walkthrough moves Alex through corridor waypoints before each scene. Sam, Sarah or David appears for the relevant interaction; Jhonny is a floating companion. The latest dialogue appears in a speech bubble beside its speaker, with the complete text repeated below for small screens. Pause is available above the world. These animations are presentation only: activity writes still run through the isolated simulation API after arrival. Reduced-motion preferences disable movement transitions. No real contact or location tracking occurs.


### Scene-based Arcade controls
Arcade free play opens a close-up of the current room. Select an in-scene target or its accessible tile to open only that object's or person's choices. Choose another place opens the world map and destination buttons. Navigation and menu selection do not spend XP or create memories. Actual action and recall choices retain the existing API, timestamps and XP rules. Scene-menu tests ensure every sandbox choice appears exactly once, including conditional SOS contact options.


### Judge-facing page layout
The page now includes a collapsible How to play guide, XP/time rules, a six-step test route and explicit simulation limits. Essential time jumps remain beside the main controls, with a Jump to game link. Advanced clock controls and the saved-memory ledger are collapsed by default. Desktop keeps the companion beside the game; narrow screens stack them.

### Explicit scene entry
Arcade starts with a destination chooser. Entering a room reveals its interaction targets; selecting one reveals only its relevant choices. Chat is hidden until an interaction begins or Jhonny is selected. Leaving clears on-screen dialogue, pictures and tracing, and stops narration, but never deletes saved records. The full history remains in the isolated backend.

### Playable movie mode
Default first-person mode is now a 13-scene story. Each scene shows one dialogue and at most three choices. A successful action or recall reveals the response and a Continue control; failures keep the choice available. Scene transitions clear visible conversation, never stored memories. The duplicate chat/sidebar, room list and time controls are hidden in story mode. Arcade remains available separately for free exploration. Skipping a scene action does not write a completed event.

### Everyday-life story revision
The 15-scene narrative follows getting ready, breakfast, later glasses recall, breakfast reassurance, a daughter identity cue and optional visit, garden activity, an automatically scheduled afternoon cue, an optional physiotherapy visit, lost/support choices, and next-day historical/current recall. Continue advances the isolated clock to the next scene’s time before allowing entry. Skipped activities are not written as completed. Judge explanations are collapsed; fictional observation inputs are explicitly labelled. Sarah’s returned picture is visible inside story mode.

### Between-scene reminders
Active backend-generated prompts appear above story dialogue as a highlighted reminder card when Continue advances the virtual clock across their due time. Got it dismisses only the local card; it neither acknowledges a medical action nor marks a visit completed. Expired prompts are not presented as current reminders. The scheduled afternoon David visit is exercised by the story.

### Free conversation and SOS
Each story scene now offers Say it your way. Exact typed preset labels (ignoring punctuation and polite suffixes) select that activity; other input uses /api/simulation/converse and the shared classification/commit pipeline. The returned record categories and statuses are inspectable. Players can continue without selecting a preset; skipped activities are not recorded. SOS demo offers confirmation/cancel, then records the fictional lost scenario and simulated receipt, with no real communication. Live UI verified a peppermint-tea preference stored as personal_records / available_report.

### Unified top-down presentation
Interactive story now renders the same World map and speech bubbles as the walkthrough. At desktop widths, the map and choices sit on the left, with the typed Jhonny conversation and simulated SOS on the right. Mobile stacks them. Story progression and isolated storage behavior are unchanged. Sam’s kitchen position is on open floor, away from the table.

### In-game caregiver response
SOS now asks Sam to come to the current story room, rather than moving Alex to a generic café scenario. Typed yes/yes please after an assistance offer also accepts it. The request is recorded first; Sam then animates toward Alex and the arrival is recorded separately. Sam offers reassurance without asserting that a symptom has improved. Both events are free and confined to the simulation patient. No real communication occurs.
