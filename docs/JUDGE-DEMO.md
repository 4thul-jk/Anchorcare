# Judge testing build — 25 October 2026

The ordinary public URL remains a restricted showcase. A signed invitation opens the full companion controls on the separate `muse_public_demo` database / `muse-public-demo` household only. It does not grant administrator access or expose the original private patient database. Judges share fictional Alex and may see fictional facts other judges add; do not submit actual personal information.

Run `npx tsx integration/create-judge-link.ts` to create `tmp/JUDGE-DEMO-LINK.txt`. Share that file's first line privately with judges. Invitations expire after 24 hours; rotation of the companion key revokes all invitations. The invitation is passed in the URL fragment (not server access logs), exchanged for an HttpOnly Secure SameSite cookie, and removed from the address bar. The signing key is never sent to the browser. Cookies cannot outlive the signed expiry. Opening in another browser requires the invitation again. Keep the link out of Git and public submissions; use the ordinary showcase URL for public listings.

## Test sequence

1. Open the private link over HTTPS. The page must show **Judge testing workspace**, with no access-key entry.
2. Send an invented personal fact such as “My favourite flower is a sunflower.” Wait for its save confirmation; ask “What is my favourite flower?” Confirm recall.
3. Ask “Show me my daughter” and “Who is my physiotherapist?” Sarah Mercer is the fictional daughter; David Lee is the physiotherapist. Pictures are labelled illustrations, not photographs.
4. Start conversation, grant microphone permission, and speak. Optionally enable visible snapshots / original audio retention. Stop and save report. Do not use actual sensitive information or other people's images.
5. Press **Test a reminder in 30 seconds**, keep the page open, and acknowledge the fictional photo-album prompt. This uses the existing durable plan/worker/prompt mechanism, not a browser-only fake timer. The button is restricted to invited judge sessions and rate limited.
6. Optionally grant location permission on the device in use. It records that device's consented position; use only if comfortable sharing it in the fictional workspace. Do not claim someone else's current position from a past self-report.

## Limits

Calls, Telegram and other external providers are not connected by this build. A queued SOS is not a completed call. Camera reports and ordinary user statements are reports, not independently verified facts. Medication scheduling retains its existing safeguards. Judge access cannot create arbitrary medical instructions or administer records. Gemini/Atlas availability and free Render cold starts still affect latency. Free hosting is not suitable for reliable unattended safety monitoring. Retention for conversation sessions remains one hour; promoted fictional memories persist in the fictional workspace. No destructive reset endpoint is exposed.

## Implementation

Added signed invitations and cookie validation in `integration/judge-access.ts`; exchange and fictional reminder routes in `integration/engram.ts`; automatic invitation entry and a testing guide in the patient UI. Existing private/local configuration and team schemas are unchanged. `integration/create-judge-link.ts` writes credentials only into ignored `tmp/`.
