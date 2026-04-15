# Phase 3prelim Tracker — Codebase Reorganization

**Status:** PLANNING
**Baseline:** 20/20 SOVEREIGN on CC 2.1.101
**Build:** 170KB

## Decisions

*None yet — phase in planning.*

## Blockers

*None identified.*

## Notes

- <=5 files per sub-phase. T2 and T3 may each require 2 batches.
- T4 (build pipeline) is the highest-risk task. If tsdown can't produce the right
  output format, fall back to esbuild.
- index.js (auto-discovery loader) is hand-maintained, not generated.
