# Security review and hardening — 24 October 2026

Work isolated on Athul's local branch codex/security-hardening, based on 256ef5e. No push to Sumesh, schema migration, runtime record edit, API key change or real SOS/provider action was performed. Database collection names, shapes and patient mappings are unchanged. The current Express integration was the main executable attack surface assessed; this is a scoped code review, not a penetration-test certification.

## Findings and changes

| Area | Finding | Change and practical limit |
|---|---|---|
| Pending real-call permission | Dispatch checked liveCalls but did not check allowSos again. A previously queued call could dispatch after independent SOS withdrawal. | Reject liveCalls=true while allowSos=false; recheck allowSos before claiming a pending call. Regression test verifies zero provider attempts. Already submitted calls cannot be recalled by withdrawing permission. |
| Authentication abuse | Pairing had its own limiter, but general access-key and device-token authentication did not. | Bounded process-local per-IP traffic and device-auth limits, plus a failed-key budget. These do not replace per-user sessions or a shared reverse-proxy limiter. |
| Inference resource abuse | Valid shared credentials could repeatedly allocate provider work; only a global 100-job limit existed. | 12 answer starts/minute per hashed credential, separate 40 picture requests/minute, and at most two pending async jobs per actor. Credentials are not stored as limiter keys. Direct synchronous requests have start-rate limits but not the async-job concurrency cap. |
| Request-shape hardening | Routes independently validated fields but there was no uniform guard for operator keys, prototype keys or excessive nesting. | Reject non-object bodies, Mongo operator/prototype keys, excessive nesting and field counts before route processing. Existing typed scope/ID checks remain. This is defense in depth; no pre-existing universal NoSQL injection bypass was established. |
| Upload resource exhaustion | PNG had a pixel bound; JPEG/WebP only had byte/signature limits. A small compressed file could declare very large dimensions. | Validate dimensions for PNG/JPEG/WebP, cap pixels and axes, reject malformed dimensions and animated extended WebP. No decoding library or new dependency added. This is metadata validation, not complete media decoding or malware scanning. |
| Device metadata exposure | Companion /capabilities returned caregiver phone labels, IDs and provider configuration. | Companion gets delivery policy only. Caregiver-authorized status routes retain device management details. |
| Browser and error hardening | Main Express responses lacked framing/referrer protection; default malformed JSON errors could include framework details. | No Express advertising; nosniff, frame denial, no-referrer, restrictive base/object/framing CSP directives, API no-store, generic JSON body parser errors. This CSP deliberately does not claim full script-XSS protection; it remains compatible with development assets. |

Limits are process-local and keyed by real req.ip, with no newly enabled trust-proxy setting. General IP traffic is capped at 240 requests/minute; device authentication at 120/minute; failed broad-key authentication at 20/minute. Requests exceeding limits receive 429 and a Retry-After header. Shared public IPs can share an IP budget. Configure a proper shared gateway limiter before scaling or putting the prototype behind a proxy.

## Validation

122 app tests and 99 memory tests passed (221 total), including HTTP role/scope regression, injection-shaped requests, request limits, job concurrency/cancellation, metadata redaction, upload dimension limits and mocked SOS-consent withdrawal. TypeScript and production build checks passed. Root npm audit reported zero known vulnerabilities in the resolved dependency graph at check time; this is not proof that dependencies have no undiscovered issues.

No real provider calls or notifications were triggered by security tests. HTTP integration fixtures explicitly disable external inference. Test output is in ../tmp/security-tests.log and ../tmp/security-memory-tests.log; dependency report is ../tmp/security-npm-audit.json.

## Remaining risks and deployment boundaries

- Shared bearer keys are prototype authentication. Users of the same role/patient share an actor identity; this is not individual authorization. Phone tokens remain in localStorage to reopen notifications and are vulnerable if the origin suffers XSS or an untrusted person controls the device.
- Local HTTP exposes credentials to a hostile local network. Use a trusted demo network; production needs HTTPS, individual authorization, device management and deliberate secret rotation. No firewall or OS permissions were changed.
- The Vite development server must not be publicly exposed. Production build assets and the Node server should run behind HTTPS. Shared-IP proxy behavior needs deliberate configuration; blindly trusting forwarded addresses would undermine rate limits.
- The standalone engram-retrieval/src/server.js has its own origin/auth/body controls but was not retrofitted with this Express middleware. Do not publish that separate server as if it inherits these fixes.
- Browser sample policy state is not the authoritative Atlas action ledger. Python reference policy files are not a mounted API service.
- LLM prompt and entailment checks are not a formal security or correctness guarantee. The free router can change model. Model output still has no arbitrary database-write, dialing or location tool.
- SOS permission rechecks prevent dispatch of still-pending calls, but cannot undo provider submissions already in flight. No claim of guaranteed emergency delivery is made.
- This review did not test infrastructure IAM, Atlas account security, deployment TLS, remote account ownership, external teammate code absent from this repository, or repository history for every past secret. Local .env remains ignored and excluded from the commit.

## Backtracking

The hardening is contained in a separate Git commit on codex/security-hardening. Revert that commit or switch back to codex/phone-delivery-free-model to restore prior source behavior. No data rollback is needed because this work introduces no schema/data migration. Rebuild/restart after a source rollback; that does not restore any independently edited runtime data.
