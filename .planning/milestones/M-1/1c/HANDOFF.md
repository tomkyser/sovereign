# Phase 1c Handoff — Verification Engine (1b-informed)

Written: 2026-04-12
Status: COMPLETE

## What Was Done

### Verification API Module (`src/verification.ts`)
Extracted all verification logic from index.tsx into an importable module:
- `CheckResult` interface
- `VerificationState` interface
- `matchEntry()` — string/RegExp pattern matching
- `runVerification(js)` — iterates VERIFICATION_REGISTRY, returns CheckResult[]
- `readVerificationState()` — reads state.json from CONFIG_DIR
- `writeVerificationState()` — writes state.json with timestamp, version, checks, status
- `deriveStatus(results)` — derives SOVEREIGN/DEGRADED/PARTIAL from results

index.tsx now imports all verification logic from this module. Inline status derivation in handleCheck, handleApplyMode, and handleApplyForLaunch replaced with `deriveStatus()`.

### SessionStart Hook Rewrite (`governance-verify.cjs`)
Complete rewrite of the broken hook:
- **Config dir resolution** mirrors config.ts: env override → `~/.claude-governance/` → `~/.tweakcc/` → XDG
- **New state.json fields**: reads `status`, `passCount`, `totalCount`, `ccVersion` (not old `allPass`/`criticalFail`)
- **ISO timestamp handling**: parses ISO strings (not epoch ms)
- **Version-change detection**: compares state.json `ccVersion` vs installed binary version. On mismatch, triggers live re-check.
- **Stale detection**: 4-hour max age, triggers live `claude-governance check` fallback
- **Live fallback**: shells out to `dist/index.mjs check`, then re-reads state.json
- **Banner**: SOVEREIGN (cyan bg), DEGRADED (red, lists failures), PARTIAL (cyan, shows counts)
- **Claude warning**: writes to stdout on non-SOVEREIGN so Claude sees it

### Status Line Integration (`statusline-combined.cjs` + `governance-statusline.cjs`)
Fixed both status line hooks:
- Config dir resolution using same 4-step fallback
- GOV segment reads `status` field (not `allPass`/`criticalFail`)
- ISO timestamp parsing for staleness check
- EMB segment path also uses config dir resolution (was hardcoded to wrong path)

## Files Changed

| File | Change |
|------|--------|
| `src/verification.ts` | NEW — extracted verification API module |
| `src/index.tsx` | Import from verification.ts, use deriveStatus(), remove ~120 lines of inlined verification code |
| `~/.claude/hooks/governance-verify.cjs` | REWRITE — correct paths, format, version detection, live fallback |
| `~/.claude/hooks/statusline-combined.cjs` | FIX — config dir resolution, new state.json fields, ISO timestamps |
| `~/.claude/hooks/governance-statusline.cjs` | FIX — same as statusline-combined GOV segment |

## Test Results

| Test | Result |
|------|--------|
| `pnpm build` | 131KB, clean typecheck |
| `check` | 13/13 SOVEREIGN |
| `state.json` fields | status=SOVEREIGN, ccVersion=2.1.101, passCount=13, totalCount=13, ISO timestamp |
| `governance-verify.cjs` | SOVEREIGN banner, v2.1.101, 13/13 verified |
| `statusline-combined.cjs` | `GOV` cyan bold (SOVEREIGN) |
| `governance-statusline.cjs` | `[GOV]` cyan bold (SOVEREIGN) |

## What's Next

**Phase 1d: Modular Architecture**
- Plugin/module system — users opt into what they want
- Core module: patching engine + wrapper (required)
- Pluggable verification registry: modules declare their own verification contracts
- Optional Clawback install, essential env flags

## Key Design Decisions

1. **Hooks still needed despite wrapper pre-flight:** The `launch` wrapper verifies on initial spawn. But hooks fire on every SessionStart including resumes and new sessions. Both mechanisms serve different scenarios — wrapper for controlled launches, hooks for all sessions.
2. **Live fallback, not live-only:** Hook reads state.json first (fast path), only shells out to `check` on stale/missing/version-mismatch. This keeps session start fast for the common case.
3. **Config dir resolution mirrored, not shared:** Hooks are standalone CJS, can't import from the ESM build. The resolution logic is duplicated but simple (4 lines) and mirrors config.ts exactly.
