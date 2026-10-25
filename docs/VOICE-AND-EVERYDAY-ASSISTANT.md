# Voice and everyday assistant polish — 25 October 2026

## Turn taking

Start conversation requests microphone permission. The visible microphone meter reflects measured sound level. The detector requires sustained sound before a clip is submitted, ignores silence, and waits 2.4 seconds after speech before sending. Conversation preferences provide a slower 3.8-second pause or manual **Finish this thought**. Manual mode still has a 25-second clip limit; it is not unlimited dictation. Short thoughts work best. Audio remains a recorded clip processed by Gemini, not a streaming Gemini Live connection.

The sequence is **Your turn → Thinking → Muse speaking → Your turn**. Microphone capture stops before inference/playback; it resumes 650 ms after speech playback finishes. **Your turn — stop speaking** cancels browser speech and releases the playback promise so the microphone can restart, without waiting for a timeout. This is button interruption, not simultaneous spoken interruption. Stop saves the final voiced clip, stops the devices and generates the existing report. Empty/noisy clips should not become diary facts. Speech output currently uses the browser voice; Gemini provides transcription, interpretation and applicable answers.

## Location and everyday help

Explicit browser location sharing is stored against the current conversation session. Another session cannot accidentally use that position as its own. Coordinates older than five minutes are not used as a Maps route origin. A route request can use fresh shared GPS to prepare a Google Maps link; the user opens Maps for navigation. Explicit spoken origin/destination takes precedence over GPS.

The optional **Public search area** field authorises using a town/public landmark with local web questions. Precise GPS coordinates are never included in the Google Search prompt. Without an area, weather/nearby requests ask for a town. General search has citations, bounded public-only follow-up context and the existing private-memory/medical routing restrictions. Device location and actual patient location remain distinct. Sharing again is required after starting a new conversation; GPS is not silently watched in the background.

Muse can answer exact current-time/date requests from the server clock in the configured Europe/London timezone. Other factual/public questions use Gemini's Google Search tool. This adds conversational utility; it does not add arbitrary smart-home control, live phone calls, a wake word, continuous background listening, or independently verified navigation.

## Verification

Regression tests cover pauses, noise-only input, manual send mode, session-scoped location, stale GPS, explicit origin precedence, and exclusion of precise coordinates from search inputs. Browser permission and actual microphone/speaker behaviour require a physical-device check. Existing fictional judge invitations and public-showcase restrictions remain in place.

Deployed source 8efd4a6 to Render deployment dep-dbekjlcs728c73ci3290 on 25 October 2026. Full suite: 175 passed; type check and production build passed. Live authenticated checks returned `device_clock` for the time, a Maps route with the explicit Guildford origin/destination, and a London weather web response with a provider citation. Browser showed the three voice stages, public search-area input and all three speech-ending settings. No actual microphone, camera or GPS was activated during these checks.
