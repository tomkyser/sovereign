# Milestone 3.5 Bootstrap — Wire Inter-Session Communication

---

**Status:** Phases 3.5a-c COMPLETE — Phase 3.5d next (Message Components Control)
**Baseline:** 23/23 SOVEREIGN on CC 2.1.101
**Previous milestone:** M-3 (System Prompt Control) — COMPLETE

## Read These Files (In This Order)

1. `.planning/milestones/M-3.5/3.5c-governance-integration/HANDOFF.md` — **What 3.5c delivered**
2. `.planning/milestones/M-3.5/CONTEXT.md` — Milestone-level shared state
3. `.planning/ROADMAP.md` — Phase 3.5d scope (Message Components Control)
4. `.planning/STATE.md` — Global project state
5. CC source reference: `/Users/tom.kyser/dev/cc-source/collection-claude-code-source-code/claude-code-source-code/src/components/messages/`

## What Was Built So Far

### Phase 3.5a ✅ — Wire MCP Server
Single-session Wire MCP server with channel capability. `wire_send`, `wire_status`, `wire_discover` tools.

### Phase 3.5b ✅ — Session Registry & Cross-Session Routing
HTTP relay, session registry, priority queue, relay lifecycle. Full cross-session message delivery.

### Phase 3.5c ✅ — Governance Integration
Wire module rewrite: hook deployment, settings.json registration, 4-point health check.
PATCH 13: Channel dialog bypass for OAuth users.
Verified: 23/23 SOVEREIGN, interactive launch clean, Wire channel active.

## What's Next (Phase 3.5d — Message Components Control)

**This phase is a new direction** — not originally scoped in M-3.5 but blocks remaining Wire phases.

User-revised scope from ROADMAP:
- Research + Planning first (full phase lifecycle)
- **Blocking issue:** REPL tool use not appearing in TUI (previously worked, now gone)
- Complete message component override and patching capability
- Must survive across CC versions — matching strategy must be extremely resilient
- Start with restoring thinking blocks in UI (SystemTextMessage.tsx ~line 122)
- Users must be able to edit message components independently
- Governance provides defaults, users customize

### Key References
- CC source: `/Users/tom.kyser/dev/cc-source/.../src/components/messages/`
- `SystemTextMessage.tsx` line ~122 for thinking blocks
- Existing binary patching patterns in `src/patches/governance/` (render-tree.ts is closest analog)

### Build
- `pnpm build` → full project build (typecheck + all artifacts)
- `tsc --noEmit` → typecheck (use this instead of `pnpm lint` — ESLint has a chalk crash)
