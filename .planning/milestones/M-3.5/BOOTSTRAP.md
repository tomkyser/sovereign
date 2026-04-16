# Milestone 3.5 Bootstrap — Wire Inter-Session Communication

---

**Status:** Phase 3.5a COMPLETE, Phase 3.5b next
**Baseline:** 22/22 SOVEREIGN on CC 2.1.101
**Previous milestone:** M-3 (System Prompt Control) — COMPLETE

## Read These Files (In This Order)

1. `.planning/VISION.md` — Ground yourself in the project intent
2. `.planning/STATE.md` — Current project state
3. `.planning/ROADMAP.md` — M-3.5 section has all 6 phases
4. `.planning/milestones/M-3.5/3.5a-wire-mcp-server/HANDOFF.md` — **What 3.5a delivered**
5. `.planning/milestones/M-3.5/RESEARCH.md` — Milestone-level research (7 findings)
6. `.planning/REFERENCES.md` — [channelsRef1], [fakechat1], [dynamoWire]
7. `code.claude.com/docs/en/channels-reference` — **Official channels docs** (read via WebFetch)

## What M-3.5 Is

Wire adds inter-session communication to claude-governance. Multiple Claude Code sessions
can discover each other, send typed messages, and collaborate on tasks. Built on CC's
native Channels API — no binary patching needed for the transport itself.

## What 3.5a Delivered

A standalone MCP server (`data/wire/wire-server.cjs`) that:
- Declares `claude/channel` capability → CC registers notification listener
- Exposes `wire_send` and `wire_status` tools → Claude can send messages
- Uses typed envelopes (from/to/type/urgency/payload/correlationId)
- Emits `notifications/claude/channel` with proper meta keys
- Bundles MCP SDK v1.29.0 inline (self-contained CJS)
- Integrated as governance module (`src/modules/wire.ts`)

**Tested:** MCP protocol fully verified. Live CC shows server connected with both tools.

## Starting Phase 3.5b — Session Registry & Cross-Session Routing

### What 3.5b Needs to Do
1. **Session registry** — how sessions register, discover, and look up each other
2. **Cross-session routing** — how a message from session A reaches session B
3. **Priority queue** — urgency-based delivery ordering
4. **Disconnect buffering** — hold messages during session absence

### Key Constraint
Each CC session runs its own Wire MCP server instance. There's no shared daemon.
Routing between sessions needs a relay mechanism — either a shared relay server
process, filesystem coordination, or network-based discovery.

### Source Material
- dynamo `registry.cjs` — registration/discovery patterns
- dynamo `queue.cjs` — priority queue with urgency ordering
- dynamo `relay-server.cjs` — relay server for cross-session routing
- dynamo `transport-router.cjs` — transport abstraction layer

### Key Decisions for 3.5b
- Relay transport: local HTTP? Unix sockets? Filesystem? (dynamo uses HTTP relay)
- Registry persistence: file-based? In-memory with heartbeat? (dynamo uses in-memory + TTL)
- Discovery: how does session A learn session B exists?

## Interstitial Work (Available This Session)
- REPL `allowAllModules`: `repl.allowAllModules: true` in config unlocks all Node.js modules
- `process` in REPL VM sandbox
- Tungsten guidance in CLAUDE.md (persistent shell, agent inheritance, session spawning)
