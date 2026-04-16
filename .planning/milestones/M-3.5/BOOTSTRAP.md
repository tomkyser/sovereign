# Milestone 3.5 Bootstrap — Wire Inter-Session Communication

---

**Status:** Phases 3.5a-c COMPLETE — Phase 3.5d PLANNING COMPLETE, ready for ACT
**Baseline:** 23/23 SOVEREIGN on CC 2.1.101
**Previous milestone:** M-3 (System Prompt Control) — COMPLETE

## Read These Files (In This Order)

1. `.planning/milestones/M-3.5/3.5d-message-components/PLANNING.md` — **Implementation approach per deliverable**
2. `.planning/milestones/M-3.5/3.5d-message-components/TASKS.md` — **23 tasks (T1-T23)**
3. `.planning/milestones/M-3.5/3.5d-message-components/RESEARCH.md` — Full research (binary offsets, source analysis)
4. `.planning/milestones/M-3.5/3.5d-message-components/CONTEXT.md` — Phase context
5. `.planning/milestones/M-3.5/CONTEXT.md` — Milestone-level shared state

## What Was Built So Far

### Phase 3.5a ✅ — Wire MCP Server
### Phase 3.5b ✅ — Session Registry & Cross-Session Routing
### Phase 3.5c ✅ — Governance Integration (23/23 SOVEREIGN)

## What's Next — Phase 3.5d ACT (Implementation)

Planning complete. 23 tasks across 4 priority tiers:

- **P0 (T1-T6):** Tool visibility — fix renderToolUseMessage default, capture React/Ink refs, per-tool renderers, empty-name suppression patch
- **P1 (T7-T11):** Thinking restoration — SystemTextMessage dispatch patch, auto-hide removal, full thinking by default
- **P2 (T12-T16):** Override system — globalThis registry, injection points in SystemTextMessage/AssistantToolUseMessage, attachment visibility
- **P3 (T17-T20):** User customization — component directory loading, defaults, hidden commands, docs
- **Verify (T21-T23):** Registry, SOVEREIGN check, TUI verification

### Implementation Strategy Summary
- P0 modifies existing tool-injection.ts + adds per-tool renderers (no new binary patches)
- P1 requires 3 new binary patches (thinking dispatch, auto-hide, full display)
- P2 requires 3 new binary patches (override registry + injection points)
- P3 is file-based (no binary patches)

### Key Source Files
- `claude-governance/src/patches/governance/tool-injection.ts` — P0 changes here
- `claude-governance/src/patches/governance/render-tree.ts` — Pattern for React component patching
- `claude-governance/src/tools/repl/index.ts` — REPL tool (add renderToolUseMessage)

### Build
- `pnpm build` → full project build
- `tsc --noEmit` → typecheck
