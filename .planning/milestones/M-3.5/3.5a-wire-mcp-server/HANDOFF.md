# Phase 3.5a Handoff — Wire MCP Server

Date: 2026-04-16

## What Was Delivered

A standalone MCP server that declares `claude/channel` capability, implements typed
message envelopes with urgency levels, and exposes `wire_send` + `wire_status` tools.
Bundled as a 462KB self-contained CJS artifact. Integrated into governance as a module.

### Files Created
| File | Purpose |
|------|---------|
| `src/wire/types.ts` | MessageType, UrgencyLevel, Envelope, EnvelopeInput, Result<T> |
| `src/wire/protocol.ts` | createEnvelope, validateEnvelope, filterMetaKeys, envelopeToMeta |
| `src/wire/server.ts` | MCP Server: claude/channel capability, wire_send, wire_status |
| `tsdown.wire.config.ts` | Build config — bundles MCP SDK + ajv into standalone CJS |
| `data/wire/wire-server.cjs` | Built artifact (462KB) |
| `src/modules/wire.ts` | Governance module — registers in .mcp.json, default disabled |
| `src/modules/registry.ts` | Updated — wire added to ALL_MODULES |
| `src/index.tsx` | Updated — handleLaunch injects channel flags when wire enabled |
| `.mcp.json` (project-level) | Wire server registration for development testing |

### Key Decisions
- **D-01**: TypeScript + CJS via tsdown (same toolchain as REPL/Tungsten/Ping)
- **D-02**: Port envelope types from dynamo protocol.cjs, simplified message types
- **D-03**: Standalone CJS entry point (MCP server process, not CC tool)
- **D-04**: No relay in 3.5a — direct notification only
- **D-05**: Two tools: wire_send (outbound), wire_status (session info)
- **D-06**: Instructions field teaches Claude about Wire (fakechat pattern)
- **D-07**: `--dangerously-load-development-channels server:wire` is the only launch flag needed

## What Was Verified

### MCP Protocol (Node.js harness) — ALL PASS
- Initialize → correct capabilities, serverInfo, instructions
- tools/list → 2 tools with complete input schemas
- wire_status → session ID, uptime, message count
- wire_send → creates envelope, emits notifications/claude/channel with meta
- Channel notification → correct format with envelope_id, message_type, urgency, sender

### Live CC Integration — VERIFIED
- CC spawns Wire server as subprocess (`/mcp` shows `wire · connected`)
- Channel listener registers ("Listening for channel messages from: server:wire")
- Both tools discovered (`mcp__wire__wire_send`, `mcp__wire__wire_status`)
- Full tool schemas visible in /mcp panel

### Build Pipeline — VERIFIED
- `pnpm build:wire` produces self-contained CJS
- MCP SDK bundled inline (no external requires except node: builtins)
- Full project typecheck clean

## Findings

### F-ACT-1: Channel names must be tagged
`--channels wire` rejected. Must be `server:wire` or `plugin:name@marketplace`.

### F-ACT-2: MCP SDK v1.29.0 uses newline-delimited JSON
ReadBuffer scans for \n, not Content-Length headers.

### F-ACT-3: .cjs extension required
`package.json` has `"type": "module"`. Node treats .js as ESM.

### F-ACT-4: --dangerously-load-development-channels is the only flag needed
Per official docs: no --channels needed separately. Dev flag bypasses allowlist AND registers.

### F-ACT-5: Official docs confirm our implementation matches the contract
Capability declaration, notification format, meta key rules, instructions field,
stdio transport — all exact match with code.claude.com/docs/en/channels-reference.

### F-ACT-6: Permission relay available for future phases
`claude/channel/permission` capability enables tool approval relay.
Not needed for 3.5a but valuable for 3.5d behavioral integration.

## What's Next (3.5b)

Phase 3.5b: Session Registry & Cross-Session Routing
- Port registry from dynamo (register, unregister, lookup, disconnect/reconnect with TTL)
- Session discovery mechanism
- Cross-session message routing between Wire MCP servers
- Priority queue with urgency-based delivery
- Disconnect buffering

The Wire server from 3.5a is the transport layer. 3.5b adds routing so
session A can find and message session B.

## Gotchas for Next Session
- The `.mcp.json` at project root is for development testing — not committed to git
- Wire module is `defaultEnabled: false` — must be explicitly enabled in config
- `tengu_harbor` flag could be disabled server-side by Anthropic at any time
- Channels require claude.ai login (not Console/API key auth)
- The governance shim's launch flag injection (`src/index.tsx`) reads config async
