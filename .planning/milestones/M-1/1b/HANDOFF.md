# Phase 1b Handoff — Wrapper Layer

Written: 2026-04-12
Status: COMPLETE

## What Was Done

### `launch` Subcommand
Added `claude-governance launch [-- ...args]` — a wrapper that does pre-flight governance verification then spawns the real CC binary.

**Pre-flight flow:**
1. Detect CC via `startupCheck` (reuses existing detection)
2. Read `state.json` from config dir
3. Compare `ccVersion` — if mismatch or missing, auto-reapply
4. If state is SOVEREIGN and version matches → fast path (skip apply)
5. If apply fails → warn, still launch (governance is enhancement, not gate)
6. Build environment: `process.env` + `config.json` `settings.governance.env` overrides
7. Spawn CC with `stdio: 'inherit'`

**Process control:**
- Signal forwarding: SIGINT, SIGTERM, SIGHUP relayed to child
- Exit code propagation: child's exit code becomes wrapper's exit code
- Error handling: spawn failure produces clear error message

**Options:**
- `--no-verify` — skip pre-flight, launch immediately
- `--force-apply` — reapply even if state is current

### state.json Enhancement
- Added `ccVersion` field (threaded through both `check` and `apply` callers)
- Added `readVerificationState()` function for reading cached state
- Added `VerificationState` interface

### Environment Variable Injection
- Reads `settings.governance.env` from config.json
- Merges into process environment before spawning CC
- Non-fatal if config section missing

## Files Changed

| File | Change |
|------|--------|
| `src/index.tsx` | Added `launch` subcommand, `handleLaunch()`, `handleApplyForLaunch()`, `readVerificationState()`, `VerificationState` interface. Updated `writeVerificationState` with ccVersion param. |

## Test Results

| Test | Result |
|------|--------|
| `launch -- --version` | Pre-flight applied (first run), then launched CC: `2.1.101 (Claude Code)` |
| `launch -- --version` (repeat) | Fast path: cached SOVEREIGN, no apply, launched immediately |
| `launch --no-verify -- --version` | Skipped verification, launched directly |
| `check` after launch | 13/13 SOVEREIGN, state.json has ccVersion |
| Build size | 132KB |

## What's Next

**Phase 1c: Verification Engine (1b-informed)**
Now that the wrapper exists, verification can be informed by the launch process:
- Pre-flight verification API (programmatic, not just CLI)
- Hooks-based verification (SessionStart hook calling check)
- Status line integration
- Survives resumes, compacts, logins, subagent spawning

## Key Design Decisions

1. **`launch` is a subcommand, not the default:** Avoids breaking change. Users can alias `claude` to `claude-governance launch` if they want the wrapper model.
2. **Governance is non-blocking:** If apply fails, CC still launches. This is a user sovereignty tool — we don't block the user from their own software.
3. **Version detection via state.json:** No extra `claude --version` invocation. The ccVersion field in state.json is compared to startupCheck's detected version.
