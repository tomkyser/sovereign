# Phase 3prelim Tracker — Codebase Reorganization

**Status:** IN PROGRESS — T1, T2 complete. T3 next.
**Baseline:** 20/20 SOVEREIGN on CC 2.1.101
**Build:** 170.49KB (unchanged from baseline)

## Decisions

- **D1:** governance.ts split to governance/ directory with barrel index.ts. All existing import paths resolve unchanged (TypeScript resolves directory/index.ts). Zero import changes needed across the codebase.
- **D2:** Shared infrastructure (Detection types, runDetectors, GOVERNANCE_DEFAULTS) extracted to types.ts and defaults.ts. Registry in registry.ts. 11 patch functions each in their own file.
- **D3:** PatchGroup enum moved from index.ts to orchestration/index.ts to break circular import. Re-exported via barrel.
- **D4:** `import.meta.url` paths in deploy.ts use single `..` (bundle-relative) not double `..` (source-relative). The bundle is flat regardless of source tree depth.
- **D5:** `deployUiComponents` included in orchestration/deploy.ts alongside `deployTools` and `deployPromptOverrides` — same deployment pattern, belongs together.
- **D6:** Tool build uses tsdown CJS format with `.cjs→.js` rename post-step. `"type":"module"` in package.json forces `.cjs` extension for CJS output; `data/tools/package.json` with `{"type":"commonjs"}` overrides this for `require()` compatibility.
- **D7:** Multi-entry tsdown config creates shared chunks (rolldown `__toESM` helper) — breaks standalone tool requirement. Fix: `defineConfig([...])` array builds each tool in its own pass. No shared chunks possible.

## Progress

| Task | Status | Commit | Verification |
|------|--------|--------|-------------|
| T1: Cleanup | COMPLETE | `a674460` | L1 (170KB), L2 (20/20) |
| T2: Split governance.ts | COMPLETE | `51a9c4a` | L1, L2, L3, L7 + live session test (Ping/REPL/Tungsten all functional) |
| T3: Split index.ts | COMPLETE | — | L1 (170.46KB), L2 (20/20), L3, L4 (Ping+REPL), L6 (3 tools), L7 + live claude -p probes |
| T4: Tool build pipeline | COMPLETE | — | L1 (170.46KB + 0.70KB tools), L4 (live claude -p Ping), L6 (3 tools, all shapes valid) |
| T5: Split Ping | COMPLETE | (T4) | L1-L6 all pass — pipeline validated |
| T6: Split REPL | COMPLETE | — | L1-L6, live probes (42*42 + glob handler), restore round-trip |
| T7: Split Tungsten | COMPLETE | — | L1-L6, live probe (create+send+capture), restore round-trip |
| T8: Final verification | COMPLETE | — | All 7 layers: L1 (170.46KB), L2 (20/20 full breakdown), L3 (restore+apply), L4 (Ping+REPL+Tungsten live), L5 (hooks), L6 (3 tools), L7 (round-trip) |

## Blockers

*None identified.*

## Notes

- T4 (tool build pipeline) is the highest-risk remaining task. If tsdown can't produce the right output format for tools, fall back to esbuild.
- index.js (auto-discovery loader) is hand-maintained, not generated.
- Live session test confirmed: nested Claude session shows SOVEREIGN 20/20, all 3 tools functional, statusline segments present, hooks firing.
