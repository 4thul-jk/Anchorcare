# Muse Render deployment

Prepared/deployed 25 October 2026 (Asia/Kolkata). Own repository: 4thul-jk/Anchorcare; branch codex/unified-conversation-agent; application source commit c1617dd.

Service name: muse-anchorcare-demo. Public address: https://muse-anchorcare-demo.onrender.com . Health path: /healthz . Runtime: Docker using ./Dockerfile, repo-root context. Compute: Free ($0/month), 0.1 CPU, 512 MB. Auto-deploy: Off. First deployment created in Athul's Render workspace after explicit approval to transfer the listed secrets. This document does not itself confirm successful build/health; the verification section records the actual outcome.

## Runtime configuration

The Render service contains only the six explicitly approved existing private settings (MONGODB_URI, GEMINI_API_KEY, ADMIN_TOKEN, COMPANION_TOKEN, ANCHORCARE_ADMIN_KEY, ANCHORCARE_COMPANION_KEY) plus non-secret runtime values. No whole .env upload, new credential generation, Telegram token, live-call credentials, VAPID private key or local media upload was performed.

NODE_ENV=production; HOST=0.0.0.0; STORE=mongodb; MONGODB_DATABASE=engram; HOUSEHOLD_ID=anchorcare-demo; SUBJECT_IDS and ANCHORCARE_PATIENT_ID=demo-person-001; TIMEZONE=Europe/London; COMPANION_PROVIDER=gemini; GEMINI_MODEL=gemini-4-argon. DEMO_PATIENT_AUTOLOGIN=false, ENABLE_LIVE_SOS_CALLS=false, ENABLE_TELEGRAM_ALERTS=false and ENABLE_TELEGRAM_CAREGIVER_BOT=false. Render's RENDER_EXTERNAL_URL supplies the same-origin HTTPS URL. No key values belong in this document.

Private memory APIs require the companion/caregiver access key. The public page may display the fictional browser sample; it must not bypass memory authentication. Use the existing local access key privately on the hosted app. Browser camera/microphone/location permission is requested separately by the user. A phone's location is meaningful only on the phone that grants it.

## Limits and operations

Free Render sleeps after 15 minutes without inbound traffic and may take roughly a minute to wake. Not suitable for dependable always-on caretaker alerts. Atlas, Gemini and other providers keep their own usage limits/charges independent of the free host. One instance only. Uploaded captures are stored in Atlas GridFS, not ephemeral Render disk.

For later updates, push a reviewed commit to the separate branch, then use Render Manual Deploy. Do not change Sumesh main. Do not turn on paid compute, auto-deploy, live calls, Telegram or public demo auto-login implicitly. After a deployment check /healthz, unauthenticated API rejection, authenticated Atlas mode, same-origin checks and a synthetic public question. Add only the service's documented egress addresses in Atlas if connection is blocked; do not automatically open all network access.

## Verification

First deployment dep-dbejekss728c73cec4n0 built the Docker image but failed at Node startup while selecting an Atlas server (1m11s, 25 October 2026 04:25 IST start). Render service srv-dbejekcs728c73cec2og exists on the Free plan. The app did not pass /healthz. The Render dashboard reports shared region outbound CIDRs 74.220.50.0/24 and 74.220.58.0/24. Atlas sign-in and explicit access-list approval are pending; no access-list entry was changed. No unauthenticated memory access or successful public deployment is claimed.
