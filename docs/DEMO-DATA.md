# Realistic fictional Atlas demo data

Seeded into the configured AnchorCare Atlas household for patient `demo-person-001`. Every source note begins FICTIONAL DEMO. These are authored scenarios, not actual patient observations or a downloaded clinical dataset.

Seeded 24 October 2026 at 11:48 IST. The complete daily timeline uses the previous London calendar day, **23 October 2026**, so meals and an evening visit do not become future completed events when the app is demonstrated early in the morning. Event times are stored as BSON dates/UTC and interpreted in Europe/London.

| Scenario local time | Record |
| --- | --- |
| 07:30 | Caregiver report: oatmeal and Earl Grey breakfast |
| 08:15 | Patient report: glasses on bookshelf by living-room window |
| 08:30 | Patient unsure about morning medicine; no dose/ingestion confirmed |
| 09:30 | Caregiver report: 20-minute courtyard walk |
| 10:15 | Caregiver report: glass of water |
| 12:30 | Caregiver report: vegetable soup and bread lunch |
| 14:15 | Phone conversation with daughter Sarah about photo album |
| 17:30 | Caregiver report: physiotherapist David visited and supervised seated exercises |
| 18:00 | Unreviewed transcript about spare keys; draft only, excluded from recall |

Three familiar people: Sarah Mercer (daughter), Sam Rivera (caregiver), David Lee (physiotherapist). Six personal records include their cards plus tea/music preferences and gardening interest. A fictional `.invalid` email is caregiver-only; no real contacts or photographs are supplied.

Nine episodes and nine corresponding daily logs are created, with eight approved and one draft in each set. Medication outcome remains uncertain with user_report provenance even after review. Duplicate episode/log representations are the same fictional report, not independent corroborating sources.

Plans: Sarah visit at 15:00 London on the next applicable day, with a ten-minute advance reminder; photo-album context plan at desk. Plans are intentions, not proof of visits. Context needs a new fresh check-in. Quiet hours and cooldown are retained; no phone calls, messages or clinical actions occur.

## Use

1. Open the main Memory Ledger, load with your private access key and Refresh. Real Atlas reports appear there; the collapsed browser sample ledger is separate.
2. Use **Open persistent memory workspace** to query Atlas-backed context. Main Patient Companion still reads its original browser sample records and does not automatically use this seed.
3. Try "Where were the glasses?", "What breakfast was reported?" and "Did the physiotherapist visit yesterday evening?". Atlas supplies report evidence; no live Gemini answer is claimed without configured access.
4. For structured daily context call `/api/engram/memory-context` with include daily_logs and day 2026-10-23. Default daily queries mean today, which deliberately does not contain yesterday's logs. For profiles request personal_records. Do not infer medicine was taken from missing/uncertain reports.

```sh
npm run demo:seed-atlas
npm run demo:verify-atlas
```

Requires private root .env, a supported Node runtime, existing queryable Atlas indexes and the running app for verification. Seed writes directly via validated service methods; verification uses authenticated actual HTTP routes. The seed can run without Gemini. Seed IDs are stable per household/patient/scenario day, and repeated runs do not duplicate records or reapprove records a caregiver withdrew. A manifest preserves initial plan times; rerunning does not reschedule an old plan. Use the normal plan UI for new reminder timing. A later calendar day creates a new scenario; previous scenarios remain as history. Nothing is deleted or overwritten.

Verified at **2026-10-24T06:19:26.295Z** (11:49:26.295 IST). Seven live checks passed: glasses/breakfast/physiotherapy retrieval, draft exclusion, medicine uncertainty, family profile retrieval and contact omission. Scenario ID: alex_demo_52b2b305dd_20261023. A second seed run succeeded using the same IDs. TypeScript check passed. Verification did not call Gemini.
