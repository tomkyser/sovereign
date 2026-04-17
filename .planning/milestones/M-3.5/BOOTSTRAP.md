# Milestone 3.5 Bootstrap — Post-P2, Ready for P3 User Customization

---

**Status:** P2 COMPLETE + Phase Steps 4-6 done — 29/29 SOVEREIGN. Binary runs interactively.
**Baseline:** 29/29 SOVEREIGN
**Next Task:** P3 (T17-T20: User Customization)

## CRITICAL: Read This First

1. `.planning/journals/session-2026-04-16-i.md` — **P2 completion journal**
2. `.planning/milestones/M-3.5/3.5d-message-components/TASKS.md` — **Current task list**
3. `.planning/STATE.md` — **Global project state (29/29 SOVEREIGN)**

## Current State

- **Binary**: Patched 2.1.101, runs cleanly (verified interactive TUI)
- **Backup**: Clean binary at `~/.claude-governance/native-binary.backup` (201MB)
- **Shim**: Active (`~/.claude-governance/bin/claude`) — governance on every launch
- **SOVEREIGN**: 29/29 — all governance patches, prompt overrides, tool injection active
- **Override system**: `globalThis.__govMessageOverrides` + `__govContentOverrides` active
- **Code**: HEAD at 966fa32, clean working tree, pushed
- **Build**: Clean at committed HEAD

## What Was Just Completed (P2)

Message override system: two binary patches inject override checks at the top of
oOY() (message renderer) and sOY() (content block renderer) before their switch
statements. Override handlers registered on globalThis are called first; null return
falls through to default rendering. Deploy pipeline copies defaults.js to runtime dir.

### Architecture

```
Binary: oOY(q) — switch(_.type) → case "system" | "assistant" | "user" | "attachment" | ...
                ↑ injected before switch: check globalThis.__govMessageOverrides[_.type]

Binary: sOY(q) — switch(_.type) → case "tool_use" | "text" | "thinking" | ...
                ↑ injected before switch: check globalThis.__govContentOverrides[_.type]

Runtime: ~/.claude-governance/overrides/defaults.js → loaded lazily on first render
```

## P3: User Customization (T17-T20)

Now that the override system exists, implement the user-facing customization layer:

- **T17**: Implement `~/.claude-governance/components/` directory loading
  - Scan directory for .js files, each exports override handlers
  - Register discovered handlers on globalThis.__govMessageOverrides
- **T18**: Governance default component overrides in data/components/
  - Ship default attachment visibility overrides
  - Use React refs from binary scope (J9, u, V pattern)
- **T19**: Unhide hidden commands patch
  - Find command registry in binary, remove visibility filters
- **T20**: Documentation for component override API
  - Document handler signature: (message, props, React) → element | null

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
- moduleFormat: kept as original (2 = ESM)

### Pattern Matching Principles
- Use `\s*` between tokens (handles both minified and esbuild whitespace)
- Use `[$\w]+` for variable names (esbuild generates different identifiers)
- Match on string literals and API names (stable across builds)
- Extract React/Box/Text variable names from createElement context (not hardcoded)
- oOY anchor: `_6(94)` + `message: _` + `switch (_.type)`
- sOY anchor: `_6(48)` + `param: _` + `switch (_.type)`
