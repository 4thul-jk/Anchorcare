# Database organisation and automatic storage

Cleanup checkpoint: 2026-10-24 21:49 UTC / 25 October in India. Branch: codex/unified-conversation-agent.

## Active versus shared databases

- `engram`: active AnchorCare demo database. Its individual collections have different jobs; they are not duplicate folders.
- `test`: teammate ingestion database. It contains 52 memories and 126 conversations at inspection. Preserved because another laptop may still use it.
- `__mdb_internal_search`: MongoDB-managed search/automated-embedding internals. Never delete or rename this database.
- `engram.memories` and `engram.conversations`: teammate integration data. Preserved; automatic deletion would lose team input.

## What was cleaned

Four expired `mobile_pairings` records in the configured demo household/patient scope were backed up privately, then deleted. No memory, image, audio, session, audit history, collection, database, search index or teammate schema was deleted or renamed. Backup: `.private-backups/storage-cleanup-2026-10-24T21-49-07-115Z/expired-pairings.ejson` (Git ignored). Pairing records contain hashes/expiry state; deleting expired codes does not revoke a paired phone.

The empty `memory_state`, `rehearsal_sets`, `recall_attempts`, `practice_slots` and `alerts` collections are used by existing code and were retained. Removing them and their indexes would be cosmetic and could damage optional functionality. Required GridFS files/chunks pairs were preserved together.

## Readable labels

`integration/storage-catalog.ts` maps every inspected collection to a group, plain-language name and purpose. Caregiver memory tools -> Load daily journal -> Database organisation displays that map with current counts. Original names remain visible for debugging. Unknown collections are labelled Unmapped team collection and preserved.

Groups: Memories; Conversations; Pictures; Reminders; Care assistance; Phone links; Recall practice; Audit; Demo setup; Team integration. Descriptions are maintained alongside the code; this does not require changing the teammate schema or renaming an Atlas collection.

## Automatic decisions and UI correction

Useful individual statements already save automatically as timestamped user reports based on Gemini extraction. Recordings/transcripts remain saved even if no lasting fact is extracted. Session reports are now `reviewStatus: auto_saved` with `notVerified: true`: no approval is needed for storage. Previously saved report metadata remains unchanged. The patient summary no longer says caregiver review needed, and raw Markdown/64-character IDs are presented as readable paragraphs. Supporting retrieval candidates stay collapsed by default.

A generated report is still an AI summary, not proof of identity, a completed event or medicine ingestion. Unclear dates and medication actions keep their separate scheduling/action safeguards; saving information does not authorise an action.

## Maintenance

`npm run storage:inspect` lists names, descriptions, counts and expired-code cleanup candidates without deleting anything. `npm run storage:cleanup` backs up and removes only expired pairing codes in the configured scope. Both use private environment configuration and never print connection strings. Do not delete or rename other collections based only on their count. Do not commit backup contents.
