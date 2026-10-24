import { randomUUID } from 'node:crypto';
import { ApiError, id, text, choice } from '../engram-retrieval/src/validation.js';

export class AtlasLedger {
  constructor(private service: any) {}
  async list(patientId: string, caregiver: boolean) {
    const scope = this.service.scope(patientId);
    const filter = { ...scope, ...(caregiver ? {} : { reviewStatus: 'approved', isCurrent: true }) };
    const docs = await this.service.store.list('episodes', filter, { recordedAt: -1, _id: 1 }, 201);
    const records = await Promise.all(docs.slice(0, 200).map(async (doc: any) => {
      const sources = await Promise.all(doc.sourceIds.map((sourceId: string) => this.service.store.one('sources', { ...scope, _id: sourceId })));
      return { id: doc._id, summary: doc.summary, occurredAt: doc.eventStart, recordedAt: doc.recordedAt,
        reviewStatus: doc.reviewStatus, isCurrent: doc.isCurrent, supersedes: doc.supersedes || null,
        supersededBy: doc.supersededBy || null, retractionReason: doc.retractionReason || null,
        correctionReason: doc.correctionReason || null,
        sources: sources.filter(Boolean).map((s: any) => ({ id: s._id, content: s.content, sourceType: s.sourceType, inspectionRequired: s.sourceType === 'media_reference' })) };
    }));
    return { patient_id: patientId, mode: this.service.store.mode, records, truncated: docs.length > 200 };
  }
  async change(patientId: string, input: any) {
    const scope = this.service.scope(patientId), episodeId = id(input.id);
    const mode = choice(input.mode, ['correct', 'retract'], 'mode');
    const reason = text(input.reason, 'reason', 2000);
    const statement = mode === 'correct' ? text(input.statement, 'statement', 2000) : null;
    const store = this.service.store;
    const original = await store.one('episodes', { ...scope, _id: episodeId, isCurrent: true });
    if (!original) throw new ApiError(409, 'Record is no longer current. Reload the ledger.');
    const now = this.service.clock();
    const replacementId = `correction_${randomUUID()}`, sourceId = `source_${randomUUID()}`;
    let replacement: any = null;
    if (statement) {
      const { embedding, contractDigest, ...base } = original;
      replacement = await store.prepareEpisode({ ...base, _id: replacementId, summary: statement, searchText: statement,
        sourceIds: [sourceId], reviewStatus: 'draft', isCurrent: true, recordedAt: now, reviewedAt: null,
        confidence: null, supersedes: episodeId, supersededBy: null, correctionReason: reason });
    }
    const audit = { _id: `audit_${randomUUID()}`, ...scope, action: mode === 'correct' ? 'episode_corrected' : 'episode_retracted',
      recordId: episodeId, at: now, detail: { reason, replacementId: replacement ? replacementId : null, actor: 'caregiver_access_key' } };
    const changes = { isCurrent: false, reviewStatus: 'draft', retractionReason: reason, supersededBy: replacement ? replacementId : null };
    const source = { _id: sourceId, ...scope, sourceType: 'caregiver_report', content: statement, recordedAt: now };
    if (store.mode === 'mongodb') {
      const session = store.client.startSession();
      try {
        await session.withTransaction(async () => {
          const updated = await store.db.collection('episodes').updateOne({ ...scope, _id: episodeId, isCurrent: true }, { $set: changes }, { session });
          if (updated.matchedCount !== 1) throw new ApiError(409, 'Record changed; reload before correcting it.');
          if (replacement) {
            await store.db.collection('sources').insertOne(source, { session });
            await store.db.collection('episodes').insertOne(replacement, { session });
          }
          await store.db.collection('audit_events').insertOne(audit, { session });
        });
      } finally { await session.endSession(); }
    } else {
      // Isolated local test mode only; no claim of cross-process transactions.
      const updated = await store.update('episodes', { ...scope, _id: episodeId, isCurrent: true }, changes);
      if (!updated) throw new ApiError(409, 'Record changed; reload.');
      if (replacement) { await store.insert('sources', source); await store.insert('episodes', replacement); }
      await store.insert('audit_events', audit);
    }
    return { mode, originalId: episodeId, replacementId: replacement ? replacementId : null,
      replacementReviewStatus: replacement ? 'draft' : null, committed: true };
  }
}
