# Phase 3prelim Tracker — Codebase Reorganization

**Status:** IN PROGRESS — T1, T2 complete. T3 next.
**Baseline:** 20/20 SOVEREIGN on CC 2.1.101
**Build:** 170.49KB (unchanged from baseline)

## Decisions

- **D1:** governance.ts split to governance/ directory with barrel index.ts. All existing import paths resolve unchanged (TypeScript resolves directory/index.ts). Zero import changes needed across the codebase.
- **D2:** Shared infrastructure (Detection types, runDetectors, GOVERNANCE_DEFAULTS) extracted to types.ts and defaults.ts. Registry in registry.ts. 11 patch functions each in their own file.

## Progress

| Task | Status | Commit | Verification |
|------|--------|--------|-------------|
| T1: Cleanup | COMPLETE | `a674460` | L1 (170KB), L2 (20/20) |
| T2: Split governance.ts | COMPLETE | `51a9c4a` | L1, L2, L3, L7 + live session test (Ping/REPL/Tungsten all functional) |
| T3: Split index.ts | NEXT | — | — |
| T4-T8 | PENDING | — | — |

## Blockers

*None identified.*

## Notes

- T4 (tool build pipeline) is the highest-risk remaining task. If tsdown can't produce the right output format for tools, fall back to esbuild.
- index.js (auto-discovery loader) is hand-maintained, not generated.
- Live session test confirmed: nested Claude session shows SOVEREIGN 20/20, all 3 tools functional, statusline segments present, hooks firing.
