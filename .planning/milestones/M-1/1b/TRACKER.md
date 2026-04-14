# Phase 1b Tracker — Wrapper Layer

**Status:** COMPLETE
**Started:** 2026-04-12
**Completed:** 2026-04-12
**Scope:** Wrapper that becomes entry point, spawns CC with governance pre-flight

## Work Items

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Add ccVersion to state.json | Done | Threaded through both check + apply callers |
| 2 | Add `launch` subcommand | Done | Pre-flight + spawn CC |
| 3 | Pre-flight verification logic | Done | Read state.json, version compare, auto-reapply |
| 4 | Process spawning with signal forwarding | Done | stdio: inherit, SIGINT/SIGTERM/SIGHUP relay |
| 5 | Environment variable injection | Done | From config.json settings.governance.env |
| 6 | Version-change detection | Done | State ccVersion vs detected version |
| 7 | Build + verify | Done | 132KB, launch tested with --version + fast path |

## Design

**Command:** `claude-governance launch [-- ...args]`
- Default action stays `apply` (no breaking change)
- `launch` is the wrapper entry point

**Pre-flight flow:**
1. Detect CC binary (reuse startupCheck)
2. Read state.json → compare ccVersion vs detected version
3. If match + SOVEREIGN → fast path (skip apply)
4. If mismatch → auto-apply, write new state.json
5. If apply fails → warn, still launch (governance is enhancement, not gate)
6. Build env: process.env + config.json.governance.env overrides
7. Spawn CC with inherited stdio + signal forwarding

**Signal handling:** Forward SIGINT/SIGTERM/SIGHUP to child. Exit with child's code.

## Decisions

1. **`launch` as subcommand, not default:** Avoids breaking change. Default stays `apply`. Users opt into wrapper via `claude-governance launch`.
2. **Governance is enhancement, not gate:** If apply fails during pre-flight, warn and still launch CC. Users shouldn't be blocked from their tool.
3. **Env vars from config.json:** Read from `settings.governance.env` section. Merged into process.env before spawn. Non-fatal if config missing.

## Issues

None.
