# Direct patient entry for the public demo

25 October 2026. PUBLIC_PATIENT_DEMO=true enables key-free entry ONLY with STORE=mongodb, MONGODB_DATABASE=muse_public_demo, HOUSEHOLD_ID=muse-public-demo and patient demo-person-001. Startup fails if someone enables the flag against the original private database/household.

The separate database is seeded exclusively by fixture generators, including fictional Alex/Sarah/Sam/David records and illustration placeholders. No private records, recordings, contacts or locations are copied. Search index definitions are copied, not indexed source documents. Anonymous inference has rate limits. Admin APIs remain key-protected. Anonymous submissions remain in a separate session journal and cannot promote facts, names, images or locations into shared recall. Public conversation/session reports expire after one hour. These sessions are not appropriate for real patient data; use fictional information.

Public original audio retention, snapshots, GPS, pairing administration and caretaker side effects are disabled server-side. Voice can still be transcribed transiently by Gemini after Start/permission. Public help requests are simulations with truthful no-message wording. Camera/GPS/retention/check-in toggles are disabled in this public showcase. The existing private local setup retains those capabilities. Real deployment requires private patient/device enrolment rather than an open anonymous patient database.

The public UI calls status without a key and opens Muse directly. Existing authenticated tabs should be reloaded to clear their in-memory key. Do not expose the original private database through this flag or remove the isolation guards.
