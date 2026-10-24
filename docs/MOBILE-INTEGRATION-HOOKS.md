> Update: the phone-browser outbox, pairing and optional calling adapter are now implemented in [PHONE-LINK.md](PHONE-LINK.md). The older integration-requests endpoint below remains a blocked test hook and is never automatically replayed.

# Companion language and future device integrations

## Current flow

User message -> authenticated server -> support conversation OR scoped Atlas retrieval -> Gemini companion wording -> source/capability verification -> patient answer.

The private GEMINI_COMPANION_MODEL selects the conversation model independently of GEMINI_MODEL used elsewhere. The local demo now uses gemini-4-argon for both GEMINI_MODEL and GEMINI_COMPANION_MODEL, as requested. Memory answers retain fresh source checks. Help messages send up to six recent user turns from a server-owned support session. No provider interaction is stored (store:false), but this is not a claim about all provider retention policies. In-process support state expires after ten minutes and is lost on restart. This is not full general-purpose multi-turn chat.

Gemini help generation is bounded at fifteen seconds and verification at six. If either fails or verification rejects the prose, the deterministic truthful fallback is shown. Model checks are probabilistic, not proof of correctness. Support currently makes no calls, sends no messages and does not access GPS.

## HTTP hooks

All endpoints require X-AnchorCare-Key. Never put the Gemini or MongoDB key in a mobile client. Shared demo keys are not production authentication.

GET /api/engram/capabilities returns call_caregiver, message_caregiver and request_location with available:false, status:not_connected and requiresConfirmation:true.

POST /api/engram/integration-requests accepts:

```json
{"kind":"call_caregiver","idempotency_key":"mobile-request-123"}
```

Allowed kinds: call_caregiver, message_caregiver, request_location. The server chooses the patient/household from authenticated configuration and ignores client phone numbers and patient overrides. The response contains requestId, status:blocked_not_connected and executed:false. MongoDB collection integration_requests stores a scoped audit record. Reusing a key for the same scope/kind deduplicates the request. This is a blocked integration test record, not a queued message, a caregiver notification, or consent to execute later. Requests must never replay automatically when an adapter is added.

## Adapter contract

integration/capability-hooks.ts exports DeviceAdapter, DeviceAction and DeviceReceipt. A future native mobile or provider adapter implements execute(action). There is deliberately no public execution endpoint or adapter dispatch today.

Before wiring execution:

1. Replace shared demo keys with per-user authentication and patient membership checks.
2. Resolve the intended recipient from authorised caregiver contacts on the server; never accept a model-invented destination.
3. Capture fresh user confirmation and device permission, then create a new authorised action with consentId and an idempotency key.
4. Add the adapter dispatch and signed provider/device callbacks. Persist pending/completed/failed outcomes before the assistant describes them.
5. A call launch is not a connected call; a message submission is not delivery; a location request is not a GPS reading. Store timestamps, accuracy, permission and delivery states separately.
6. Test failure, cancellation, retries, replay, scope isolation, unavailable devices and revoked consent. Keep lost-person fallback usable during provider failure.

Native calling may launch the dialler; SMS may open a compose screen or use an authorised backend provider. The integrating team chooses and implements the platform adapter. No phone numbers or credentials are included in this repository.

## Verification

39 root tests passed, including unauthenticated rejection, scope isolation, duplicate hook requests, unsupported kinds, no automatic execution, rejected/failed Gemini wording, support-session expiry and source-backed memory answers. TypeScript and production build passed. Live Gemini help check returned responseSource:gemini_checked for a caregiver-contact request using the Guildford conversation, with no contact claim. Earlier attempts correctly fell back on malformed/truncated verifier JSON; increased verifier output limit and required JSON-only output.
