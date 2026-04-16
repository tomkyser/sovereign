# Phase 3.5a Planning — Wire MCP Server

## Scope

Build the Wire MCP server: a standalone stdio process that declares `claude/channel`
capability, handles bidirectional messaging via CC's Channels API, and packages as a
CJS build artifact within claude-governance.

**Phase scope**: Server only. No relay, no registry, no cross-session routing (3.5b).
No governance integration (3.5c). No behavioral prompts (3.5d).

**Milestone scope**: M-3.5 adds inter-session communication. This phase builds the
foundational transport — subsequent phases build routing, integration, and behavior.

**Project scope**: Wire is the first component that extends claude-governance beyond
patching/overriding. It adds a new runtime artifact (MCP server process) and a new
integration pattern (channel registration via CLI flags).

## Approach

### Architecture

```
claude-governance/
  src/wire/
    protocol.ts        — Typed envelopes, message types, urgency, validation
    server.ts          — MCP Server (main entry point, stdio transport)
    types.ts           — TypeScript type definitions
  data/wire/
    wire-server.cjs    — Built standalone CJS artifact (tsdown output)
```

The server runs as a standalone stdio process spawned by CC when configured as an
MCP server. It does NOT run inside the claude-governance process — it runs as a
child process of CC, communicating via MCP protocol over stdin/stdout.

### Dependency: @modelcontextprotocol/sdk

The MCP SDK must be available at runtime. Two options:

**Option A: Bundle into CJS output** — tsdown resolves and inlines the SDK into
wire-server.cjs. Self-contained, no runtime dependency. But the SDK is ~50KB+ and
may have Node.js API assumptions.

**Option B: Peer dependency** — declare `@modelcontextprotocol/sdk` as a dependency
of the claude-governance npm package. CC already has it in its own node_modules;
the Wire server could resolve from the user's global install.

**Decision: Option A (bundle).** Self-contained aligns with project principle #4
(self-contained npm package). The SDK is small and stable. tsdown handles this.

### Message Protocol

Port from dynamo `protocol.cjs`, simplified:

**Message types** (initial set for Wire):
- `text` — plain text message between sessions
- `request` — request/response pattern (with correlationId)
- `response` — response to a request
- `heartbeat` — keepalive signal
- `status` — session status update

**Urgency levels** (from dynamo, unchanged):
- `urgent` — priority 0, bypasses queue
- `directive` — priority 1
- `active` — priority 2 (default)
- `background` — priority 3

**Envelope shape**:
```typescript
{
  id: string;          // crypto.randomUUID()
  from: string;        // sender session ID
  to: string;          // recipient session ID (or "broadcast")
  type: MessageType;
  urgency: UrgencyLevel;
  payload: unknown;    // opaque — Wire routes, doesn't inspect
  timestamp: string;   // ISO 8601
  correlationId?: string;
}
```

### MCP Server Design

Following fakechat pattern:

```typescript
const server = new Server(
  { name: 'wire', version: '0.1.0' },
  {
    capabilities: { tools: {}, experimental: { 'claude/channel': {} } },
    instructions: '...'  // teaches Claude about Wire
  }
);
```

**Tools exposed:**
- `wire_send` — send typed envelope to a session ID
- `wire_status` — report connection status, session info

**Inbound path**: Other Wire servers relay messages → this server receives → calls
`server.notification({ method: 'notifications/claude/channel', ... })` → CC injects
as `<channel source="wire">` message.

**Outbound path**: Claude calls `wire_send` → server creates envelope → (in 3.5a,
logs/stores locally; in 3.5b, routes via relay).

### Testing Strategy

1. **Unit**: Protocol validation, envelope creation, meta key filtering
2. **Integration**: Launch CC with Wire as MCP server, verify `<channel>` delivery
3. **End-to-end verification command**: `--dangerously-load-development-channels`

For 3.5a, the "end-to-end" test is single-session: manually trigger a notification
and verify Claude sees it. True cross-session testing requires 3.5b relay.

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| MCP SDK bundling breaks | Server can't start | Test bundle in isolation before integration |
| `tengu_harbor` disabled by Anthropic | Channels API dead | Monitor; future patch for cachedGrowthBookFeatures |
| OAuth requirement blocks some users | Can't use Wire | Document requirement; investigate API key workaround |
| tsdown can't bundle MCP SDK cleanly | Build fails | Fall back to externalize + declare as npm dependency |
| CC changes channel notification schema | Wire messages rejected | Version-detect; binary symbol verification |

## Dependencies

- tsdown build pipeline (exists, proven with REPL/Tungsten/Ping)
- `@modelcontextprotocol/sdk` (npm package)
- CC 2.1.101 binary with Channels API live

## Non-Goals for 3.5a

- Cross-session routing (relay server) — 3.5b
- Session registry / discovery — 3.5b
- Governance module integration — 3.5c
- Prompt/behavioral integration — 3.5d
- User-facing `/coordinate` skill — 3.5e
- Error recovery / reconnection hardening — 3.5f
