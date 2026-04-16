export const MESSAGE_TYPES = {
  TEXT: 'text',
  REQUEST: 'request',
  RESPONSE: 'response',
  HEARTBEAT: 'heartbeat',
  STATUS: 'status',
} as const;

export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];

export const URGENCY_LEVELS = {
  URGENT: 'urgent',
  DIRECTIVE: 'directive',
  ACTIVE: 'active',
  BACKGROUND: 'background',
} as const;

export type UrgencyLevel =
  (typeof URGENCY_LEVELS)[keyof typeof URGENCY_LEVELS];

export const URGENCY_PRIORITY: Record<UrgencyLevel, number> = {
  [URGENCY_LEVELS.URGENT]: 0,
  [URGENCY_LEVELS.DIRECTIVE]: 1,
  [URGENCY_LEVELS.ACTIVE]: 2,
  [URGENCY_LEVELS.BACKGROUND]: 3,
};

export interface Envelope {
  id: string;
  from: string;
  to: string;
  type: MessageType;
  urgency: UrgencyLevel;
  payload: unknown;
  timestamp: string;
  correlationId: string | null;
}

export interface EnvelopeInput {
  from: string;
  to: string;
  type: MessageType;
  urgency?: UrgencyLevel;
  payload: unknown;
  correlationId?: string;
}

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };
