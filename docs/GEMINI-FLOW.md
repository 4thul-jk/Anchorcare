# Gemini flow and diagnosis — 24 October 2026

The configured companion model is gemini-4-argon. A minimal non-patient probe returned HTTP 429 with Google's monthly-spending-cap error. This verifies a provider rejection of the requested model, not a successful Argon generation. No successful returned model identity was observed during this check.

## Changes

- Removed the separate Gemini tool-routing call from the live answer path. The deterministic request builder preserves date and activity constraints and includes approved personal context for varied wording. Gemini interprets the question against this server-selected context. The older tool module remains for compatibility/tests but is not invoked on this path.
- Retained bounded exact care-role and scheduled-plan lookups as fast paths. These do not require an available LLM and do not conflate psychotherapist with physiotherapist.
- Retained source-quote validation and a separate entailment check before showing natural generated wording. This still involves two model requests for generated-and-verified answers; it is not a single-call end-to-end conversation. If entailment is unavailable, only validated source wording is eligible.
- Kept all writes, SOS actions, calling and image approval outside generative answer retries.
- Classified billing/quota/access/model errors separately from timeouts. Permanent provider rejection opens a five-minute circuit per requested model; subsequent questions do not repeatedly send model requests during that interval. After expiry the next request probes recovery automatically. Process restart clears the in-memory circuit. Transient managed requests have at most one retry; raw requestWithRetry retains its general configurable default.
- Added caregiver-only GET /api/engram/admin/gemini and the Gemini connection diagnostics panel. Refresh it to view the requested model, actual response's model field when provided, latency, outcome and HTTP status. No raw prompts, source records, credentials or provider error bodies are logged. A received response alone does not confirm that answer validation passed.
- Provider errors no longer all become the misleading message that the service is taking too long. Patient-facing text is brief; billing remediation is shown in caregiver diagnostics.

## Restore and verify

Open the Google AI Studio billing settings for the project owning the locally configured API key. Resolve its monthly spending cap or use a properly provisioned project/key with Argon access. Keep credentials in local/server environment settings. Do not paste them into chat. The model name remains unchanged.

After recovery, restart the backend or allow the five-minute circuit to expire, then submit a varied question and refresh caregiver diagnostics. Check that providerStatus is not blocked, an actual response_received entry exists, and the answer cites the relevant current saved record. A successful live natural-language answer could not be established while Google's cap was active. Synthetic tests validate phrase handling, billing classification, circuit duplicate prevention and diagnostic redaction without provider access.
