# Gemini cancellation and automatic recovery

## User behaviour

The Patient Companion now starts a background reply job instead of holding a single long HTTP request. It displays checking/retry progress, can show fresh saved evidence or a truthful support fallback while waiting, and polls until a checked answer or a terminal failure arrives. Cancel reply and Return to memory questions cancel the server job as well as local polling. Changing access keys or leaving the view cancels work where the job ID is known. Request-generation guards prevent late results from replacing a newer question.

Gemini 4 Argon remains the configured model. The manager does not switch models or restart Gemini. No provider failure can be eliminated by this code.

## Retry policy

integration/gemini-manager.ts owns the policy for the main integrated companion's tool selection, answer generation, wording verification and help language. Each stage gets one initial attempt and at most two retries. Backoff starts around 600ms, doubles and adds jitter. Retry-After is honoured within the overall job deadline. The SDK receives an AbortSignal and retries:strategy:none, preventing nested SDK retries. A local attempt deadline aborts its HTTP request before recovery begins. Aborting the client request does not guarantee that the provider stops all compute or avoids charges for work already accepted.

Eligible errors: temporary network errors, local request timeouts, HTTP 408, rate-limit 429 and 500/502/503/504. Known exhausted daily quota, billing/prepay problems, invalid credentials and other permanent errors are not retried. A valid no_support decision or a rejected evidence check is not a transport failure and is not blindly retried.

Current per-attempt stage limits: memory tool selection 10 seconds, answer generation 15 seconds, answer verification 6 seconds, help generation 15 seconds and help verification 6 seconds. Jobs have a 90-second overall deadline, including recovery and retrieval. A browser polling session has a 100-second ceiling. Polling retries temporary connection failures twice and never retries invalid credentials. This is bounded recovery; it is not an endless monitor.

The legacy synchronous /ask and /answer routes remain compatible, use the same manager and abort on disconnection or their overall deadline. The separate standalone engram-retrieval server is not migrated to the new job endpoints.

## Job API

All endpoints require the existing private X-AnchorCare-Key and use the configured patient scope.

- POST /api/engram/asks: {question,supportSession?}. Returns HTTP 202 with jobId, state and phase.
- GET /api/engram/asks/:jobId: state pending/completed/failed/cancelled, progress phase and optional interim/result. Job IDs are random; the authenticated patient/actor must match.
- POST /api/engram/asks/:jobId/cancel: cancels provider work and suppresses late results.

Jobs are in process memory, expire after ten minutes and are bounded to 100 entries. They do not survive a server restart. If creation loses its network response before the browser receives the job ID, the browser may be unable to cancel that job; the server deadline still limits it. Production should replace shared demo keys with per-user authentication and add durable, owner-scoped job storage if restart recovery is required.

## Evidence and action safety

Fresh memory retrieval is performed before a completed result is delivered by polling; citations are validated again. Interim source context is refreshed before delivery too. Withdrawn/changed support prevents an old generated answer from being returned. No unverified generated text is streamed to the patient. The manager wraps inference only: it does not retry medication reporting, approval, phone calls, messages or other external actions. The independent reminder worker continues during a reply job.

## Validation — 24 October 2026

86 app/integration tests, 99 underlying memory/reminder tests, TypeScript and production build passed. New coverage includes transient failure then recovery, timeout abortion before a retry, retry limit, no retry on bad credentials or exhausted quota, cancellation while waiting or in flight, actor isolation, total job deadline, expiry, stale answer suppression, revoked memory evidence, interim display and browser polling recovery.

Live Atlas + Gemini 4 Argon: a name question was accepted as a job in 90ms and completed with a checked natural answer in about 12.4 seconds. A second job was cancelled and returned no late result. The prompts endpoint stayed available while the first job was running. The live request did not need a retry; transient recovery was verified using controlled failing-provider tests rather than claiming a real provider outage was induced.

Reference: https://ai.google.dev/gemini-api/docs/troubleshooting
