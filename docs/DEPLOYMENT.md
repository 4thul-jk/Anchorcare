# HTTPS deployment preparation

Prepared 24 October 2026. No public deployment has been created; the local Wi-Fi demo remains available.

## Deploy the same Node service

Use a host that supports a persistent Node 24 process or the included Dockerfile, HTTPS termination, outbound Atlas access and Web Push connections. This is a long-running server with reminder/dispatch workers, not a static-site deployment or short-lived function. Start with one instance; do not enable multi-instance scaling until worker concurrency has been reviewed.

For a Node host: install with `npm ci`, build with `npm run build`, and start with `npm start`. Keep build dependencies installed because tsx currently runs the server. Set NODE_ENV=production, HOST=0.0.0.0 and the platform's PORT. For a Docker host, build the included Dockerfile. Its .dockerignore excludes local secrets and local data. Docker execution has not been verified in this workspace.

The host must serve public/phone-sw.js as /phone-sw.js, public/phone.webmanifest as /phone.webmanifest and /phone as the application. The production Express server serves the built copies automatically. Do not add CDN caching for authenticated /api responses. Allow the standard same-origin API requests without rewriting their Origin header.

## Server-only environment

Copy the variable names from .env.example into the host's secret settings. Transfer the existing private values locally; never commit .env or expose keys with VITE_ prefixes. Preserve the local setup.

- Existing MongoDB URI, database/household/subject settings and distinct caregiver/companion access keys.
- Existing Gemini API key and selected gemini-4-argon model settings.
- VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT from the locally generated notification identity. Preserve the same pair after redeployments. Only the public key is exposed to paired devices.
- PUBLIC_APP_ORIGIN=https://your-actual-host.example (replace with the real HTTPS origin; no trailing slash). This enables strict Origin comparison behind TLS termination without trusting arbitrary forwarded headers.
- ENABLE_LIVE_SOS_CALLS=false. Keep Twilio live calls off during initial deployment. Use the separate provider and permission setup in PHONE-LINK.md when ready.

Allow this deployment's outbound address in Atlas Network Access using the hosting provider's supported egress configuration. Keep existing database credentials out of build arguments and image layers.

## Verify after deployment

1. Open the actual HTTPS URL and connect using the existing caregiver access key. Confirm Atlas records and Gemini answers before pairing phones.
2. Open /phone on the handset using the same HTTPS origin. Create a new short-lived pairing code in caregiver tools. Local HTTP browser storage will not transfer.
3. Tap Enable background notifications. For iPhone/iPad, use an iOS/iPadOS 16.4+ Home Screen web app. Allow the notification prompt directly on the handset.
4. With the phone page open, request Sarah's saved picture and verify display and viewed acknowledgement.
5. Close the page and request another current picture or SOS. Check the generic OS notification, tap it, and verify the current content. A repeated picture within five minutes is intentionally deduplicated; use a different picture or wait for the next window.
6. Acknowledge the SOS in the receiver. Provider acceptance of a push is not proof of receipt or caregiver response. No real call is made while calling is disabled.
7. Revoke the test phone; check that content retrieval is refused. Disable delivery permissions to stop future alerts.

Local HTTP continues to work with the phone page open. HTTPS background notifications and real provider calls have not been tested on a physical handset. The notification implementation does not guarantee emergency delivery.
