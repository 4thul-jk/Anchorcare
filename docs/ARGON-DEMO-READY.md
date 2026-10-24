# Argon demo readiness — 24 October 2026

Work on Athul's codex/security-hardening branch. This is runtime/prompt-flow tuning, not model-weight fine-tuning. Sumesh's remote repository and MongoDB schemas were not changed.

## Configuration

Private .env now selects COMPANION_PROVIDER=gemini, GEMINI_MODEL=gemini-4-argon and GEMINI_COMPANION_MODEL=gemini-4-argon. The working key remains private; OpenRouter settings are preserved but not automatically invoked. The app was restarted with this configuration.

Argon generation attempts have a 40-second bound and short verification stages have a 25-second bound. Argon has zero automatic retries per stage, so slow reasoning is not repeatedly restarted. The total answer-job deadline stays 90 seconds; the browser deadline stays 100 seconds. Cancellation and source checks are preserved. Other models keep their previous timeout/retry policy. Page progress distinguishes generating from verifying.

## Verification

- An explicitly fictional in-memory family record was sent through Argon generation, source citation/quote checks and the separate entailment verifier. Both checks passed. Provider reported gemini-4-argon; generation 9.822 seconds, total 12.216 seconds. This is one observation, not a latency guarantee. No stored patient records were used for the probe.
- 123 app tests passed. Existing 99 memory tests passed in the preceding security verification; retrieval code was unchanged in this tuning step.
- TypeScript and production build passed.
- Read-only live app check confirmed mongodb storage, demo-person-001, Gemini/Argon configured and two approved pictures.
- No current reminders were returned. Existing seeded schedules may be expired; create a fresh future reminder via caregiver tools when demonstrating timing.

## Test now

1. Refresh http://127.0.0.1:3000 and connect with the existing companion access key.
2. Ask Tell me about my daughter. Expect Sarah's source-backed relationship and the labelled illustration. This is a fast approved-field lookup, not proof of a model call.
3. Ask Tell me about Sarah Mercer to exercise the conversational path. Allow time for generation and verification; inspect caregiver Conversation model diagnostics for an actual provider response and requested/returned model. Unverified wording must fall back rather than be trusted.
4. Ask Who is my physiotherapist? Expect David Lee from the approved role record.
5. Test a missing record with Who is my psychotherapist? Expect uncertainty/clarification, not an invented identity.
6. Open caregiver tools to create a fictional care-plan reminder a few minutes in the future and explicitly approve it. Keep the companion open; report unsure when due and review the response as caregiver. No dosage or ingestion claims.
7. Optionally pair a phone afresh from caregiver tools; local HTTP requires its page to stay open. Actual calls are still disabled.

The teammate's London Bridge input in test.memories remains outside this companion's engram retrieval path. No adapter, patient remapping or data import was introduced here.

Rollback: set COMPANION_PROVIDER=openrouter locally and restart for the prior free-provider path. Source tuning is committed separately from the security fixes so it can be reverted without changing schemas or runtime records.
