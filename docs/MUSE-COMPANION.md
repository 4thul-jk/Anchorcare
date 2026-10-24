# Muse companion behaviour and media panel

25 October 2026. Own branch codex/unified-conversation-agent.

Muse is calm, attentive and respectful: short connected sentences, one helpful follow-up at a time, no infantilising language, false claims of human emotions or actions, and no invented certainty. The shared style lives in integration/muse-personality.ts and is applied to memory generation and general Gemini answers. Classification/exact transcription still follow strict extraction rules rather than a personality prompt.

## Dynamic retrieval and follow-ups

Existing episodic memory retrieval uses the MongoDB hybrid text/vector path when available. Gemini interprets the utterance/context for recall. This update adds bounded public conversational context to Google Search answers: at most three immediately preceding web/creative turns from the same patient/session. A private-memory turn breaks the public chain. A short tell me more/another example request uses the preceding public topic, rather than asking who the user means or repeating the old answer. The model is instructed to add relevant new detail and cite web evidence; an exact repeated factual question should remain factually consistent. It must not rotate to a worse-ranked or contradictory fact merely to produce variety. No fixed retrieval process can guarantee every answer is novel or every web search succeeds.

Web context is server-selected from recorded answerSource/publicTopic metadata. Patient memories, photographs, caregiver contacts and location history are not attached. Existing care checks and permission-gated contact actions still run separately. Unknown personal questions do not fall through to web searches for a substitute identity.

## Interface

- Muse name and personality in the companion panel.
- Microphone and stop icons, a mic-off state and animated listening bars while actual capture is active. Reduced-motion preference disables animation. Text and controls communicate state independently of colour.
- Dedicated Pictures to help you remember screen between recording controls and preferences. It shows an empty state until saved pictures are returned, then displays the existing scoped saved-image cards with identity labels and Who is this? controls.
- Camera preview remains separate and explicitly consented. The empty picture screen does not activate the camera.

## Validation

163 application tests passed, TypeScript and production build passed. New cases verify public follow-up continuity, private-history isolation and Muse's consistency instructions. Live narrow-screen visual inspection confirmed mic/stop controls and the dedicated image panel. Actual microphone permissions were not activated by this visual check. Existing live Argon Google Search verification remains recorded in GENERAL-HELP.md.
