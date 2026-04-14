# Phase 2b-gaps-3 Handoff — REPL Coexist Hardening

Written: 2026-04-13
Status: COMPLETE (8/8 gaps resolved — 6 implemented, 2 designed)

## What Was Done

### G16: Glob respects .gitignore by default (HIGH)
Removed `--no-ignore` and `--hidden` from glob's default rg flags. Without these flags, rg naturally respects `.gitignore` and skips hidden files — the sane default for a scripting context. The old defaults caused `glob('**/*.ts')` to return 10,388 files (including all of `node_modules/.pnpm/`) instead of 46 source files.

This is an **intentional deviation** from CC's native GlobTool, which uses `--no-ignore --hidden` by default because it serves the permission system. Our glob serves the model writing scripts, where the expectation matches developer tooling behavior.

### G17: Glob exclusion configurability (MEDIUM)
Added three new parameters to glob opts:
- `{ noIgnore: true }` — opt into including .gitignore'd files (CC-native behavior)
- `{ hidden: true }` — opt into including hidden files (dotfiles)
- `{ ignore: ['*.min.js', 'dist/**'] }` — custom exclusion patterns via `--glob '!pattern'`

Prompt updated to document all new options.

### G18: Model fallback prevention (MEDIUM)
Added "Error Recovery" section to REPL prompt. Teaches the model to fix scripts and retry within REPL rather than falling back to individual Read/Write/Edit calls. Covers common error patterns: file not found, large file truncation, permission denied, syntax errors.

### G19: Unexplained Ping calls (LOW)
Root cause: Ping's prompt said "Use this tool to verify that custom tools are working" — the model interpreted this literally and called Ping as a probe when confused after REPL errors.

Fix: Changed Ping's prompt to "Internal governance verification tool. Used automatically during setup and apply — not intended for use during normal sessions. If you need to test something, use REPL instead." Ping must remain deployed (used by functional probe in apply/setup via `claude -p`) but shouldn't invite general use.

### G20: File size cascading failures (MEDIUM)
Added defensive batch read pattern to REPL prompt examples — demonstrates try/catch within loops to gracefully handle individual file failures without crashing the entire batch. Combined with G18's error recovery guidance, this teaches the model to handle failures within REPL rather than bailing out.

### G21: Hooks module design (MEDIUM — DESIGNED ONLY)
Full design documented in tracker. Module ID `hooks`, deploys 4 `.cjs` files from `data/hooks/` to `~/.claude/hooks/`, registers in `settings.json`, verifies in check/launch. Implementation pinned for pre-M7.

### G22: Duplicate hooks migration (LOW — DESIGNED ONLY)
Covered by G21 design: the hooks module will detect GSD duplicates (`gsd-read-guard.js`, `gsd-validate-commit.sh`) and offer to remove them during `apply()`.

### G23: Benchmark doc rewrite (LOW)
Full rewrite of `REPL-BENCHMARK-RESULTS.md`. Removed false claims:
- ~~"system-level implementations"~~ → CC native tools via delegation (always was)
- ~~"glob ** recursive FAIL"~~ → working via rg --files --glob
- ~~"Wraps system grep"~~ → ugrep 7.5.0 via shell snapshot
- ~~"F7: Optimized tool versions not yet integrated"~~ → same implementation, different ergonomics

## Verification

- Build: 160KB (159.94KB)
- Check: 17/17 SOVEREIGN
- glob default: 46 files (was 10,388 with --no-ignore --hidden)
- glob custom ignore: exclusion patterns working (7 test files correctly excluded)
- Tools deployed to `~/.claude-governance/tools/`

## What's Next

**Phase 2c: Clean-Room Tungsten** — tmux session management tool. Spec at `.planning/specs/tungsten-clean-room.md` (v0.2). Uses same auto-discovery loader and tool injection mechanism. Must follow the verification pattern from 2b-gaps.

## Key Gotcha

The REPL VM caches loaded functions within a session. Changes to `repl.js` only take effect in a fresh CC session (the VM context persists). This is by design but means testing requires session restarts.
