# Phase 3prelim Tasks — Codebase Reorganization

## Task Breakdown

### T1: Cleanup orphaned files
- Delete `prompts/` at project root (9 files — `data/overrides/` is canonical)
- Delete `docs/` (empty directory)
- **Verify:** Layers 1, 2
- **Status:** COMPLETE — `a674460`

### T2: Split governance.ts into per-patch files
- Created `src/patches/governance/` directory (14 files)
- defaults.ts, types.ts, registry.ts + 11 per-patch files + barrel index.ts
- All existing import paths resolve unchanged (directory/index.ts)
- Live session test: Ping, REPL, Tungsten all functional in nested Claude
- **Verify:** Layers 1, 2, 3, 7 + live session
- **Status:** COMPLETE — `51a9c4a`

### T3: Split patches/index.ts into orchestration modules
- Created `src/patches/orchestration/` directory (3 files)
- `orchestration/index.ts`: PatchGroup, PATCH_DEFINITIONS, PatchId, PatchDefinition, PatchImplementation, PatchResult, applyPatchImplementations, getAllPatchDefinitions
- `orchestration/deploy.ts`: deployTools, deployUiComponents, deployPromptOverrides, TOOLS_DIR, UI_DIR
- `orchestration/validate.ts`: validateToolDeployment, runFunctionalProbe, runSingleProbe + types
- Top-level `index.ts` reduced from 955→~310 lines: applyCustomization + re-exports
- Fixed `import.meta.url` paths (bundle-relative, not source-relative) and type-only re-exports
- **Verify:** Layers 1, 2, 3, 4, 6, 7 (build, signatures, clean apply, probe, tool deploy, round-trip)
- **Status:** COMPLETE

### T4: Set up tool build pipeline
- Create `src/tools/` directory
- Configure tsdown (or esbuild fallback) to bundle each tool dir → single `.js` in `data/tools/`
- Verify index.js (auto-discovery loader) still works with built output
- **Verify:** Layers 1, 4, 6 (build, probe, tool deploy — actually require() the output)
- **Status:** TODO

### T5: Split Ping tool (pipeline validation)
- Create `src/tools/ping/index.ts`
- Build → `data/tools/ping.js`
- **Verify:** Layers 1, 2, 3, 4, 5, 6 (build, signatures, clean apply, probe, hooks, tool deploy)
- **Status:** TODO

### T6: Split REPL tool
- Create `src/tools/repl/` with: index.ts, prompt.ts, schema.ts, vm.ts, config.ts, format.ts
- Create `src/tools/repl/handlers/` with 9 handler files
- Build → `data/tools/repl.js`
- **Verify:** Layers 1, 2, 3, 4, 5, 6 (build, signatures, clean apply, probe, hooks, tool deploy)
- **Status:** TODO

### T7: Split Tungsten tool
- Create `src/tools/tungsten/` with: index.ts, prompt.ts, schema.ts, tmux.ts, state.ts, validate.ts
- Create `src/tools/tungsten/actions/` with 6 action files
- Build → `data/tools/tungsten.js`
- **Verify:** Layers 1, 2, 3, 4, 5, 6 (build, signatures, clean apply, probe, hooks, tool deploy)
- **Status:** TODO

### T8: Final verification — full system proof
- **ALL 7 layers, no exceptions:**
  1. Build: `pnpm build` — zero errors, size within 10% of 170KB
  2. Signatures: `check` — 20/20 SOVEREIGN, all categories, all tool shapes
  3. Clean apply: `--restore` → `--apply` → `check` — full round-trip
  4. Functional probe: `validateToolDeployment()` passes, Ping probe if available
  5. Hooks: all 6 hooks execute without error (4 SessionStart + 2 Stop)
  6. Tool deploy: `require()` loader returns 3 tools, each responds to full API surface
  7. Restore round-trip: restore → `claude --version` → re-apply → check → 20/20
- **Additionally:** Compare deployed tool files byte-for-byte behavior against pre-reorg
  baseline. Any behavioral difference is a failure, even if signatures pass.
- **Status:** TODO

## Dependencies

T1 → independent (do first)
T2 → independent of T3 (can parallel)
T3 → independent of T2 (can parallel)
T4 → blocks T5, T6, T7
T5 → validates T4 pipeline
T6 → after T5 (pipeline proven)
T7 → after T5 (pipeline proven), can parallel with T6
T8 → after all others
