# Phone-browser receiver, autonomous pictures and SOS

## What works now

A phone can open /phone in its browser and pair using a caregiver-created one-use code. It does not need the MongoDB, Gemini or caregiver API keys and no app-store installation is needed. The same device API can later be used by Flutter or React Native.

The caregiver may enable automatic approved-picture forwarding. When the desktop companion recalls a picture, the server queues its reference for linked patient/demo devices. The phone fetches the bytes through its own limited token and acknowledges them only after the image loads. The delivery states queued, received and viewed are distinct. Viewed means browser display, not proof the person noticed or recognised the picture.

Explicit SOS or call my caregiver requests queue assistance alerts for linked caregiver/demo phones when enabled. An optional caregiver permission also allows a first-person I am lost statement to request SOS automatically. No model-generated text or provider retry can independently trigger calls. SOS queueing is separate from phone-call progress.

For the single-phone hackathon demo, choose the Demo receiver role. It can receive both pictures and SOS browser alerts. A real setup should pair patient and caregiver devices separately.

## Demo setup

1. Use the same Wi-Fi as the PC. The backend is configured locally with HOST=0.0.0.0 and PORT=3000. The /phone page is reachable at the PC's LAN address; 127.0.0.1 on a phone refers to the phone itself and will not reach the PC.
2. Open Caregiver memory tools and connect with ANCHORCARE_ADMIN_KEY. Find Linked phones and autonomous delivery.
3. Enable automatic picture delivery and SOS browser alerts, then Save delivery permissions. Automatic SOS on lost statements is a separate opt-in. Live calls stay disabled for the demo.
4. Choose Demo receiver or the appropriate patient/caregiver role, enter a phone label and Create five-minute pairing code.
5. On the phone open the LAN URL displayed in caregiver tools, enter the 12-character code and Connect this phone. Each code is one-use and expires in five minutes.
6. Keep that phone page open. Enable alert sound with an explicit tap if desired. This receiver uses three-second polling; it is not an OS background push service and a locked/background browser may suspend it.
7. On the desktop ask Show me Sarah or Show me my daughters image. The approved picture should appear on the phone. Refresh device and delivery status to see queued/viewed acknowledgements.
8. Ask SOS or call my caregiver, or press the paired patient's SOS button. The caregiver/demo receiver shows the alert. Acknowledge it on the phone. A browser SOS alert does not mean any call was placed.

If the network blocks the PC port, the phone will not connect; no Windows firewall/security settings were changed by this implementation. For access outside the local network, deploy the app over HTTPS with appropriate per-user authentication. Avoid publishing the development server directly to the internet.

## Device lifecycle and data

Pairing records store a hash of the temporary code. Device tokens are random, stored hashed on the server and returned once on pairing. The phone stores its token in localStorage so notifications can reopen the receiver; revocation or seven-day expiry prevents future reads. The caregiver can revoke a phone. New codes are rate-limited; pairing codes and device tokens must not be sent to an external QR/link-generation service.

A combined demo token has access to that patient's queued approved images and alerts, not the broad caregiver API. Image bytes are still checked against current picture and linked-record approval. Turning off image/SOS permission hides those queued command types from the device. An acknowledgement cannot change a provider call's status. Image sends are deduplicated per image/device/five-minute bucket. SOS requests have idempotency and a ten-minute guard against repeated calls/alerts; offline caregiver devices can receive a still-current pending alert when paired later.

Collections: mobile_pairings, mobile_devices, mobile_policies, mobile_commands, mobile_sos, mobile_sos_gates. The outbox and device state persist in MongoDB, independently of Gemini reply jobs.

## Real phone calls: prepared, not enabled or tested with a real number

The optional Twilio Voice adapter submits an outbound call to the fixed server-configured caregiver number. It does not dial emergency services or accept a model-supplied destination. Configure these privately in the backend .env, never in a phone app or chat:

```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
SOS_CAREGIVER_NUMBER=
ENABLE_LIVE_SOS_CALLS=false
```

Use provider-authorised numbers in E.164 format and an account able to call that destination. After deliberate setup and testing, set ENABLE_LIVE_SOS_CALLS=true, restart the backend, and explicitly enable liveCalls in the caregiver policy. Both gates are required. Live calls may incur provider charges. No real call was made during this implementation.

The worker makes one create-call attempt, then polls the returned provider SID for status. It distinguishes pending, queued, ringing, in-progress, completed, rejected, failed and unknown outcomes. An answered/completed call may be voicemail; it is not proof a caregiver received assistance. A submission timeout or a crash during dispatch is an unknown outcome, not permission to redial automatically. Phone-call creation is not wrapped in Gemini retry logic.

This is a prototype assistance link, not a guaranteed emergency-response system. Internet, provider availability, phone state and credentials affect delivery. Web Push is now implemented below; HTTPS and handset opt-in are required. Preserve these status and permission boundaries for any future native push client.

Provider reference: https://www.twilio.com/docs/voice/api/call-resource
Future push reference: https://firebase.google.com/docs/cloud-messaging/send/admin-sdk

## HTTP contract

Caregiver routes use X-AnchorCare-Key:

- GET /api/engram/admin/mobile — policy, devices, recent states and local phone URLs.
- POST /api/engram/admin/mobile/policy — explicit allowImages, allowSos, autoSosOnLost and liveCalls booleans.
- POST /api/engram/admin/mobile/pairing — role:patient|caregiver|demo and label. Returns a one-use code.
- POST /api/engram/admin/mobile/revoke — device_id.

Pairing: POST /api/engram/mobile/pair with {code}; returns deviceToken once. It does not use a caregiver key.

Paired-device routes use X-Device-Token:

- GET /api/engram/mobile/inbox — scoped unexpired commands.
- GET /api/engram/mobile/images/:imageId — bytes only for a currently allowed, queued approved picture.
- POST /api/engram/mobile/ack — command_id and state:received|viewed for images, received|acknowledged for SOS.
- POST /api/engram/mobile/sos — patient/demo receiver only, idempotency_key.

The desktop companion may POST /api/engram/mobile-sos with its companion key and an idempotency_key. Old integration-requests records remain blocked and are never replayed into the live adapter.

## Verification

106 app/integration tests, TypeScript and production build passed at the implementation checkpoint. Tests cover one-use and expired codes, hashed tokens, revocation, ownership, permission toggles, image deduplication and acknowledgements, late caregiver pairing, SOS deduplication, mock provider state transitions and no redial on ambiguous timeouts.

A live Atlas API self-test paired a temporary receiver, automatically queued and fetched an approved picture, acknowledged viewing, received/acknowledged an SOS browser alert and verified revoked-device rejection. Real calls were explicitly disabled. The temporary receiver was revoked and only its test alert/cooldown was closed afterward. This does not constitute a physical-phone or background-notification test.

## Background notification implementation � 24 October 2026

Added standards-based Web Push with a service worker and an explicit Enable background notifications button. VAPID keys are generated once in the ignored local .env; no cloud messaging account is required. The project repository URL is the VAPID contact URI. Keep these keys stable across deployments.

For local HTTP Wi-Fi testing, keep the page open as before. To test closed-page notifications:

1. Deploy the production server behind HTTPS. Build with npm run build and start with NODE_ENV=production. Set PUBLIC_APP_ORIGIN to the exact HTTPS origin, without a trailing slash. Keep MongoDB, Gemini, VAPID private key and caregiver keys in server-only environment variables. Do not expose the Vite development server.
2. Open /phone on that HTTPS origin. Pair again: local HTTP pairing storage is separate from HTTPS storage.
3. On iPhone/iPad (iOS/iPadOS 16.4+), Add to Home Screen and open the installed web app. On supported Android browsers, open the HTTPS page normally.
4. Tap Enable background notifications and allow the browser prompt. Subscription registration uses the paired device credential. No notification permission is requested automatically.
5. Request a saved image or SOS from the desktop on the same deployment. Background notifications contain generic text only; tap to open the authenticated phone receiver and fetch current approved content.
6. Test with the page closed and phone locked. OS settings, power restrictions, connectivity and browser support affect actual delivery. Push-provider acceptance is not a device receipt, image view or caregiver acknowledgement.
7. Disable background notifications on the phone or revoke the device in caregiver tools. Already submitted notifications may still arrive, but revoked credentials cannot fetch content.

The phone now persists its scoped device token in localStorage so a notification can reopen it after the tab closes. It still expires after seven days and can be revoked. Disconnect removes both new and legacy tab storage and requests server-side push disablement; caregiver revocation is the fallback if offline.

New device routes: GET /mobile/push (public VAPID key/configuration only), POST /mobile/push (browser subscription), POST /mobile/push/disable. All require X-Device-Token. Collections mobile_push and mobile_push_attempts store subscriptions and distinct dispatch outcomes. Private endpoint/key data is not returned in caregiver device lists. Outbound destinations are restricted to supported browser push providers.

Dispatch claims each command once. A successful provider response records provider_accepted without changing queued/received/viewed states. A 404/410 disables the expired subscription. A network timeout records unknown_outcome and is not blindly resent; the open-page inbox remains available. This version prioritises duplicate prevention rather than guaranteed push retries. Pending commands are rechecked against current patient delivery permissions and unrevoked device expiry before sending. Lock-screen text contains no names, medication information, images or location.

Verification: TypeScript and mocked push tests cover endpoint validation, privacy, duplicate prevention, policy withdrawal, subscription expiry, revocation and separation of push acceptance from receipt. Live handset background delivery requires an HTTPS deployment and the handset's explicit permission; it has not been verified automatically. Real Twilio calling remains disabled until the local provider credentials, recipient and both call permissions are configured.

References: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers and https://github.com/web-push-libs/web-push
