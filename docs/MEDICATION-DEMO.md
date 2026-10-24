# Fictional medication reminder demo

This is a reminder to check a caregiver-approved care plan. It does not select a medicine, generate dosage instructions or verify ingestion. No real patient or prescription is included.

## Included simulation

Source data: fixtures/medication-simulation.json. Seed command: npm run demo:seed-medication. The seed is restricted to MongoDB and patient demo-person-001. It creates six scenarios under a stable household/patient/day namespace:

| Scenario | Stored behaviour |
| --- | --- |
| taken | Patient report, reported_done, draft daily log; not verified ingestion |
| not_taken | Patient report, reported_not_done, caregiver review required |
| unsure | Patient report, uncertain, caregiver review required; no repeat instruction to take medication |
| unanswered | Expired reminder with no response; does not establish a missed dose |
| draft | Unapproved schedule; worker cannot deliver it |
| upcoming | Approved single occurrence scheduled one minute after first seed |

Historical examples are generated with a controlled clock and quiet-hours/cooldown disabled only in that synthetic seeder service. The live worker keeps its configured quiet hours and cooldown. Existing scenario records and responses are preserved on repeated seed runs. The upcoming time does not reset on rerun. Use the UI to make a fresh schedule when demonstrating later. This is one occurrence, not recurring prescription management.

## Run the full demo

1. Open Caregiver memory tools. Connect using the private ANCHORCARE_ADMIN_KEY.
2. Find Medication reminder simulation. Review the six existing examples; press Refresh caregiver review.
3. Enter a fictional label and care-plan reference. Set seconds from now to 60 and select Save draft schedule.
4. Review the draft and click Approve this care-plan reminder before its time. No draft can trigger a prompt. Cancel schedule invalidates delivery.
5. Return to Patient Companion. Connect using ANCHORCARE_COMPANION_KEY. Keep the app open and look at Reminders. The worker checks every two seconds; UI polls every three seconds. Quiet hours or the configured cooldown can delay delivery. Wait for the reminder rather than creating another schedule.
6. Choose Taken (my report), Not taken, Unsure or Remind me in a minute. Snooze delays the same prompt by one minute. Taken/Not taken/Unsure closes that occurrence and records a user-report daily log.
7. Return to caregiver tools and refresh review. The response appears with a review flag. Enter a follow-up note and Record caregiver review. This acknowledgement does not change the daily log to verified ingestion or approve it as a clinical fact.
8. Existing daily-log review can separately approve a report for retrieval; approval still does not prove ingestion. Pending medication reports remain draft and are not used as approved patient memory answers.

Reminder expiry is ten minutes after the scheduled time. An unanswered row appears when the window has expired. There is no automatic call, message, push notification or alarm audio. Read aloud remains available for companion answers; medication reminder audio and background delivery are not implemented.

## API

All routes use X-AnchorCare-Key. The patient scope is chosen server-side.

- POST /api/engram/admin/medication-plans (caregiver): id optional, label, care_plan_ref, scheduled_at as ISO datetime including timezone. Creates a draft.
- POST /api/engram/admin/medication-plans/approve (caregiver): plan_id and status:carer_verified. Requires an unexpired future draft.
- POST /api/engram/plans/cancel (caregiver): plan_id.
- GET /api/engram/prompts: pending deliverable reminders.
- POST /api/engram/medication/respond: prompt_id and action:taken|not_taken|unsure. One immutable self-report per prompt; retries with the same response deduplicate and a conflicting response is rejected for caregiver follow-up.
- POST /api/engram/prompts/respond: medication prompts permit only snoozed; generic acknowledgement is not a medication report.
- GET /api/engram/admin/medication-review (caregiver): latest 100 schedules with responses, unanswered state and review requirement. Refresh manually.
- POST /api/engram/admin/medication-review (caregiver): response_id and note. Records review acknowledgement, not medication verification.

Collections: plans, prompt_jobs, prompts, medication_responses, daily_logs, audit_events, demo_scenarios. On MongoDB the patient-response transaction checks and writes the plan, closes the prompt, inserts the daily log and response, and appends an audit event atomically. Writing the plan makes cancellation conflict with a concurrent response. The in-memory implementation is isolated test mode and does not claim database transactions. Gemini never schedules medication, changes a dose or confirms an action. Scheduling and prompt delivery are deterministic; Gemini 4 Argon remains in the conversation flow.

## Validation and timeline

2026-10-24: added separate draft/approve APIs, extended the existing worker, implemented transaction-backed self-report and caregiver review, and added patient and caregiver controls.

51 app tests, 99 memory-service tests, TypeScript and production build passed. Live fictional Atlas test approved a new schedule, waited for a worker-delivered prompt, saved unsure, retried without a duplicate, confirmed the prompt closed and recorded a caregiver acknowledgement. The six simulated review states were checked over the authenticated HTTP API.

First simulation seed: 2026-10-24T09:48:41.636Z; upcoming occurrence: 2026-10-24T09:49:41.636Z (10:49:41 Europe/London). Scenario namespace: med_demo_44ccb800123883e2. These are historical test times after that moment, not a daily recurring schedule.
