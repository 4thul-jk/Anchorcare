# Saved image recall

## Current feature

The companion retrieves caregiver-labelled pictures alongside text replies. Person pictures are linked to existing people and approved personal records. Memory pictures are linked to a current approved episode. It uses person names, relationships, memory captions and the checked record references returned in an answer. It does not perform face recognition or infer identity from pixels. Caption matching is lexical; deeper semantic image search is not implemented.

Picture recall begins in parallel with the text reply job, so it does not wait for Gemini tool selection. When checked answer citations identify additional relevant records, the companion can retrieve their linked images too. Images are limited to four results per request from the latest 100 approved picture records; names/relationships and caption scores determine relevance. A newer question clears old pictures and aborts old requests. Request-sequence guards prevent late results from restoring the wrong person's pictures.

## Storage and access

MongoDB GridFS bucket engram_images stores image bytes. The memory_images collection stores caption, targetType, targetId, patient/household, content type, byte length, timestamps and approval status. Local isolated tests use the in-memory store. Existing photoRef/media_ptr strings are not fetched as external URLs; this feature uses explicit new image associations instead.

Allowed uploads: PNG, JPEG and WebP up to 1 MB. The server checks file signatures and PNG pixel size. SVG/HTML, external URL strings, mismatched file types and arbitrary target IDs are rejected. Browser uploads decode and resize the picture to a maximum side of 1200 pixels and encode JPEG before upload; direct API uploads still require valid allowed bytes. This is a prototype validation layer, not a comprehensive media-malware scanner.

Upload and approval require the caregiver key. Pictures start as drafts and are not shown to patients until image approval and the linked person/memory approval are both valid. Patient recall and image-content reads recheck current source approval and patient scope. A withdrawn image, withdrawn person record or superseded memory is hidden from future patient reads. Already downloaded pictures cannot be remotely erased; object URLs are revoked when a card unmounts or the access key changes.

No private key is placed in an image URL. The React component fetches bytes with X-AnchorCare-Key, creates a local object URL and cleans it up. Responses use no-store and nosniff. No remote images are downloaded by the backend. Uploaded image bytes are not automatically sent to Gemini by this feature.

## Caregiver workflow

1. Open Caregiver memory tools and connect using ANCHORCARE_ADMIN_KEY.
2. In Familiar people and memory pictures choose an existing familiar person or saved memory.
3. Select a picture you are authorised to share and enter an accurate caregiver caption.
4. Upload draft picture, inspect it, then Approve this picture. If the linked personal record or episode is unapproved, approve that source first.
5. Return to the Patient Companion. Ask Who is my daughter?, Show me Sarah, or Remember our garden walk. The matching picture appears beside the text flow.
6. Withdraw image approval to hide it from future recall. Use Enlarge picture to view a returned picture more clearly.

## Fictional demo

npm run demo:seed-images creates two GridFS assets for demo-person-001 only: a Sarah illustration and a courtyard garden-walk illustration. Both are clearly labelled as fictional placeholders, not photographs. They link to the existing fictional Sarah card and yesterday's garden-walk memory. Run the main demo seed first if these records are absent. Rerunning preserves existing image approval rather than restoring withdrawn approval. Real family photos must be supplied through the caregiver upload panel; none were invented or obtained from the internet.

Fixtures: fixtures/images/sarah-demo.png and garden-demo.png. The fixture drawings are synthetic test assets; they do not depict actual people or events.

## API

All endpoints use the private X-AnchorCare-Key and server-selected patient scope.

- POST /api/engram/admin/images: target_type:person|episode, target_id, caption, content_type, image_base64. Returns a draft asset.
- GET /api/engram/admin/images: caregiver picture list (up to 100).
- POST /api/engram/admin/images/review: image_id and status:approved|draft.
- POST /api/engram/recall-images: question and optional reference_ids (maximum 20). References narrow selection; they never authorise cross-patient access.
- GET /api/engram/images/:id/content: authenticated image bytes. Caregivers may preview drafts; patients require current approval of both picture and linked record.

## Verification — 24 October 2026

Automated tests cover formats, size limits, drafts, source approval withdrawal, retired episodes, actor permissions, unknown names, foreign references, captions, binary delivery and rejection of external URLs. Live Atlas GridFS verification returned Sarah's illustration for daughter/Sarah queries and the garden illustration for a garden-walk query. David returned no image because none was uploaded. Authenticated binary reads succeeded and anonymous reads were rejected.

Measured live metadata recall: 24-65ms for the five demo questions. This is a local test measurement, not a production guarantee. Browser rendering and real-file upload still need checking on the demo device; automated backend tests do not replace that check.

Final verification: 94 app/integration tests, TypeScript and production build passed. A live generic visitor query resolved Sarah's image through its checked person-record citation. Rerunning the image seed preserved both GridFS assets and their approval states.

Latest wording fix: normalisation covers daughters, daughter's, daughter’s and an explicit small set of daughter misspellings. A direct image request with an approved match returns a friendly caption-based answer without waiting for inference. Additional regressions preserve question contractions such as Who's Sarah. Latest application test count: 98. This last wording change has not yet been reloaded and visually verified in the running browser; Computer Use stopped because it could not confidently determine Chrome's URL.
