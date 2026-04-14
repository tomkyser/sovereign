# Phase 2b-gaps Tracker — REPL Hardening + Functional Verification

**Status:** COMPLETE
**Started:** 2026-04-13
**Completed:** 2026-04-13

## Gaps Closed

| # | Gap | Severity | Status | Commit |
|---|-----|----------|--------|--------|
| G1 | Runtime functional probe (apply/setup) | HIGH | COMPLETE | `858e7ae` |
| G2 | Module validation in check | HIGH | COMPLETE | `2f72a34` |
| G3 | Module validation in launch | HIGH | COMPLETE | `2f72a34` |
| G4 | Session-start hook tool awareness | HIGH | COMPLETE | (user-space) |
| G5 | Setup wizard tool verification | HIGH | COMPLETE | `858e7ae` |
| G6 | Statusline TOOLS segment | HIGH | COMPLETE | (user-space) |
| G7 | notebook_edit arg mapping | MEDIUM | COMPLETE | `59597fc` |
| G8 | Agent handler verification | MEDIUM | COMPLETE | `59597fc` |
| G9 | Fetch handler documentation | MEDIUM | COMPLETE | `59597fc` |
| G10 | Targeted IIFE fallback | MEDIUM | COMPLETE | `0903339` |
| G11 | Prompt accuracy audit | MEDIUM | COMPLETE | `0903339` |
| G12 | Config validation | LOW | COMPLETE | `c45d75a` |
| G13 | maxResultSize truncation | LOW | VERIFIED | `c45d75a` |
| G14 | Replace mode prompt noise | LOW | ASSESSED | `c45d75a` |

## Decisions

- **Functional probe uses `claude -p`** — real API call verifies end-to-end. Network/auth errors marked inconclusive, not failures.
- **Module validation via `createRequire`** — clears cache before each validation for fresh state.
- **Tools state in state.json** — `tools: { validated, names, count, probed, probeSuccess }` readable by hooks/statusline.
- **G10 pattern matching** — only `await` and `Illegal return` SyntaxErrors trigger IIFE wrap. All other syntax errors reported directly.
- **G7 arg normalization** — `source` → `new_source` accepted for compatibility. Missing `new_source` throws explicit error.
- **G14 no action** — model follows REPL prompt correctly when primitives filtered. Confirmed by prior testing.

## Files Changed

| File | Change |
|------|--------|
| `src/patches/index.ts` | ADD: `validateToolDeployment()`, `runFunctionalProbe()` |
| `src/verification.ts` | ADD: `tools` field on VerificationState, `probed`/`probeSuccess` |
| `src/index.tsx` | MOD: check uses validation, apply/launch include tool state + probe |
| `src/setup.ts` | ADD: functional probe after verify, `exit(1)` on failure |
| `data/tools/repl.js` | MOD: notebook_edit normalization, agent passthrough, IIFE targeting, config validation, prompt docs |
| `~/.claude/hooks/governance-verify.cjs` | MOD: tool names + probe status in SOVEREIGN banner |
| `~/.claude/hooks/statusline-combined.cjs` | ADD: TOOLS segment |

## Post-Testing Fixes (User Testing)

| Fix | Commit | Issue |
|-----|--------|-------|
| parentMessage.message.id | `612c0fd` | Write/Edit/Read crash — FilePersistence requires parentMessage with message.id field (F17) |
| IIFE script-source check | `8b521e9` | for-await gave "Unexpected reserved word" — error-message matching missed it, switched to script-source check |

## Remaining → Phase 2b-gaps-2

- **G15:** Embedded search dispatch — grep/glob use system binaries, not embedded ugrep/bfs
- **G9-test:** Fetch prompt effectiveness — interactive observation
- **G11-test:** Persistence prompt effectiveness — interactive observation

## Commits

- `2f72a34` G2+G3: Module validation in check and launch
- `858e7ae` G1+G5: Runtime functional probe in apply and setup
- `59597fc` G7+G8+G9: Handler correctness
- `0903339` G10+G11: Execution semantics
- `c45d75a` G12+G13+G14: Resilience
- `8b521e9` G10 fix: Script-source IIFE check
- `612c0fd` CRITICAL: parentMessage fix for Write/Edit/Read
- `ac8158d` F17 finding documented
