import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  MESSAGE_TYPES,
  URGENCY_LEVELS,
  type Envelope,
  type Result,
} from './types';
import { createEnvelope, envelopeToMeta } from './protocol';

// ====================================================================
// State
// ====================================================================

const SESSION_ID = `wire-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const startTime = Date.now();
const messageLog: Envelope[] = [];

// ====================================================================
// Server
// ====================================================================

const server = new Server(
  { name: 'wire', version: '0.1.0' },
  {
    capabilities: {
      tools: {},
      experimental: { 'claude/channel': {} },
    },
    instructions: [
      'Wire enables communication between Claude Code sessions.',
      'Messages from other sessions arrive as <channel source="wire" ...> in your conversation.',
      'To send a message to another session, use the wire_send tool.',
      'To check Wire connection status, use the wire_status tool.',
      'Your session ID is available via wire_status — share it so others can message you.',
      'Wire messages have urgency levels: urgent (immediate), directive, active (default), background.',
      'Messages have types: text (general), request (expects response), response, heartbeat, status.',
      'When you receive a request-type message, respond using wire_send with type "response" and the correlation_id from the original.',
    ].join('\n'),
  },
);

// ====================================================================
// Tool definitions
// ====================================================================

const TOOLS = [
  {
    name: 'wire_send',
    description:
      'Send a message to another Claude Code session via Wire.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        to: {
          type: 'string',
          description:
            'Recipient session ID, or "broadcast" to send to all connected sessions.',
        },
        message: {
          type: 'string',
          description: 'The message content to send.',
        },
        type: {
          type: 'string',
          enum: Object.values(MESSAGE_TYPES),
          description: `Message type. Defaults to "text".`,
        },
        urgency: {
          type: 'string',
          enum: Object.values(URGENCY_LEVELS),
          description: `Urgency level. Defaults to "active".`,
        },
        correlation_id: {
          type: 'string',
          description:
            'For response-type messages, the envelope_id of the message being replied to.',
        },
      },
      required: ['to', 'message'],
    },
  },
  {
    name: 'wire_status',
    description:
      'Check Wire connection status, session ID, and message history.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        include_log: {
          type: 'boolean',
          description:
            'Include recent message log in the response. Defaults to false.',
        },
      },
    },
  },
];

// ====================================================================
// Handlers
// ====================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(
  CallToolRequestSchema,
  async (request) => {
    const { name, arguments: args } = request.params;

    if (name === 'wire_send') {
      return handleWireSend(args as unknown as WireSendArgs);
    }

    if (name === 'wire_status') {
      return handleWireStatus(args as unknown as WireStatusArgs);
    }

    return {
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      isError: true,
    };
  },
);

// ====================================================================
// wire_send
// ====================================================================

interface WireSendArgs {
  to: string;
  message: string;
  type?: string;
  urgency?: string;
  correlation_id?: string;
}

async function handleWireSend(args: WireSendArgs) {
  const result: Result<Envelope> = createEnvelope({
    from: SESSION_ID,
    to: args.to,
    type: (args.type as Envelope['type']) || MESSAGE_TYPES.TEXT,
    urgency:
      (args.urgency as Envelope['urgency']) || URGENCY_LEVELS.ACTIVE,
    payload: args.message,
    correlationId: args.correlation_id,
  });

  if (!result.ok) {
    return {
      content: [
        { type: 'text' as const, text: `Wire error: ${result.error}` },
      ],
      isError: true,
    };
  }

  const envelope: Envelope = result.value;
  messageLog.push(envelope);

  // In 3.5a: emit as channel notification (echoes back to this session).
  // In 3.5b: route via relay to recipient session.
  const meta = envelopeToMeta(envelope);

  try {
    await server.notification({
      method: 'notifications/claude/channel',
      params: {
        content: `[Wire from ${envelope.from} to ${envelope.to}] ${args.message}`,
        meta,
      },
    });
  } catch {
    // Notification failure is non-fatal — log the envelope anyway
  }

  return {
    content: [
      {
        type: 'text',
        text: `Sent (${envelope.id}) to ${envelope.to} [${envelope.type}/${envelope.urgency}]`,
      },
    ],
  };
}

// ====================================================================
// wire_status
// ====================================================================

interface WireStatusArgs {
  include_log?: boolean;
}

async function handleWireStatus(args: WireStatusArgs) {
  const uptimeMs = Date.now() - startTime;
  const uptimeMin = Math.floor(uptimeMs / 60000);
  const uptimeSec = Math.floor((uptimeMs % 60000) / 1000);

  const lines = [
    `Session ID: ${SESSION_ID}`,
    `Uptime: ${uptimeMin}m ${uptimeSec}s`,
    `Messages sent: ${messageLog.length}`,
    `Server version: 0.1.0`,
    `Protocol: MCP channel (notifications/claude/channel)`,
  ];

  if (args.include_log && messageLog.length > 0) {
    lines.push('', 'Recent messages:');
    const recent = messageLog.slice(-10);
    for (const env of recent) {
      lines.push(
        `  ${env.timestamp} [${env.type}/${env.urgency}] → ${env.to}: ${String(env.payload).substring(0, 80)}`,
      );
    }
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }],
  };
}

// ====================================================================
// Main
// ====================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`Wire server fatal: ${err}\n`);
  process.exit(1);
});
