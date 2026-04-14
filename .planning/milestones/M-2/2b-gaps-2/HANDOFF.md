# Phase 2b-gaps-2 Handoff — REPL Production Readiness

Written: 2026-04-13
Status: COMPLETE (3/3 gaps resolved)

## What Was Done

Closed all 3 gaps remaining from Phase 2b-gaps testing. No code changes were needed — all gaps resolved through empirical verification and interactive testing.

### G15: Embedded Search Tool Dispatch (RESOLVED — Already Working)

The original assessment was that REPL's `grep()` and `glob()` used system `/usr/bin/grep` and `/usr/bin/find` instead of embedded ugrep 7.5 and bfs 4.1. **This was wrong.**

CC's Bash tool sources a "shell snapshot" before every command execution. When `EMBEDDED_SEARCH_TOOLS=1`, the snapshot contains shell functions:
- `find` → `ARGV0=bfs "$_cc_bin" -regextype findutils-default "$@"`
- `grep` → `ARGV0=ugrep "$_cc_bin" -G --ignore-files --hidden -I --exclude-dir=.git... "$@"`

Since REPL's `grep()` and `glob()` delegate to the Bash tool via `tool.call()`, the shell functions shadow the commands. Verified empirically:
- `type find` = shell function from snapshot
- `type grep` = shell function from snapshot
- `grep --version` = ugrep 7.5.0
- `find --version` = bfs 4.1

The `**` glob degradation from the benchmark was a usage issue — `glob('**/*.ts')` generates `find -name "**/*.ts"` which isn't valid find/bfs syntax. The correct pattern is `glob('*.ts', { cwd: 'dir' })`.

See F18 in FINDINGS.md.

### G9-test: Fetch Prompt Effectiveness (VERIFIED)

Tested with httpbin.org endpoints:
- **JSON endpoint:** Model correctly chose `bash('curl -s ...')` for raw JSON retrieval instead of `fetch()`
- **HTML endpoint:** `fetch()` returned AI summary ("This passage from Herman Melville's Moby-Dick..."), `curl` returned raw HTML (`<!DOCTYPE html>...`)
- The prompt clearly documents that `fetch()` returns "AI-summarized response (NOT raw HTTP)" and recommends `bash('curl -s ...')` for raw data

### G11-test: Persistence Prompt Effectiveness (VERIFIED)

Three-scenario test demonstrating correct model understanding:
1. `var syncVar = 'value'` in sync script → persists across calls (PASS)
2. `state.asyncValue = 'value'` in async script (with `await`) → persists across calls (PASS)
3. `const localVar = 'value'` in async script → correctly undefined in next call (PASS — IIFE wrapping creates function scope)

Model correctly used `var` for sync persistence, `state.x` for async persistence, and understood `const`/`let` loss in IIFE-wrapped scripts.

## REPL Production Readiness — Final Status

With Phase 2b-gaps-2 complete, the REPL tool is production-ready:

| Aspect | Status |
|--------|--------|
| Handlers | 7/7 functional (grep/glob confirmed embedded, `**` is usage, not a bug) |
| Verification | 15/15 SOVEREIGN, tools validated + probed |
| Embedded search | Confirmed ugrep 7.5.0 + bfs 4.1 via shell snapshot |
| Prompt effectiveness | fetch() and persistence semantics verified |
| Config validation | Mode, timeout, maxResultSize validated with user warnings |
| Error handling | IIFE targeting, parentMessage contract (F17), abort support |

## What's Next

**Phase 2c: Clean-Room Tungsten** — tmux session management tool. Spec at `.planning/specs/tungsten-clean-room.md` (v0.2). Uses same auto-discovery loader and tool injection mechanism. Must follow the verification pattern from 2b-gaps.
