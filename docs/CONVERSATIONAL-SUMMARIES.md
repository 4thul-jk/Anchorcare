# Conversational summary fix — 24 October 2026

Work isolated on Athul's codex/security-hardening branch; no schema or Sumesh remote changes.

The natural-answer helper rejected outputs with more than four claims, while the existing citation validator allowed ten. A five-fact summary therefore could pass citation checks but be displayed only as raw saved-report quotations without receiving natural-language verification.

The helper now accepts up to ten bounded claims and 2,500 total characters, matching the source-claim limit. Per-claim bounds and all source integrity/entailment checks remain. The generation prompt requests a connected four-to-six-sentence paragraph for summaries, preserves attribution by source group, avoids repeated source wrappers and forbids invented emotions, causes or safety assurances. It describes a summary of available notes, not an exhaustive day history. Ordinary questions retain a short response style. Summary requests have a 1,400-token output allowance for both prose and source citations; other answers keep 900.

The verifier explicitly permits faithful paraphrase, supported second-person wording and grouped attribution; it still rejects unsupported claims, certainty from reports, medication advice and plans presented as completed events. If verification fails, exact source wording is still the fallback. This change does not guarantee every future model answer will pass.

Verification: 124 app tests, TypeScript and production build passed. A live Argon probe using five entirely fictional in-memory notes returned a connected two-claim summary; citation checks and natural-language verification both passed, in 12.479 seconds. No stored patient records were sent during that test. A regression test covers five-claim eligibility and rejection of excessive claims/length.

To test: refresh the local companion and resubmit give me the summary for yesterday. Previously displayed replies are not regenerated automatically. Original reports remain in the supporting-records section.
