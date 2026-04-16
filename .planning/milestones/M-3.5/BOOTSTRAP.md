# Milestone 3.5 Bootstrap — Wire Inter-Session Communication

---

**Status:** Phase 3.5b COMPLETE — Phase 3.5c next (Governance Integration)
**Baseline:** 22/22 SOVEREIGN on CC 2.1.101
**Previous milestone:** M-3 (System Prompt Control) — COMPLETE

## Read These Files (In This Order)

1. `.planning/milestones/M-3.5/3.5b-session-registry/HANDOFF.md` — **What 3.5b delivered**
2. `.planning/milestones/M-3.5/CONTEXT.md` — Milestone-level shared state
3. `.planning/ROADMAP.md` — Phase 3.5c scope (Governance Integration)
4. Read the current Wire source: `claude-governance/src/wire/{types.ts, protocol.ts, server.ts, registry.ts, queue.ts, relay-server.ts, relay-client.ts, relay-lifecycle.ts}`
5. Read the governance module: `claude-governance/src/modules/wire.ts`
6. `.planning/milestones/M-3.5/3.5a-wire-mcp-server/HANDOFF.md` — What 3.5a delivered (for governance integration context)

## What Was Built So Far

### Phase 3.5a ✅ — Wire MCP Server
Single-session Wire MCP server with channel capability. `wire_send` and `wire_status` tools.
Local notification echo only (no cross-session routing).

### Phase 3.5b ✅ — Session Registry & Cross-Session Routing
Cross-session message routing via HTTP relay. Full architecture:

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
                     └──────────────┘
```

New files: registry.ts, queue.ts, relay-server.ts, relay-client.ts, relay-lifecycle.ts
Modified: types.ts (7 new interfaces), server.ts (relay integration + wire_discover), tsdown config (dual artifacts)
Build: wire-server.cjs (480KB) + wire-relay.cjs (14KB)

## What's Next (Phase 3.5c — Governance Integration)

Wire as a claude-governance module:
- Shim/launch auto-starts Wire MCP server with `--dangerously-load-development-channels`
- Verification entries for Wire health
- SessionStart/SessionStop hooks
- Configuration in `~/.claude-governance/`

### Build
- `pnpm build:wire` → produces `data/wire/wire-server.cjs` + `data/wire/wire-relay.cjs`
- `pnpm build` → full project build (typecheck + all artifacts)
- `tsc --noEmit` → typecheck (use this instead of `pnpm lint` — ESLint has a chalk crash)
