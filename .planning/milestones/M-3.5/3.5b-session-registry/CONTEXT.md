# 3.5b-session-registry — Context

Last updated: 2026-04-16

## Shared State

### Research Complete
12 findings documented in RESEARCH.md covering:
- Relay architecture (Node.js HTTP, not Bun)
- MCP server concurrent polling (confirmed feasible via event loop)
- File-based relay lifecycle coordination (~/.claude-governance/wire/)
- Registry design (port from dynamo, disconnect buffering with TTL)
- Priority queue (4-tier urgency ordering)
- End-to-end message flow (wire_send → relay → poll → notification)
- New wire_discover tool for session discovery
- Build architecture (2 artifacts: wire-server.cjs, wire-relay.cjs)

### Key Architecture Decisions (from research)
- HTTP relay on localhost (same pattern as dynamo)
- Long-polling for message delivery (WebSocket deferred)
- Relay auto-started by first MCP server, shared by all
- PID + port files for relay discovery
- No external dependencies — pure Node.js built-ins for relay
- Priority queue for poll response ordering
- In-memory only — no message persistence

### Files That Will Change
NEW (5): registry.ts, queue.ts, relay-server.ts, relay-client.ts, relay-lifecycle.ts
MODIFIED (3): server.ts, types.ts, tsdown.wire.config.ts
BUILD ARTIFACTS (2): wire-server.cjs (updated), wire-relay.cjs (new)

### Dynamo Source Mapping
| Our File | Dynamo Source | Lines | Port Strategy |
|----------|--------------|-------|---------------|
| registry.ts | registry.cjs | 238 | Direct port, replace Map callbacks with typed TS |
| queue.ts | queue.cjs | 141 | Direct port, use our URGENCY_LEVELS from types.ts |
| relay-server.ts | relay-server.cjs | 315 | Bun.serve → node:http, drop WebSocket for now |
| relay-client.ts | relay-transport.cjs | 209 | Direct port, uses node:http or global fetch |
| relay-lifecycle.ts | (new) | ~100 | PID file management, auto-start |

## Agent Notes
- Poll timeout must be 25s (under Node's 30s default socket timeout)
- Relay port: 9876 default, fallback range 9877-9886
- Session identity: WIRE_SESSION_NAME env var → cwd basename → random suffix
- Relay idle timeout: 5 minutes with no sessions (TBD in planning)


Last updated: 2026-04-16

## Phase Status: COMPLETE

All 9 tasks across 5 waves delivered. Full integration verified.

## Files Created/Modified

| File | Action | Lines | Description |
|------|--------|-------|-------------|
| `src/wire/types.ts` | Modified | ~90 | Added 7 interfaces: RegistryEntry, RelayConfig, RegisterRequest, UnregisterRequest, PollResponse, DiscoverResult, RelayHealthResponse |
| `src/wire/registry.ts` | New | ~130 | Session registry with Map store, TTL disconnect buffering, EventEmitter, ported from dynamo |
| `src/wire/queue.ts` | New | ~100 | Priority queue with 4-tier urgency ordering, configurable depth limits, ported from dynamo |
| `src/wire/relay-server.ts` | New | ~320 | HTTP relay server: 7 endpoints, long-poll, broadcast, port fallback, PID files, idle timeout |
| `src/wire/relay-client.ts` | New | ~170 | Relay HTTP client: register/send/poll/discover/health, poll loop with backoff |
| `src/wire/relay-lifecycle.ts` | New | ~100 | Relay process management: ensureRelay, isRelayRunning, startRelay, cleanStaleState |
| `src/wire/server.ts` | Rewritten | ~300 | MCP server with relay integration, wire_discover tool, enhanced wire_status, graceful degradation |
| `tsdown.wire.config.ts` | Modified | ~17 | Dual entry points: wire-server + wire-relay |

## Build Artifacts

| File | Size | Contents |
|------|------|----------|
| `data/wire/wire-server.cjs` | 480KB | MCP server + MCP SDK + relay client + lifecycle |
| `data/wire/wire-relay.cjs` | 14KB | Standalone relay server (no MCP SDK) |
| `data/wire/protocol-*.cjs` | 5KB | Shared protocol chunk (validateEnvelope, createEnvelope) |

## Integration Test Results (2026-04-16)

All endpoints verified via curl:
- GET /health → status ok, session count, uptime, port
- POST /register → session registered with identity + capabilities
- GET /sessions → full session list with metadata
- POST /send → message delivered to recipient's mailbox/poll
- GET /poll → long-poll returns queued messages
- POST /unregister → clean session removal
- PID file, port file, relay log all written correctly
- Full typecheck (tsc --noEmit) passes
- Full build (pnpm build:wire) produces all artifacts
