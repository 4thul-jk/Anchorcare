# AnchorCare + Engram

AnchorCare's original React/TypeScript prototype with Engram's MongoDB retrieval and proactive-trigger component integrated into the Express backend.

## Run

Requires Node.js 22.12+ (tested with 24.22.1). Vite 8 does not support the previously installed Node 20.18 runtime.

```sh
npm ci --ignore-scripts --no-audit --no-fund
# Copy .env.example to a private .env and configure it locally.
npm run dev
```

Open http://127.0.0.1:3000 and choose **Open persistent memory workspace**. Enter the private ANCHORCARE_ADMIN_KEY for caregiver actions or ANCHORCARE_COMPANION_KEY for patient reads/responses. Keys remain in page memory and are not put in localStorage. The React role switcher in the original demo does not grant server caregiver permissions.

For real Atlas storage set STORE=mongodb and configure MONGODB_URI. Keep ANCHORCARE_PATIENT_ID in SUBJECT_IDS; the bridge uses this server-configured patient and ignores client-supplied patient IDs. Set distinct strong ADMIN_TOKEN/COMPANION_TOKEN and separate ANCHORCARE_ADMIN_KEY/ANCHORCARE_COMPANION_KEY values. Never commit .env. The server binds to loopback by default.

## What is connected

- `engram-retrieval/` contains Athul's tested backend component, copied from 4thul-jk/Engram-Hackathon at commit 22b37bb, including its tests, setup scripts and documentation.
- `integration/engram.ts` mounts `/api/engram/*` inside AnchorCare's Express process. The same process connects to Atlas and runs the reminder worker. No second server or database credentials in browser code are required.
- `src/components/EngramMemoryView.tsx` provides source-backed draft ingestion, caregiver approval/withdrawal, unified memory retrieval, optional Gemini answers and approved reminder creation/cancellation/responses.
- `/api/engram/answer` retrieves evidence on the server; it does not trust browser-supplied evidence. With no Gemini key it explicitly returns evidence_only, not a fake model answer. With a key it uses GEMINI_MODEL (default gemini-4-argon), Interactions structured output and typed citation membership checks with a fresh retrieval before response.
- Existing daily/person records and context-trigger endpoints are mounted and documented in the component. Stream Processing remains prepared but not deployed; CONTEXT_PROCESSING stays local.

The main **Memory Ledger** now loads/saves through Atlas-backed routes and supports review, linked correction and retraction history. Its collapsed original sample ledger remains separate. Patient Companion, Policy & Actions and Python reference views still use the teammate's browser demo. They are **not automatically synchronized** into Atlas. No browser sample data is silently promoted into approved memory. Companion/actions migration remains a separate step.

## Important boundaries

This is a local synthetic-data integration. Entered keys are shared prototype credentials, not production user authentication. Production needs individual sessions, patient/guardian authorization and HTTPS before external access. The server-selected single patient does not implement a multi-patient login system.

No audio/video upload, face recognition, guardian calling, emergency response or clinical decision system is added. Citation membership does not prove semantic support. Medical self-reports and plans retain their meaning; no medication instructions are executed. The original `/api/gemini/reason` endpoint remains the teammate's legacy client-context flow, separate from the protected `/api/engram/answer` route; do not expose this prototype publicly without migrating/authenticating legacy routes.

Long-running operations can still overlap approval changes; refreshed citations reduce, but do not eliminate, races. Server ledger corrections now use a MongoDB transaction covering original/replacement/source/audit writes; replacements begin as drafts. Browser demo correction tests alone do not prove this behaviour; a separate live HTTP/Atlas correction check has passed.

## Validation

```sh
npm test
npm run test:memory
npm run lint
npm run build
```

See [integration notes](docs/ANCHORCARE-INTEGRATION.md) for exact verification and remaining work. Engram APIs: [unified context](engram-retrieval/MEMORY-CONTEXT.md), [team handoff](engram-retrieval/TEAM-HANDOFF.md), [daily/personal records](engram-retrieval/DAILY-AND-PERSONAL.md), [stream setup](engram-retrieval/STREAM-PROCESSING.md).
