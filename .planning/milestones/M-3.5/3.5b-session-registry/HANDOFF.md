# Phase 3.5b Handoff — Session Registry & Cross-Session Routing

Date: 2026-04-16
Status: COMPLETE
Previous: 3.5a (Wire MCP server with channel capability)

---

## What Was Built

Cross-session message routing for Wire. When Claude in Session A calls
`wire_send(to=SESSION_B)`, the message routes through a shared HTTP relay,
gets delivered to Session B's poll loop, and arrives as a `<channel>` notification.

### New Files (6)

| File | Purpose |
|------|---------|
| `src/wire/registry.ts` | Session registry — Map store, TTL disconnect buffering, EventEmitter |
| `src/wire/queue.ts` | Priority queue — 4-tier urgency (urgent > directive > active > background) |
| `src/wire/relay-server.ts` | HTTP relay — 7 endpoints, long-poll, broadcast, port fallback, auto-shutdown |
| `src/wire/relay-client.ts` | Relay client — fetch-based register/send/poll/discover with poll loop |
| `src/wire/relay-lifecycle.ts` | Relay process management — auto-start, PID files, health check |

### Modified Files (2)

| File | Changes |
|------|---------|
| `src/wire/types.ts` | +7 interfaces: RegistryEntry, RelayConfig, RegisterRequest, UnregisterRequest, PollResponse, DiscoverResult, RelayHealthResponse |
| `src/wire/server.ts` | Rewritten: relay integration, wire_discover tool, enhanced wire_status, graceful degradation |
| `tsdown.wire.config.ts` | Dual entry points: wire-server + wire-relay |

### New MCP Tools

- **wire_discover** — Lists all sessions connected to the relay with identity and status
- **wire_status** — Enhanced with relay connection state, peer count, relay uptime

### Build Artifacts

- `data/wire/wire-server.cjs` (480KB) — MCP server bundled with SDK + relay client
- `data/wire/wire-relay.cjs` (14KB) — Standalone relay server, no MCP SDK
- `data/wire/protocol-*.cjs` (5KB) — Shared chunk (protocol module)

## Architecture

```
Session A                           Session B
┌─────────────┐                     ┌─────────────┐
│ Claude Code  │                     │ Claude Code  │
│   ↕ stdio    │                     │   ↕ stdio    │
│ Wire MCP Srv │──── HTTP ────┐  ┌───│ Wire MCP Srv │
│  (poll loop) │              │  │   │  (poll loop) │
└─────────────┘              ↓  ↓   └─────────────┘
                     ┌──────────────┐
                     │  Wire Relay  │
                     │  (HTTP srv)  │
                     │  port 9876   │
                     │  ┌────────┐  │
                     │  │Registry│  │
                     │  │Queue   │  │
                     │  │Mailbox │  │
                     │  └────────┘  │
                     └──────────────┘
```

### Message Flow (A → B)
1. Claude A calls `wire_send(to=B_ID, message="...")`
2. MCP Server A creates envelope, POSTs to relay `/send`
3. Relay stores in B's mailbox (priority queue)
4. MCP Server B receives message from `GET /poll` response
5. MCP Server B sends `notifications/claude/channel` to CC
6. Claude B sees `<channel source="wire" ...>` message

### Relay Lifecycle
- First MCP server spawns relay as detached child process
- Relay writes PID to `~/.claude-governance/wire/relay.pid`
- Relay writes port to `~/.claude-governance/wire/relay.port`
- Subsequent MCP servers read port file, connect to existing relay
- Relay self-terminates after 5 min with no registered sessions

## Key Decisions

- D-01: HTTP relay (node:http, no external deps)
- D-02: Long-polling (25s timeout, under Node's 30s default)
- D-03: Relay auto-started by first MCP server as detached child
- D-08: Session identity: WIRE_SESSION_NAME env → cwd basename → random suffix
- D-09: Graceful degradation: local-only mode when relay unavailable
- D-10: Shared protocol chunk via tsdown code splitting

## What's NOT Done (for next phases)

- **3.5c**: Wire as a governance module (shim integration, auto-launch, verification)
- **3.5d**: Prompt overrides teaching the model Wire
- **3.5e**: /coordinate skill + Tungsten orchestration
- **3.5f**: Hardening, WebSocket upgrade, testing, docs
- E2E test with two CC sessions not yet done (requires 3.5c governance integration)
- Broadcast not verified end-to-end (relay logic tested, MCP routing not tested)

## Gotchas for Next Phase

1. **Relay auto-start requires the CJS artifact path.** Server computes it from `process.argv[1]`. If the governance module changes how Wire is launched, this path resolution may break.
2. **Shared protocol chunk has a hash in its filename** (e.g., `protocol-CXWKtyVA.cjs`). All three files must be deployed together.
3. **Relay logs to file** (`~/.claude-governance/wire/relay.log`) because it's a detached process. No stdout/stderr visible.
4. **ESLint has a pre-existing chalk compatibility crash.** Use `tsc --noEmit` for typecheck, not `pnpm lint`.
