# Public Engram simulation

Status: prepared locally; not deployed or verified publicly yet.

Use the existing Dockerfile on one persistent Node service. Build: Docker. Health: /healthz. Public URL: /simulation; root redirects there.

Set PUBLIC_SIMULATION=true and PUBLIC_SIMULATION_ORIGIN to the exact HTTPS origin (or use Render RENDER_EXTERNAL_URL). Set NODE_ENV=production, HOST=0.0.0.0, STORE=mongodb, MONGODB_DATABASE=engram, TIMEZONE=Europe/London. MONGODB_DATABASE is only configuration input here: the simulation overrides its store to engram_alex_simulation. Keep MONGODB_URI and GEMINI_API_KEY in private host settings. Do not upload .env. Retain the existing model/provider settings.

In this mode the main patient API and its workers are not mounted. Simulation records use random visitor IDs in the dedicated database. Run IDs act as session credentials. Same-origin checks and request limits remain enabled. No real calls or Telegram sends are mounted by the simulation.

Capacity: 10 active in-process sessions, expiring after two hours. One instance only. Server restart invalidates active sessions; it does not remove stored demo records. This is a small judge demo, not unlimited public capacity. Public requests consume model quota. Configure a provider spending limit. Visitors should enter fictional data only.

Before sharing: verify /healthz, root redirect, create a run, save and recall a fictional fact, reject unrelated Origin, reject main patient API, and check a second browser has its own run.
