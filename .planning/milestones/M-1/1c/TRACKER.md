# Phase 1c Tracker — Verification Engine (1b-informed)

Status: COMPLETE
Started: 2026-04-12

## Scope

Extract verification API into importable module, fix broken hooks to use new state.json format and correct config paths, restore status line integration.

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Extract `src/verification.ts` module (CheckResult, VerificationState, runVerification, read/writeState) | Complete |
| 2 | Rewrite `governance-verify.cjs` — correct paths, new state.json format, version-change detection | Complete |
| 3 | Fix `statusline-combined.cjs` GOV segment — correct paths, new state.json format | Complete |
| 4 | Build, verify end-to-end (check → state.json → hook reads → statusline reads) | Complete |
| 5 | Phase docs (handoff, roadmap, state, context, bootstrap updates) | Complete |

## Key Findings

- Existing hooks read from `~/.claudemd-governance/` (wrong path — old name)
- Hooks check `allPass`/`criticalFail` fields that don't exist in new state.json
- New state.json uses `status: 'SOVEREIGN'|'DEGRADED'|'PARTIAL'`, `passCount`/`totalCount`, ISO timestamps
- `governance-statusline.cjs` is standalone but redundant — GOV segment is inline in `statusline-combined.cjs`

## Files Touched

| File | Change |
|------|--------|
| `src/verification.ts` | NEW — extracted verification API |
| `src/index.tsx` | Import from verification.ts instead of inline |
| `~/.claude/hooks/governance-verify.cjs` | Rewrite — correct paths + format |
| `~/.claude/hooks/statusline-combined.cjs` | Fix GOV segment reader |
