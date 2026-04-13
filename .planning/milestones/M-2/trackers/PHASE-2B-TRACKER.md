# Phase 2b Tracker — Clean-Room REPL

**Status:** COMPLETE (with known gaps → Phase 2b-gaps)
**Started:** 2026-04-13
**Completed:** 2026-04-13

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Auto-Discovery Loader + Tool Deployment | COMPLETE |
| 2 | REPL Core — VM Engine + Tool Handlers | COMPLETE |
| 3 | Configuration — Modes + Loader Filtering | COMPLETE |
| 4 | Prompt — Tool Prompt + Replace Override | COMPLETE |
| 5 | Verification + Testing + Housekeeping | COMPLETE |

## Post-Testing Bugfixes

| Fix | Commit | Issue |
|-----|--------|-------|
| Replace mode stash | `0358f47` | Replace mode filtered tools REPL needs for delegation (F13) |
| Defensive result handling | `0358f47` | summarizeResult crash on undefined, Read notebook fallback |
| State persistence | `512cab7` | IIFE wrapping killed var persistence, added two-pass + state object (F15) |
| Realm-safe SyntaxError | `512cab7` | instanceof fails across VM realms, use name check (F14) |
| Return in sync scripts | `a6461d6` | IIFE fallback on any SyntaxError, not just await |

## Decisions

- **Option B (tool delegation) confirmed:** All 9 inner handlers delegate to CC's native tools via `context.options.tools`. No reimplementation of file I/O.
- **Auto-discovery loader:** Generic `index.js` scans tools dir for `.js` files. Future tools drop in.
- **Replace mode prompt override not possible:** "Using your tools" is runtime-generated (F12).
- **Grep/Glob route through Bash:** Not in tool registry when embedded tools active (F7).
- **Two-pass execution for persistence:** Sync first (var/globals persist), IIFE fallback for await/return.
- **Tool stashing in replace mode:** Filtered tools stashed on REPL object before removal from registry (F13).

## Test Results

### Automated (via `claude -p`)
| Test | Result |
|------|--------|
| Basic execution | PASS |
| File read delegation | PASS |
| Multi-op batch (read + bash) | PASS |
| Write + read round-trip | PASS |
| Edit + read verification | PASS |
| Grep through Bash | PASS |
| Glob handler | PASS |
| Console capture (stdout + stderr) | PASS |
| Error handling (thrown errors) | PASS |
| Timeout safety (120s) | PASS |
| Coexist mode (all tools visible) | PASS |
| Replace mode (primitives filtered) | PASS |
| Replace mode + stash delegation | PASS |
| Safe require rejection | PASS |
| Raw output format inspection | PASS |
| Fetch handler | PASS (returns AI-summary, not raw HTTP — F16) |
| Return in sync scripts | PASS |
| State object persistence | PASS |
| Tool deployment checks | PASS |

### User Interactive Testing (Tom)
| Test | Result |
|------|--------|
| var persistence across calls | PASS |
| state object persistence | PASS |
| Replace mode real usage | FAILED — didn't rebuild after TypeScript fix |

### Known Failures
| Test | Result | Gap |
|------|--------|-----|
| NotebookEdit arg mapping | FAIL — calls through but doesn't write source | G7 |
| Agent handler | UNTESTED | G8 |
| maxResultSize truncation | UNTESTED | G13 |
| AbortController cancellation | UNTESTED | — |

## Remaining Gaps → Phase 2b-gaps

14 gaps identified. See ROADMAP.md Phase 2b-gaps section for full details.
Priority: G1-G6 (functional verification) — violates halt-and-catch-fire principle.

## Files Changed

| File | Change |
|------|--------|
| `data/tools/index.js` | NEW: auto-discovery loader |
| `data/tools/ping.js` | NEW: Ping extracted from inline |
| `data/tools/repl.js` | NEW: REPL implementation (~20KB after fixes) |
| `src/patches/index.ts` | ADD: `deployTools()`, wired into apply flow |
| `src/patches/governance.ts` | ADD: `TOOL_REPLACE_FILTER_CODE` with stash pattern |
| `src/index.tsx` | ADD: Tool Deployment section in `handleCheck` |
| `package.json` | ADD: `data/tools/*.js` to files array |

## Commits

- `beff6a1` Phase 2b implementation (15 files, 952 insertions)
- `0358f47` Fix: Replace mode stash + defensive result handling
- `512cab7` Fix: State persistence + realm-safe SyntaxError + state object
- `a6461d6` Fix: return works in sync scripts
