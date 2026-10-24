# Automatic useful-information storage — 25 October 2026

Policy change requested by the user: everyday valuable information should be saved and usable without waiting for caregiver approval. Changes are on Athul's codex/unified-conversation-agent branch; no edits to teammate schemas or remote main.

## Diagnosis

The read-only journal check found one recent activity already persisted in agent_capture_turns and agent_capture_proposals. It had no exact event time, so it was withheld from canonical recall. This looked like a failed write even though the journal/proposal existed.

## New behavior

Gemini now explicitly judges memory_worthy for each assertion. Meaningful patient-related preferences, relationships, experiences and routine reports qualify; greetings and filler do not. All selected quotes must still appear verbatim in the transcript. Questions remain questions, not facts. Valuable ordinary personal facts, dated episodes and daily reports become available for recall automatically with sourceType user_report. Existing reviewStatus approved is used as a retrieval eligibility flag; it does NOT mean a caregiver verified the claim. A separate audit action agent_auto_available_user_report records that distinction. No new canonical fields or status enums are introduced.

When event time is unknown, the original statement is saved as an available personal note explicitly saying its event time is unconfirmed. The date-review proposal remains separate, so recollection can refer to the report without inventing a dated event. A future intention can be saved as a reported intention but does not create or activate a reminder. Medication, injury and other matched medical/safety-sensitive assertions remain draft/review items. Camera-image publication still needs caregiver labelling and approved linkage. No automatically extracted person name overwrites a curated person card or contact.

Replies preserve attribution (you told me) and do not present automatic storage as independent verification. The UI now distinguishes saved and available user reports from items needing review. Relationship lookup can quote new user-reported relationship facts, without silently replacing a curated identity.

## Scope and limits

This applies to newly committed capture turns; it does not bulk-approve historical drafts or old review proposals. Repeat a previous test statement as a new turn to exercise the new policy. A saved-turn retry returns the original result and does not re-publish a withdrawn record. The automatic helper only publishes newly created records; it skips records already reviewed. Question journals remain report-only consolidation drafts under the preceding policy.

Existing schemas and collection names are unchanged. The lightweight sensitive-term gate is deliberately conservative and is not a clinical safety classifier or a formal guarantee of correct extraction. Gemini's value judgement and all reported facts can still be wrong; caregiver correction/withdrawal remain available. Unknown dates are never fabricated for convenience.

## Test

Send an explicitly fictional preference, then ask about it through recall. Expect a personal_records user report with recall eligibility enabled and an automatic-publication audit entry. Send an undated ordinary activity: expect an available time-unconfirmed note plus an optional date-review proposal. Questions and filler must create no new factual records; a medication assertion must stay review-gated. Retrying the same turn must not duplicate or restore withdrawn records.

Validation: 139 app tests, TypeScript and production build passed. A live explicitly fictional preference was classified by Gemini, saved with output status available_report, and returned by the companion personal-record endpoint without a caregiver action; sourceType remained user_report. No historical draft batch migration was performed.
