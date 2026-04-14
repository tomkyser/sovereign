# Phase 2b-gaps-2 Tracker — REPL Production Readiness

**Status:** COMPLETE
**Started:** 2026-04-13
**Completed:** 2026-04-13

## Gaps Closed

| # | Gap | Status | Method |
|---|-----|--------|--------|
| G15 | Embedded search tool dispatch | RESOLVED — already working | Empirical verification: `type find` = bfs shell function, `type grep` = ugrep shell function. Bash tool sources shell snapshot that shadows find/grep. |
| G9-test | Fetch prompt effectiveness | VERIFIED | Tested with httpbin.org: model correctly chose `bash('curl -s ...')` for raw HTTP, `fetch()` for summarized content. HTML page: fetch returned AI summary, curl returned raw HTML. |
| G11-test | Persistence prompt effectiveness | VERIFIED | Three-scenario test: `var` in sync script persists, `state.x` in async script persists, `const` in async script correctly lost (IIFE function scope). |

## Findings

- **F18:** Bash tool shell snapshot shadows find/grep with embedded bfs/ugrep. REPL's grep/glob were already using embedded tools via Bash tool delegation. G15 was a false alarm — the assumption was never verified before filing.
- **Glob `**` degradation** from benchmark was a usage issue: `glob('**/*.ts')` constructs `find -name "**/*.ts"` which isn't valid find/bfs. Correct pattern: `glob('*.ts', { cwd: 'dir' })`.

## Decisions

- No code changes needed for any of the three gaps.
- G15 resolved by empirical verification, not code fix.
- G9-test and G11-test verified via interactive observation using actual REPL tool.
