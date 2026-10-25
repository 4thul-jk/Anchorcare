# Previous-day recall correction — 25 October 2026

The user reported that asking for the previous day's summary produced a no-data answer although records existed. Read-only inspection confirmed eight approved daily logs for 2026-10-24 in the isolated fictional muse_public_demo workspace. No records were added, changed or deleted to manufacture the result.

The date parser recognised yesterday/last night but not previous day/prior day/day before today. The unrecognised date defaulted to today. Those phrases now resolve to yesterday in Europe/London; day before yesterday/two days ago resolve to two days earlier. Multiple distinct requested days still require clarification. DST boundaries remain timezone-aware.

Summary requests retrieve both dated daily logs and episode candidates. When Gemini cannot produce a valid supported summary, a bounded chronological fallback quotes available source notes with citations rather than saying there is no information. The fallback is labelled as selected available notes, not an exhaustive account. Freshly reloaded records are used after model failures and validation failures. A personal-day summary is never sent to web search, even if a model routing hint is wrong.

Conversational public requests such as “Can you tell me what is photosynthesis?” and “I want to know what is the capital of France” now route to the existing cited general-help tool. Personal memories, relatives, medical details and day summaries stay in scoped database retrieval. Missing private facts must not be replaced with public web guesses about the patient.

## Gemini conversation improvements

The subsequent user request asked for more intelligent conversation. The existing validated Gemini read-tool selector is now used for ambiguous memory questions instead of always defaulting to episode search. It can choose episodes, personal records, dated daily logs and plans, but cannot supply a different patient ID or perform writes/actions. Known summary/date/routine routes retain direct retrieval. Invalid model tool calls retain the existing deterministic fallback.

Memory answer generation now receives at most six preceding user/assistant turns from the same server-scoped conversation, plus the original latest words and the resolved retrieval question. Dialogue helps resolve meaning; prior answers are explicitly not evidence and cannot authorise actions. General web search still receives only its bounded public discussion, never this private history. Existing source citation and answer verification remain enabled. Full suite after both fixes: 180 passed; type checking passed. Earlier production build for this patch set passed.

Live tests confirmed the original previous-day question retrieves 2026-10-24 with eight daily records. Its next “What about breakfast?” request resolves to 2026-10-24, with two matching meal reports. Dated memory follow-ups retain the previous explicit day, including across midnight, but explicit new dates and public web topics are not overridden.

A further conversational issue was addressed: second-person paraphrases need a patient identity mapping during verification, without adding the patient identity to the spoken answer. The verifier now receives only matching patient-name identity records as reference context, not unrelated personal facts, and its deadline is 12 seconds rather than six. A real synthetic Gemini check took about 5.8 seconds, close to the previous deadline. Generation explicitly avoids appending the patient name unless asked. Source citation and entailment checking remain enabled. Final full regression suite: 182 passed; type checking passed.
