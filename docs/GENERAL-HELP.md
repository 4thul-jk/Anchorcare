# Everyday Gemini help and web answers

25 October 2026. Own branch codex/unified-conversation-agent; no teammate schema changes.

## Behaviour

The voice and text companion can now route a public question to Gemini with Google Search rather than searching personal memories for everything. Gemini classification emits help_route (memory/general/directions); the server also recognises common public questions and keeps explicit family, private identity, medication and care queries on the private path. Only the CURRENT user question enters the web call. No saved records, prior chat history, photographs, contacts or reported-location records are attached. Answers use the configured Gemini model (currently gemini-4-argon), store=false, and the built-in google_search tool. No tools for calls, purchases, arbitrary code execution or device control are enabled by the web route.

A factual web answer must include provider URL citations. Missing citations or a failed/unsupported tool returns a friendly unavailable message rather than presenting unverified model text as searched facts. Jokes/stories can be labelled creative responses. The UI separates web answers from personal memories and provides source links plus Google-provided search suggestions in a sandboxed frame. Source type and returned web links are recorded with the conversation answer for provenance. Public web answers are never asserted as patient experiences.

## Directions

Directions from a supplied public origin to a destination produce a Google Maps directions link with both places encoded. If no origin is supplied, the assistant asks for one; a destination can still be opened in Maps to choose the starting point. A nearby/weather-here query asks for a town or landmark. The app does not assume the last self-reported location is current GPS and does not request location permissions automatically. Maps navigation starts only when the user opens the link and chooses their route there. This is route handoff, not an in-app turn-by-turn navigation engine. Being lost or asking for caretaker help retains the existing assistance path.

## Demo prompts

- What is Tower Bridge in London?
- Explain photosynthesis.
- What is the weather in London today?
- Tell me a short joke.
- Directions from Guildford station to Guildford castle.
- How do I get to Waterloo station?
- Who is my daughter? (uses saved family data instead of the web)

## Verification

159 application tests passed, plus type checks. A live Argon Google Search call for the public Tower Bridge question returned a natural answer and four source citations in 7783 ms. No patient data was used in that live test. Tests cover private-question exclusion, current-question-only model input, source validation, no-source fallback and explicit origin/destination Maps links. Google Search tool usage may consume the project's grounding allowance; no new provider/key is needed for the tested configuration. Unsupported deployments return a tool-unavailable reply rather than silently changing models.

References: https://ai.google.dev/api/interactions-api and https://ai.google.dev/gemini-api/docs/google-search . This does not enable every Gemini feature or a persistent Live API session. Audio remains short direct-Gemini recordings, with browser voice playback.
