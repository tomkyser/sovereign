import * as crypto from 'node:crypto';
import {
  MESSAGE_TYPES,
  URGENCY_LEVELS,
  type MessageType,
  type UrgencyLevel,
  type Envelope,
  type EnvelopeInput,
  type Result,
} from './types';

const META_KEY_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const VALID_TYPES = new Set<string>(Object.values(MESSAGE_TYPES));
const VALID_URGENCIES = new Set<string>(Object.values(URGENCY_LEVELS));

export function createEnvelope(input: EnvelopeInput): Result<Envelope> {
  if (!input.from) {
    return { ok: false, error: 'Missing required field: from' };
  }
  if (!input.to) {
    return { ok: false, error: 'Missing required field: to' };
  }
  if (!input.type) {
    return { ok: false, error: 'Missing required field: type' };
  }
  if (!VALID_TYPES.has(input.type)) {
    return { ok: false, error: `Invalid message type: ${input.type}` };
  }

  const urgency = input.urgency || URGENCY_LEVELS.ACTIVE;
  if (!VALID_URGENCIES.has(urgency)) {
    return { ok: false, error: `Invalid urgency level: ${input.urgency}` };
  }

  return {
    ok: true,
    value: {
      id: crypto.randomUUID(),
      from: input.from,
      to: input.to,
      type: input.type,
      urgency,
      payload: input.payload,
      timestamp: new Date().toISOString(),
      correlationId: input.correlationId ?? null,
    },
  };
}

export function validateEnvelope(obj: unknown): Result<Envelope> {
  if (!obj || typeof obj !== 'object') {
    return { ok: false, error: 'Envelope must be a non-null object' };
  }

  const e = obj as Record<string, unknown>;

  if (!e.id) return { ok: false, error: 'Missing required field: id' };
  if (!e.from) return { ok: false, error: 'Missing required field: from' };
  if (!e.to) return { ok: false, error: 'Missing required field: to' };

  if (!e.type || !VALID_TYPES.has(e.type as string)) {
    return {
      ok: false,
      error: `Invalid or missing message type: ${e.type}`,
    };
  }
  if (!e.urgency || !VALID_URGENCIES.has(e.urgency as string)) {
    return {
      ok: false,
      error: `Invalid or missing urgency: ${e.urgency}`,
    };
  }
  if (!e.timestamp) {
    return { ok: false, error: 'Missing required field: timestamp' };
  }

  return { ok: true, value: obj as Envelope };
}

export function filterMetaKeys(
  meta: Record<string, string>,
): Record<string, string> {
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (META_KEY_REGEX.test(key)) {
      filtered[key] = value;
    }
  }
  return filtered;
}

export function envelopeToMeta(
  envelope: Envelope,
): Record<string, string> {
  const meta: Record<string, string> = {
    envelope_id: envelope.id,
    message_type: envelope.type,
    urgency: envelope.urgency,
    sender: envelope.from,
  };
  if (envelope.correlationId) {
    meta.correlation_id = envelope.correlationId;
  }
  return filterMetaKeys(meta);
}
