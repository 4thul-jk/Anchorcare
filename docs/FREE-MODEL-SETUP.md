# Free companion model setup — 24 October 2026

The existing Gemini credentials and model settings are preserved. Only the companion response provider is switched by COMPANION_PROVIDER. Gemini-specific ingestion elsewhere is not migrated by this adapter. Database retrieval, image approval, reminder workers and SOS actions remain in the existing backend.

## OpenRouter: quickest setup

1. Create an OpenRouter account and API key at https://openrouter.ai/settings/keys. Free routes have no token charge but have request limits and variable availability. No paid route is accepted by this adapter.
2. Add the key privately to OPENROUTER_API_KEY in Anchorcare/.env. Do not put it in client code or commit it. The local file already selects COMPANION_PROVIDER=openrouter and OPENROUTER_MODEL=openrouter/free.
3. Restart the backend with npm run dev. The next conversation requests use OpenRouter instead of Google. No automatic cross-provider fallback occurs.
4. In caregiver tools, refresh Conversation model diagnostics. Confirm provider openrouter and configured. After a generated answer, the actual model selected by the free router is recorded when returned by the provider.
5. Ask varied questions such as Tell me about David Lee, Who helps me with exercises?, and Can you remind me who Sarah is? Verify the cited saved records. Keep a no-support case such as Who is my psychotherapist? and a request for medication changes in the test set.

The free router chooses an available model; model quality and latency can vary. A supported answer can require a generation call and a separate verification call, consuming two free requests. The server requests providers that disallow data collection; this may reduce available routes. Only synthetic demo data should be used during hackathon testing. No real patient-data egress has been tested as part of setup.

## Local Ollama alternative

Install Ollama from https://ollama.com and download a model appropriate for available RAM, for example `ollama pull qwen3:4b`. This can require a substantial download and may be slow without sufficient hardware. Ollama was not detected on this laptop during implementation, and local inference has not been tested here.

Set COMPANION_PROVIDER=ollama, OLLAMA_MODEL=qwen3:4b, OLLAMA_BASE_URL=http://127.0.0.1:11434 and restart. The endpoint is restricted to loopback. No external inference credential is required. Requests use /api/chat, stream=false and the response JSON schema as format.

## Switch back

Set COMPANION_PROVIDER=gemini, restore the intended GEMINI_MODEL/GEMINI_COMPANION_MODEL if needed, and restart. This retains the Google integration for when organiser credits recover. Competition eligibility that requires Argon still requires successful Argon use; this free-provider workaround does not establish it.

## Checks preserved

Free/local models get server-selected approved context and a structured response request. The adapter maps results into the existing source-quote integrity and entailment checks; malformed JSON, missing sources, unsupported paraphrases and failed verification do not become trusted natural answers. There are no model tools for calls, database writes or medication changes. Provider errors expose sanitized status metadata without raw response bodies, source text or API keys. Speech recognition and read-aloud remain browser services.

References: https://openrouter.ai/openrouter/free and https://github.com/ollama/ollama/blob/main/docs/api.md
