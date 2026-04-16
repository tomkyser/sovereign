# Wire Research — M-3.5 Inter-Session Communication

Date: 2026-04-15
Binary: CC 2.1.101 (native, arm64-darwin)
Sources: Binary analysis, leaked CC source, dynamo Wire implementation

---

## Executive Summary

CC has THREE messaging layers. Two are live in the external build, one is DCE'd:

| Layer | Status | Mechanism | Scope |
|-------|--------|-----------|-------|
| **Teammate Mailbox** | LIVE | File-based (`.claude/teams/{team}/inboxes/`) | In-process swarm agents |
| **UDS Inbox** | DCE'd | Unix Domain Sockets (`cross-session-message` tag) | Same-machine sessions |
| **Channels API** | LIVE (gated) | MCP notifications (`notifications/claude/channel`) | Any MCP server |

The Channels API is the viable transport for Wire. `tengu_harbor` is already `True` in
`~/.claude.json` on this machine, meaning the runtime gate passes. The `--channels` CLI
flag and `--dangerously-load-development-channels` bypass are both present in the binary.

---

## Finding 1: Channels API Architecture (CRITICAL)

### How It Works

1. An MCP server declares `experimental["claude/channel"]` in its capabilities
2. CC's `gateChannelServer()` (source: `channelNotification.ts`) checks a 6-layer gate:
   - Server declared `claude/channel` capability
   - `isChannelsEnabled()` → `tengu_harbor` feature flag (GrowthBook, default false)
   - OAuth authentication (claude.ai login required, API key users blocked)
   - Team/Enterprise policy opt-in (`channelsEnabled: true`)
   - Session `--channels` list (server must be explicitly listed)
   - Allowlist check (`tengu_harbor_ledger` or org policy `allowedChannelPlugins`)
3. On registration, CC installs a notification handler via `client.setNotificationHandler()`
4. Inbound `notifications/claude/channel` messages are wrapped in `<channel>` XML tag
5. Message is enqueued via `vD()` with `priority: "next"` — lands as next prompt in conversation

### Message Injection Path (Binary Offsets)

```
MCP notification → $4_ schema validation → A4_ wraps in <channel source="..."> tag
  → vD({mode:"prompt", value:..., priority:"next", isMeta:true, origin:{kind:"channel"}})
    → eT queue → AtH dequeue (priority: now=0, next=1, later=2) → model sees message
```

### Key Binary Symbols

| Symbol | Offset | Role |
|--------|--------|------|
| `vMH()` | 9985385 | `isChannelsEnabled()` — reads `tengu_harbor` |
| `z4_()` | 9986132 | `gateChannelServer()` — 6-layer gate |
| `A4_()` | 9985677 | `wrapChannelMessage()` — XML formatting |
| `vD()` | 4438081 | Prompt queue enqueue (priority:"next") |
| `AtH()` | (in vD area) | Dequeue by priority |
| `$4_` | 9987936 | Channel notification Zod schema |
| `DWH` | 870835 | = "channel" (XML tag name) |
| `kM` | 870817 | = "teammate-message" |

### Gate Status on This Machine

- `tengu_harbor`: **True** (in `~/.claude.json` cachedGrowthBookFeatures)
- `tengu_harbor_permissions`: Unknown (channel permission relay, separate flag)
- `tengu_harbor_ledger`: Unknown (approved plugin allowlist)
- OAuth: Available via `/login`
- `--dangerously-load-development-channels`: Present in binary (bypass allowlist)

### Implications for Wire

The Channels API is the **primary inbound transport**. Wire's MCP server declares
`claude/channel`, gets registered via `--channels` or `--dangerously-load-development-channels`,
and pushes notifications that land directly in the conversation as `<channel>` tagged messages.

No binary patching needed for the transport itself — the infrastructure is live.

---

## Finding 2: UDS Inbox is DCE'd (Confirmed)

### What's Gone

| Pattern | Occurrences | Status |
|---------|-------------|--------|
| `UDS_INBOX` | 0 | Build-time DCE'd via `feature('UDS_INBOX')` |
| `cross-session-message` | 0 | XML tag stripped |
| `COORDINATOR_MODE` | 0 | Build-time DCE'd |
| `CLAUDE_CODE_COORDINATOR_MODE` | 0 | Env var stripped |
| `ListPeers` | 0 | Tool stripped |

### What Survives

| Pattern | Occurrences | Context |
|---------|-------------|---------|
| `uds:` scheme | 1 (offset 8800270) | In `parseAddress()` — routing remnant |
| `cross-session` | 1 (offset 12355949) | In prompt text about memory (informational) |
| `SendMessage` | 20 | Teammate routing only (no UDS path) |
| `TeamCreate` | 5 | Swarm/team creation still live |

### SendMessage Tool

SendMessage (var `P2` at offset 4046085) is the **teammate** messaging tool, not a
cross-session tool. Its prompt shows UDS routing (`uds:/path.sock`, `bridge:session_...`)
only when `feature('UDS_INBOX')` is true — which it never is in external builds.

In external builds, SendMessage routes to teammates by name within the same process/team.
There is no cross-session capability in the external SendMessage tool.

---

## Finding 3: Teammate Mailbox Architecture (Live)

### File-Based Messaging

Source: `utils/teammateMailbox.ts` (1184 lines)

- Inbox path: `~/.claude/teams/{team_name}/inboxes/{agent_name}.json`
- Messages: `{ from, text, timestamp, read, color, summary }`
- Locking: `lockfile` with retry/backoff (10 retries, 5-100ms timeout)
- Delivery: File write → recipient polls or gets notified via tool round
- Tags: Messages wrapped in `<teammate-message>` XML tag

### Swarm Backends

Three backend types for spawning teammates:
1. **tmux**: tmux pane management (works in tmux or standalone)
2. **iterm2**: iTerm2 native split panes via it2 CLI
3. **in-process**: Same Node.js process with isolated AsyncLocalStorage context

### Relevance to Wire

The teammate mailbox is **intra-swarm** (within one user's team). Wire is **inter-session**
(between independent Claude sessions). However, the teammate architecture shows how CC
manages agent identity, message routing, and team discovery — patterns Wire should follow.

---

## Finding 4: Permission System Over Channels

Source: `channelPermissions.ts` (241 lines)

The Channels API includes a full permission relay system:
- CC sends permission prompts to channel servers
- Server formats for its platform (Telegram, iMessage, Discord)
- Human replies "yes tbxkq" (5-letter ID, no 'l', blocklist-checked)
- Server parses and emits `notifications/claude/channel/permission`
- CC matches against pending map, resolves allow/deny

This is gated behind `tengu_harbor_permissions` (separate from `tengu_harbor`).
For Wire, this means inter-session permission delegation is architecturally possible.

---

## Finding 5: Dynamo Wire Source Analysis

### Component Map (2526 lines, 10 files)

| File | Lines | Role |
|------|-------|------|
| `wire.cjs` | 429 | Main service — composes all components |
| `protocol.cjs` | 128 | Typed envelopes, message types, urgency levels |
| `registry.cjs` | 238 | Session registry with disconnect buffering |
| `transport.cjs` | 184 | Transport router with urgency-based selection |
| `relay-server.cjs` | 315 | HTTP relay for bulk/background messages |
| `channel-server.cjs` | 367 | MCP server declaring `claude/channel` |
| `queue.cjs` | 141 | Priority queue with urgency ordering |
| `write-coordinator.cjs` | 413 | Shared resource write coordination |
| `channels-transport.cjs` | 102 | MCP notification emission wrapper |
| `relay-transport.cjs` | 209 | HTTP transport to relay server |

### Dependencies to Adapt

dynamo Wire depends on:
- `../../../lib/index.cjs` — `ok()`, `err()`, `createContract()` result types
- `@modelcontextprotocol/sdk/server` — MCP Server, StdioServerTransport
- `node:events` — EventEmitter (registry lifecycle events)
- `node:crypto` — randomUUID (envelope IDs)
- `node:http` — relay server

### Key Design Decisions from dynamo

- **D-01**: Pluggable transport abstraction (Channels + relay + future)
- **D-04**: Typed envelope `{from, to, type, urgency, payload, timestamp, correlationId}`
- **D-05**: Wire inspects envelope for routing, payload is opaque
- **D-06**: General-purpose topology, no hardcoded roles
- **D-07**: Registry pattern for session discovery
- **D-09**: Urgency-level priority routing
- **D-10**: Buffered reconnection with configurable TTL
- **D-13**: Dual API surface (native + MCP)

---

## Finding 6: Feature Flag Architecture for Channels

The `E_()` function (feature flag reader) checks three sources in order:
1. `RZH()` — Runtime overrides (appears to be a Map, checked first)
2. `GZH()` — Returns undefined in external build (server-synced features, stubbed)
3. `w_().cachedGrowthBookFeatures?.[flag]` — Cached features from `~/.claude.json`

Since GZH() is stubbed and RZH() returns a local override map, the effective path is:
`cachedGrowthBookFeatures` in `~/.claude.json`. This is the same mechanism used for
`quiet_salted_ember` — we can set any feature flag by writing to this cache.

**However**: The bootstrap function (`ms7()`) syncs with Anthropic's server on startup.
Our PATCH 12 (clientDataCache preservation) only protects `clientDataCache`, NOT
`cachedGrowthBookFeatures`. If Anthropic's server returns `tengu_harbor: false`, our
local `True` gets overwritten.

**Risk assessment**: Currently `tengu_harbor` is `True` from the server — Anthropic has
enabled Channels. If they disable it, we'd need to either:
1. Extend PATCH 12 to also preserve `cachedGrowthBookFeatures`, or
2. Binary-patch `vMH()` to always return true, or
3. Accept the dependency and re-set after each bootstrap

---

## Finding 7: Integration Surface for Wire

### What Wire Must Become (in claude-governance context)

Wire isn't just a communication library — it's a multi-layer integration:

| Layer | Component | Purpose |
|-------|-----------|---------|
| **MCP Server** | Wire channel server | Declares `claude/channel`, handles inbound/outbound |
| **Injected Tool** | Wire tool | Session registers, sends, receives, discovers peers |
| **Prompt Override** | System prompt additions | Teaches model about Wire, when to use it |
| **Hooks** | Session start/stop | Wire health check, auto-registration, cleanup |
| **CLI** | `--channels` integration | Wire server in channels list |
| **Skill** | `/coordinate` | User-initiated cross-session collaboration |
| **Tungsten** | Process spawning | Launch Wire-connected Claude instances |

### Transport Architecture (revised from dynamo)

| Transport | Role | Binary Support |
|-----------|------|---------------|
| **Channels API** | Bidirectional — inbound via notifications, outbound via MCP tools | LIVE — `notifications/claude/channel` + tool calls |
| **HTTP Relay** | Cross-machine routing between Wire MCP servers | May need for remote sessions |
| **File-based** | Fallback for environments without Channels | Pattern exists in teammate mailbox |

### Bidirectional Communication via MCP Tools

The Channels API is **bidirectional by design**. An MCP server that declares
`claude/channel` handles BOTH directions:

- **Inbound** (to Claude): Server sends `notifications/claude/channel` → message
  arrives as `<channel>` tag in conversation
- **Outbound** (from Claude): Server exposes MCP tools (e.g., `reply`, `send`) →
  Claude calls them to send messages out

Reference implementation: [fakechat1] — Anthropic's official channel test plugin.
The server declares `{ tools: {}, experimental: { 'claude/channel': {} } }` in
capabilities, sends notifications for inbound, and exposes `reply`/`edit_message`
tools for outbound. The server's `instructions` field teaches Claude how to reply.

```
Session A (Claude) calls Wire MCP reply tool → Wire MCP Server routes to Session B's
  Wire MCP Server → sends notifications/claude/channel → Session B (Claude) sees message
  → Session B calls its Wire MCP reply tool → routes back to Session A
```

This means Wire is **one MCP server per session**, handling both directions.
No separate injected tool needed. No relay for the basic case.

---

## Open Questions for Phase Planning

1. **OAuth requirement**: `gateChannelServer()` requires claude.ai OAuth. Do all target
   users have this? API-key-only users are blocked. Is this acceptable?

2. **Allowlist bypass**: `--dangerously-load-development-channels` bypasses the allowlist
   but requires the flag at session launch. Can our shim/wrapper add this automatically?

3. **MCP server lifecycle**: How does Wire's MCP server start? As a sidecar process?
   Embedded in the governance shim? The MCP server must be running BEFORE Claude connects.

4. **Session discovery**: How do sessions find each other? The relay server is the obvious
   answer, but where does it run? `localhost` works for same-machine; what about remote?

5. **Bootstrap race**: The MCP server must be in the session's `--channels` list at launch.
   Can we modify `~/.claude/settings.json` to include Wire's MCP server config?

6. **GrowthBook sync risk**: If Anthropic disables `tengu_harbor` server-side, Channels
   stops working. Do we need a binary patch to future-proof this?

---

## References

- [ccleaks1] — CC source dump (channelNotification.ts, channelPermissions.ts, channelAllowlist.ts)
- Binary offsets verified against `native-claudejs-patched.js` (CC 2.1.101)
- dynamo Wire source: `/Users/tom.kyser/Library/Mobile Documents/com~apple~CloudDocs/dev/dynamo/core/services/wire/`
