# Telegram setup and sharing

25 October 2026. The user explicitly approved temporarily using the bot credential in the supplied backend archive. It was copied only to the private local .env and tested with Telegram getMe: authentication succeeded for Anchorcare_bot (HTTP 200). No chats were read and no message, picture or location was transmitted during that check. The archived credential is not copied into this guide, source or Git. Generate a fresh token when ready.

## Replace the temporary token

1. Open the verified @BotFather account in Telegram.
2. Use /revoke and select your bot to revoke its existing token and obtain a replacement. Follow BotFather's instructions for that bot; /token is also available for token management.
3. Replace only TELEGRAM_BOT_TOKEN in your private .env. Do not paste it in chat or commit it.
4. Restart the local Node server. If the bot is later configured in Render, replace the private Render environment value as well and redeploy/restart. Local .env edits do not update Render.

## Required local configuration

Both recipients must open the bot and press Start. Use private individual chat IDs, not groups. The patient and caregiver can be separate accounts. Keep chat IDs private.

```dotenv
TELEGRAM_BOT_TOKEN=replace_privately
TELEGRAM_PATIENT_CHAT_ID=
TELEGRAM_CAREGIVER_CHAT_ID=
TELEGRAM_SUBJECT_ID=demo-person-001
TELEGRAM_HOUSEHOLD_ID=anchorcare-demo
ENABLE_TELEGRAM_IMAGES=true
ENABLE_TELEGRAM_LOCATION=true
ENABLE_TELEGRAM_ALERTS=false
ENABLE_TELEGRAM_CAREGIVER_BOT=false
```

Set the household to the actual selected workspace. The hosted fictional judge deployment requires TELEGRAM_HOUSEHOLD_ID=muse-public-demo; the local private workspace normally uses anchorcare-demo. Scope mismatch disables picture/location sharing. Set ENABLE_TELEGRAM_ALERTS and ENABLE_TELEGRAM_CAREGIVER_BOT to true only when you want the existing policy-gated SOS notifications and caregiver /summary /alerts commands enabled. A valid bot token alone does not enable these features or establish a recipient.

## Picture flow

Recall an approved saved picture in Muse. When Telegram image delivery is configured, its card shows **Send this picture to my Telegram**. That click explicitly authorises sharing that image to the fixed server-configured patient chat. The server rechecks approval/patient scope and uploads the bytes; it never publishes a private image URL or embeds an access key. JPEG/PNG/WebP use sendPhoto. The fictional SVG illustrations are sent as document attachments because they are not raster photos.

## Location flow

Start or select the conversation, then press **Share my current location with Muse** and allow browser geolocation. Use **Send this location to caregiver via Telegram** or **Send this location to my Telegram**. This second click is separate consent for transmission to Telegram. The server reads the saved position for that same conversation; it rejects absent or older-than-five-minute positions. The message includes capture time, approximate accuracy and a Google Maps link. It describes the device position, not proof the person is still with the device. Sharing GPS with Muse alone does not send it to Telegram.

The bot cannot silently retrieve phone GPS. Telegram picture/location sharing here is an explicit web-app action, not a background tracking feature or a bot command that remotely activates a phone sensor.

## Delivery and security

Recipients are fixed environment configuration, never request-supplied chat IDs. Sharing routes require companion authentication; anonymous public showcase requests remain blocked. Signed judges can use sharing only if the isolated judge workspace has explicitly been configured for it. Requests are rate-limited and keyed for deduplication. A timeout is recorded as unknown_or_failed and is not automatically resent. provider_accepted means Telegram accepted the request; it does not establish reading or assistance. Existing caregiver bot allowlists remain in place.

## Verification

Mocked tests cover approved image bytes, consent, patient scope, patient versus caregiver recipients, stale/cross-session location rejection, timestamped map messages, SVG attachment handling and duplicate protection. These tests send nothing to Telegram. Real recipient delivery remains pending until private chat IDs and flags are configured and a test send is explicitly requested.

API reference: https://core.telegram.org/bots/api#sendphoto and https://core.telegram.org/bots/api#sendmessage.
