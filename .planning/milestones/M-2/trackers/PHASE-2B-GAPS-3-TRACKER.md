# Phase 2b-gaps-3 Tracker — REPL Coexist Hardening

**Status:** COMPLETE
**Started:** 2026-04-13
**Completed:** 2026-04-13
**Scope:** G16-G23 — Glob defaults, model behavior, hooks module, benchmark doc

## Gaps

| ID | Description | Priority | Status |
|----|-------------|----------|--------|
| G16 | Glob ignores .gitignore (--no-ignore default) | HIGH | DONE — removed --no-ignore and --hidden from defaults |
| G17 | Glob missing exclusion configurability | MEDIUM | DONE — added noIgnore, hidden, ignore[] parameters |
| G18 | Model falls back to bare tools on REPL error | MEDIUM | DONE — added Error Recovery section to REPL prompt |
| G19 | Unexplained Ping calls in fresh sessions | LOW | DONE — Ping prompt changed to discourage general use |
| G20 | File size limit cascading failures | MEDIUM | DONE — added defensive batch pattern + error recovery guidance |
| G21 | Hooks module for setup/launch | MEDIUM | DESIGNED — implementation pinned pre-M7 |
| G22 | Duplicate hooks (GSD + standalone) migration | LOW | DESIGNED — covered by G21 migration note |
| G23 | REPL-BENCHMARK-RESULTS.md outdated | LOW | DONE — full rewrite, false claims removed |

## Decisions

### G16/G17: Glob defaults align with scripting expectations, not CC native

CC's native GlobTool uses `--no-ignore --hidden` by default (glob.ts lines 98-99) because
it serves the permission system which needs to see all files. Our REPL glob serves the
model writing scripts, where the developer expectation is: `glob('**/*.ts')` returns
source files, not 10K node_modules entries. So we differ intentionally:
- REPL default: respect .gitignore, skip hidden files
- CC native default: ignore .gitignore, include hidden files
- Opt-in via `{ noIgnore: true, hidden: true }` to get CC-native behavior

### G21 Design: Hooks Governance Module

**Module ID:** `hooks`
**Default:** enabled
**Source:** `data/hooks/*.cjs` (4 files)
**Deploy target:** `~/.claude/hooks/` (symlink or copy)

**apply():**
1. Read `data/hooks/` directory for `.cjs` files
2. For each file, copy to `~/.claude/hooks/` (overwrite if different)
3. Read `~/.claude/settings.json`, ensure each hook is registered under correct event/matcher:
   - `PreToolUse:Edit|Write` → `read-before-edit.cjs`
   - `PreToolUse:Bash` → `commit-validate.cjs`
   - `PreToolUse:REPL` → `repl-precheck.cjs`
   - `PostToolUse:REPL` → `repl-safety.cjs` (timeout: 30)
4. Write updated settings.json if changed

**getStatus():**
1. Check each hook file exists at `~/.claude/hooks/`
2. Check each hook registered in settings.json
3. Return healthy if all 4 present and registered

**verificationEntries:**
- `hooks-deployed`: signature = check all 4 files exist in `~/.claude/hooks/`
- `hooks-registered`: signature = check settings.json has all 4 entries

**Migration note (G22):** Module should detect GSD duplicate hooks (`gsd-read-guard.js`, `gsd-validate-commit.sh`) and optionally remove them from settings.json, presenting user with choice.

**Implementation:** Pinned for pre-M7. Module file: `src/modules/hooks.ts`.

## Issues Found

- REPL VM caches loaded functions within a session. Changes to repl.js only take effect in a fresh session. This is by design (persistent VM context) but means testing glob fixes requires a new session.
- CC's native GlobTool uses --no-ignore --hidden by default. Our design choice to differ is intentional and documented.
