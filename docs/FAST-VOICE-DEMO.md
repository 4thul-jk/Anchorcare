# Fast visit answers and automatic voice submission

## Behaviour

Clear upcoming-visit questions such as "is anyone going to visit me" now use a narrow read-only schedule shortcut. The server immediately retrieves current approved plans and relationship records. A factual, time-zone-aware answer is shown as an interim result, without waiting for Gemini tool selection, generation or retries. Past-event questions do not take this shortcut. Specific names must match the linked person; unrelated visitors and cancelled plans cannot produce an answer.

Gemini 4 Argon still writes and verifies a conversational version in the background. After the approved answer appears, the form and microphone are usable again; the patient does not have to wait for the wording step. Asking another question cancels the previous job and ignores its late callbacks. If Argon is unavailable, the checked schedule answer remains usable. Returned interim citations are revalidated against fresh records on polling.

Simple visit routing also recognises "going to visit". It no longer falls through to an unrelated past physiotherapy report for that wording. If no approved scheduled visit is saved in the checked window, the app says it has no saved visit in that window rather than inventing one or asserting nobody will come.

## Voice

Click Speak your question, allow microphone access and speak one question. When recognition ends, the finished transcript is submitted automatically. There is no need to press Ask afterwards. Stop listening finishes the utterance; Cancel recording aborts it without submitting. Empty recognition, permission/network errors, cancelled recordings and duplicate end events do not create extra questions. New text is passed directly as the submitted payload rather than relying on a delayed React state update. A synchronous submit guard blocks duplicate speech/button submissions.

Recognition and Read aloud remain browser features, not Gemini audio. The browser may send audio to its speech service. Only the recognised question is submitted to the companion. Voice does not automatically mark medication taken, place calls or send messages.

## Verification — 24 October 2026

Live exact query: "is anyone going to visit me".

- Approved schedule answer first appeared after 341ms through the authenticated job API.
- Context contained plans and personal_records, not episodes/past reports.
- Argon completed a checked natural reply in 16.7 seconds: "Your daughter, Sarah Mercer, is scheduled to visit you today at 3:00 PM."
- Those are measured values from one local run, not a latency guarantee.

Tests exercise automatic submission exactly once, repeated result/end events, cancelled or errored recordings, correct recognised payload, quick visit wording, specific visitor matching, source scope, and past-question exclusion. Browser recognition is mocked in automated tests; physical microphone permissions and audio quality must still be tested on the demo device.
