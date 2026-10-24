# Teammate agents, device location and free deployment

25 October 2026, own codex/unified-conversation-agent branch. Original Downloads files were reviewed but not imported or copied verbatim.

## Screenshot fixes

The weather reply asked for a town, but a location-only response was routed away from that question. A current explicit place following a public weather/forecast question now both saves the self-report and continues the weather lookup. Weather without a place asks for one rather than defaulting to a country forecast. No-clear-speech clips are audit-only, excluded from visible chat, personal memories, daily consolidation and report evidence. They trigger a retry prompt instead of a fabricated user statement.

## Location

The patient screen includes Share my current location with Muse. Only pressing it requests browser permission. HTTPS or localhost and browser permission are required. Coordinates, accuracy and timestamp are validated before patient-scoped storage in agent_device_locations. Old (>5 min), future, invalid or unconsented points are refused. Fresh location recall can show the device's reported point and map link; it does not prove the person is still with the device. GPS coordinates are not attached to Google Search or Telegram automatically. No continuous tracking was enabled, and no real GPS permission was accepted in testing.

## Adapted team roles

- caregiverAgent.ts: reads the same scoped Muse collections, restricts daily reports to the London calendar day and distinguishes no data from no incident. Available through caregiver tools (Caregiver daily report / Assistance report) and optional Telegram commands.
- safetyAgent.ts: reuses Muse's grounded care-assistance assessment. It does not blindly send on words like help, fall or how many; external escalation remains behind existing policy and consent/inactivity checks.
- telegramAgent.ts: optional generic assistance notifications from the existing MobileLink SOS flow; disabled by default. Stable delivery IDs prevent retries from spamming. Provider acceptance is not proof someone read the alert. Optional /summary and /alerts commands work only in the exact configured private caregiver chat, with a persistent polling checkpoint. It does not accept arbitrary patient writes or expose data to unlisted Telegram chats.

The supplied original Telegram and safety files contained a hardcoded bot token. Rotate it via BotFather before deployment; no supplied token was copied into this repository. Other original issues: default arthur_01 versus demo-person-001 mismatch, incompatible Mongoose imports, unrestricted incoming chats, broad keyword alarms, no genuine daily date filter, invented event time fallback, and unsafe claims from empty alert tables. The adaptations correct these rather than running the originals as-is.

Environment flags (all optional, default off): ENABLE_TELEGRAM_ALERTS, ENABLE_TELEGRAM_CAREGIVER_BOT, TELEGRAM_BOT_TOKEN, TELEGRAM_CAREGIVER_CHAT_ID. Set a new token privately and explicitly choose the intended private caregiver chat before enabling either flag. Real telephone calls remain separate and disabled. No Telegram message was sent during implementation or tests.

## Free deployment

render.yaml defines a free Docker web service with /healthz, private dashboard-only MongoDB/Gemini secrets and generated separate access keys. Local demo auto-login is disabled in production. The app recognises Render's runtime RENDER_EXTERNAL_URL for same-origin validation; PUBLIC_APP_ORIGIN can override it for a custom domain. Docker excludes nested .env files, private cleanup backups, local captures and Git. Existing Atlas storage keeps recordings across host restarts. No paid resources are provisioned by the Blueprint.

Render sign-in is still required; no public deployment exists yet. Free Render instances sleep after 15 minutes without requests. Koyeb offers a free instance with one-hour idle sleep but card verification. Cloudflare Quick Tunnel can give this laptop's running app a temporary HTTPS URL without an account. A tunnel must use a separate production configuration with DEMO_PATIENT_AUTOLOGIN=false and correct PUBLIC_APP_ORIGIN; never expose the loopback auto-login development server unchanged. No tunnel was started or permission widened in this checkpoint.

Sources: https://render.com/docs/free ; https://render.com/docs/blueprint-spec ; https://render.com/docs/environment-variables ; https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/ ; https://www.koyeb.com/docs/reference/instances ; https://www.koyeb.com/docs/faqs/pricing ; https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition .

## Verification

169 application tests, type checks and production build passed. New cases cover weather-town continuation, non-speech filtering, GPS consent/freshness/scope, caregiver scope and date semantics, Telegram default-off/idempotence and unlisted-chat rejection. Provider and GPS tests use synthetic inputs and mocked transports; no camera/microphone/location was activated and no external contact was made. Docker build and cloud deployment require the selected provider setup and remain unverified.
