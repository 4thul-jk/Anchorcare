import { createHash } from 'node:crypto';
import { ApiError } from '../engram-retrieval/src/validation.js';

export type CapabilityKind = 'call_caregiver' | 'message_caregiver' | 'request_location';
export type DeviceAction = { requestId: string; patientId: string; kind: CapabilityKind; consentId: string; idempotencyKey: string };
export type DeviceReceipt = { status: 'pending' | 'completed' | 'failed'; providerReference: string };
// Future mobile adapters implement this interface. Model output never executes it.
export interface DeviceAdapter {
  kind: CapabilityKind;
  execute(action: DeviceAction): Promise<DeviceReceipt>;
}
const kinds: CapabilityKind[] = ['call_caregiver', 'message_caregiver', 'request_location'];
export const capabilityManifest = () => kinds.map(kind => ({ kind, available: false, requiresConfirmation: true, status: 'not_connected' }));

export class CapabilityHooks {
  constructor(private service: any) {}
  async request(patient: string, input: any, actor: string) {
    if (!kinds.includes(input.kind)) throw new ApiError(400, 'Unsupported capability');
    if (typeof input.idempotency_key !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(input.idempotency_key)) throw new ApiError(400, 'A valid idempotency_key is required');
    const scope = this.service.scope(patient);
    const requestId = createHash('sha256').update(JSON.stringify([scope, input.kind, input.idempotency_key])).digest('hex');
    const record = { _id: requestId, ...scope, kind: input.kind, actor, status: 'blocked_not_connected', createdAt: this.service.clock(),
      executed: false, recipientResolved: false, consentRequiredBeforeExecution: true };
    // _id enforces retry deduplication. Only server-selected patient/scope is accepted.
    await this.service.store.insert('integration_requests', record);
    return { requestId, kind: input.kind, status: 'blocked_not_connected', executed: false,
      message: 'Request recorded for integration testing. This feature is not connected; no call, message or location request was made.' };
  }
}
