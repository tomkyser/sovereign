# Milestone 3.5 Bootstrap — Post-P1.5, Ready for P2 Override System

---

**Status:** P1.5 COMPLETE — 29/29 SOVEREIGN. Binary runs interactively.
**Baseline:** 29/29 SOVEREIGN (from 16/29 at P1.5 start)
**Next Task:** T11 (thinking TUI verification) or P2 (Override System)

## CRITICAL: Read This First

1. `.planning/journals/session-2026-04-16-h.md` — **P1.5 completion journal**
2. `.planning/milestones/M-3.5/3.5d-message-components/TASKS.md` — **Current task list**
3. `.planning/STATE.md` — **Global project state (29/29 SOVEREIGN)**

## Current State

- **Binary**: Patched 2.1.101, runs cleanly (verified interactive TUI)
- **Backup**: Clean binary at `~/.claude-governance/native-binary.backup` (201MB)
- **Shim**: Active (`~/.claude-governance/bin/claude`) — governance on every launch
- **SOVEREIGN**: 29/29 — all governance patches, prompt overrides, and tool injection active
- **Code**: HEAD at 173d210, clean working tree, pushed
- **Build**: Clean at committed HEAD

## What Was Just Completed (P1.5)

13 governance patch regex patterns migrated from Bun-minified to esbuild CJS format.
Plus explore prompt override fixed (stale pieces + bundled data fallback).
Binary runs interactively with full TUI, governance status bar, 3 tools.

## Outstanding Items

### T11: Thinking TUI Verification (quick)

Thinking patches (dispatch, fullshow, guard) are applied and passing SOVEREIGN.
Need to manually verify thinking blocks appear in the live TUI during a conversation.
Launch an interactive session and trigger thinking (use a model that supports it).

### P2: Override System (T12-T16)

Design and implement `globalThis.__govMessageOverrides` registry for component
message overrides. This allows governance to control how messages are rendered
in the TUI without binary-patching each component individually.

Tasks:
- T12: Design and implement globalThis.__govMessageOverrides registry
- T13: Binary patch override check injection in SystemTextMessage
- T14: Binary patch override check in AssistantToolUseMessage
- T15: Implement null-rendered attachment visibility toggle
- T16: Add override system to verification registry

## Build & Verify

```bash
cd claude-governance && pnpm build
/bin/cp ~/.claude-governance/native-binary.backup ~/.local/share/claude/versions/2.1.101
node claude-governance/dist/index.mjs -a
~/.local/share/claude/versions/2.1.101 --version   # Must show "2.1.101 (Claude Code)"
node claude-governance/dist/index.mjs check         # Target: 29/29 SOVEREIGN
```

## Technical Reference

### esbuild Pipeline
- esbuild v0.28.0: `--bundle --format=cjs --platform=node`
- CJS wrapper: `(function(exports, require, module, __filename, __dirname) {...})`
- import_meta polyfill: `{ url: require("url").pathToFileURL(__filename).href }`
- moduleFormat: kept as original (2 = ESM) — CJS entry does not auto-execute in Bun
- encoding: 0 (source) — bytecode blob zeroed

### Pattern Matching Principles
- Use `\s*` between tokens (handles both minified and esbuild whitespace)
- Use `[$\w]+` for variable names (esbuild generates different identifiers)
- Match on string literals and API names (stable across builds)
- Extract React/Box/Text variable names from createElement context (not hardcoded)
- Complex interpolations (ternaries) stay as literal text in pieces, not split
