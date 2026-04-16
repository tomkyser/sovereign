# Milestone 3.5 Bootstrap — Wire Inter-Session Communication

---

**Status:** Phase 3.5a — Research + Planning COMPLETE, ready for **Act step**
**Baseline:** 22/22 SOVEREIGN on CC 2.1.101
**Previous milestone:** M-3 (System Prompt Control) — COMPLETE

## Read These Files (In This Order)

1. `.planning/VISION.md` — Ground yourself in the project intent
2. `.planning/STATE.md` — Current project state (M-3 complete, 22/22 SOVEREIGN)
3. `.planning/ROADMAP.md` — M-3.5 section has all 6 phases with task checklists
4. `.planning/milestones/M-3.5/3.5a-wire-mcp-server/CONTEXT.md` — **Active phase state**
5. `.planning/milestones/M-3.5/3.5a-wire-mcp-server/PLANNING.md` — Architecture, approach, risks
6. `.planning/milestones/M-3.5/3.5a-wire-mcp-server/TASKS.md` — 6 tasks (T1-T6), all pending
7. `.planning/milestones/M-3.5/3.5a-wire-mcp-server/RESEARCH.md` — 8 findings from binary + source analysis
8. `.planning/milestones/M-3.5/RESEARCH.md` — Milestone-level research (7 findings)
9. `.planning/REFERENCES.md` — [channelsRef1], [fakechat1], [dynamoWire] are the key references

## What M-3.5 Is

Wire adds inter-session communication to claude-governance. Multiple Claude Code sessions
can discover each other, send typed messages, and collaborate on tasks. Built on CC's
native Channels API — no binary patching needed for the transport itself.

**The critical insight:** The Channels API is bidirectional. An MCP server that declares
`claude/channel` capability handles both directions — notifications push messages into
sessions (inbound), exposed MCP tools let Claude send messages out (outbound). Anthropic's
fakechat plugin [fakechat1] is the canonical reference implementation.

**The critical constraint:** Building the communication layer is NOT enough. Claude Code
must be patched at every behavioral layer — hooks, tool prompts, system prompts, agent
prompts, MCP server instructions — so the LLM actually uses cross-session collaboration
when it's the right tool. Phase 3.5d is dedicated entirely to this.

## Phase Plan

| Phase | Name | Scope | Depends On | Status |
|-------|------|-------|------------|--------|
| **3.5a** | Wire MCP Server | Channel contract, bidirectional messaging, plugin packaging | — | **Act next** |
| **3.5b** | Session Registry | Registry, discovery, routing, TTL buffering, priority queue | 3.5a | Not started |
| **3.5c** | Governance Integration | Module, shim/launch, verification, hooks, config | 3.5a, 3.5b | Not started |
| **3.5d** | Behavioral Integration | Prompts, instructions, coordinator mode, model guidance | 3.5c | Not started |
| **3.5e** | /coordinate Skill | User-facing skill, Tungsten orchestration, end-to-end workflow | 3.5d | Not started |
| **3.5f** | Hardening | Error handling, reconnection, version resilience, docs, gaps | 3.5e | Not started |

## Phase 3.5a — Where We Are

### Research Complete (8 findings)
- **F1**: Channel notification schema: `{ method: "notifications/claude/channel", params: { content: string, meta?: Record<string, string> } }`
- **F2**: Meta key regex: `/^[a-zA-Z_][a-zA-Z0-9_]*$/` — underscores only, no hyphens
- **F3**: Message wrapping: `<channel source="NAME" key="val">CONTENT</channel>` via A4_()
- **F4**: Prompt injection: `vD({mode:"prompt", priority:"next", isMeta:true, origin:{kind:"channel"}})`
- **F5**: Gate bypass: `--channels wire` + `--dangerously-load-development-channels`
- **F6**: fakechat reference: 268 lines TS, canonical channel plugin pattern
- **F7**: dynamo Wire: 2526 lines across 10 files, selectively port protocol.cjs for 3.5a
- **F8**: Server packaging: standalone CJS, registered in .mcp.json/settings.json

### Planning Complete (6 tasks)
- **T1**: Protocol Module — types.ts, protocol.ts (message types, envelopes, validation)
- **T2**: MCP Server Core — server.ts (MCP SDK, claude/channel capability, stdio transport)
- **T3**: Wire Tools — wire_send, wire_status (tool handlers inside server)
- **T4**: Build Pipeline — tsdown config, bundle MCP SDK into standalone CJS
- **T5**: Registration Config — .mcp.json entry, shim launch flag additions
- **T6**: End-to-End Verification — launch CC with Wire, test channel delivery

### Key Decisions
- **D-01**: TypeScript + CJS via tsdown (same as REPL/Tungsten/Ping)
- **D-02**: Port protocol.cjs envelopes, simplified message types
- **D-03**: Standalone CJS entry point (MCP server, not CC tool)
- **D-04**: No relay in 3.5a — direct notification only
- **D-05**: Minimum tools: wire_send, wire_status
- **D-06**: Instructions pattern adapted from fakechat

### Architecture
```
claude-governance/
  src/wire/
    protocol.ts        — Typed envelopes, message types, urgency, validation
    server.ts          — MCP Server (main entry, stdio transport, tool handlers)
    types.ts           — TypeScript type definitions
  data/wire/
    wire-server.cjs    — Built standalone CJS artifact
```

## Interstitial Work (This Session)

Between 3.5a research and act, enhanced REPL and CLAUDE.md:
- **REPL `allowAllModules`**: New config toggle (`repl.allowAllModules: true`) unlocks
  all Node.js built-in modules in REPL VM. `require('fs')`, `require('child_process')`,
  etc. all work. Safety gate preserved (default false). Config, VM, and prompt all updated.
- **`process` in VM sandbox**: Added to sandbox globals so `process.env`, `process.cwd()`,
  `process.platform` are available in REPL scripts.
- **Tungsten guidance in CLAUDE.md**: Added comprehensive block covering persistent shell,
  agent inheritance, full session spawning, and proactive-use directive.
- All built, applied, verified 22/22 SOVEREIGN, tested via Tungsten child session.

## Starting the Act Step

1. Read PLANNING.md and TASKS.md
2. Start with T1 (Protocol Module) — port from dynamo protocol.cjs
3. Then T2 (MCP Server Core) — follow fakechat pattern
4. Then T3 (Wire Tools) — inside server.ts
5. Then T4 (Build Pipeline) — tsdown config for standalone CJS
6. Then T5 (Registration) — .mcp.json + shim flag additions
7. Finally T6 (End-to-End) — launch CC with `--dangerously-load-development-channels`

## Key Technical Context

### Channels API Gate (z4_ / gateChannelServer)
Six layers, all currently passable:
1. Server declares `experimental["claude/channel"]` — we control this
2. `tengu_harbor` feature flag — currently True in cachedGrowthBookFeatures
3. OAuth authentication — requires `/login` (API key users blocked)
4. Team/Enterprise policy — N/A for individual users
5. `--channels` session flag — our shim passes this
6. Allowlist — bypassed by `--dangerously-load-development-channels`

### Dynamo Wire Source (port material)
Location: `/Users/tom.kyser/Library/Mobile Documents/com~apple~CloudDocs/dev/dynamo/core/services/wire/`
- `protocol.cjs` (128 lines) — Port this for T1
- `channel-server.cjs` (367 lines) — Reference for T2, but use fakechat pattern instead

### Risk: GrowthBook Sync
`tengu_harbor: True` is from Anthropic's server. If they disable it, Channels stops.
Our PATCH 12 protects `clientDataCache` but NOT `cachedGrowthBookFeatures`. May need
a future patch if Anthropic reverts. Monitor during M-3.5 execution.
