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
- Created `src/tools/` directory with Ping as pipeline proof-of-concept
- `tsdown.tools.config.ts`: CJS format, `data/tools/` output, `clean:false`, node builtins external
- `build:tools` script: tsdown + .cjs→.js rename (needed because `"type":"module"` forces .cjs extension)
- `data/tools/package.json`: `{"type":"commonjs"}` — overrides parent ESM type for require() compatibility
- Integrated into main `pnpm build` (runs after main build)
- `import.meta.url` insight: bundle is flat → data dir paths use single `..` from dist/ regardless of source depth
- Loader discovers all 3 tools (Ping built from TS + REPL/Tungsten hand-written)
- **Verify:** Layers 1, 4, 6 (build, probe, tool deploy — actually require() the output)
- **Status:** COMPLETE

### T5: Split Ping tool (pipeline validation)
- Source created in T4 as pipeline proof-of-concept (`src/tools/ping/index.ts`)
- Build → `data/tools/ping.js` via `pnpm build:tools`
- Full 6-layer verification: build (170.46KB), signatures (20/20), clean apply, probes (live claude -p), hooks (SessionStart confirmed), tool deploy (3 tools, all VALID)
- **Verify:** Layers 1, 2, 3, 4, 5, 6 (build, signatures, clean apply, probe, hooks, tool deploy)
- **Status:** COMPLETE (covered by T4 + verification pass)

### T6: Split REPL tool
- Created `src/tools/repl/` with 6 modules: index.ts, prompt.ts, schema.ts, vm.ts, config.ts, format.ts
- Created `src/tools/repl/handlers/` with 9 handler files + barrel (read, write, edit, bash, grep, glob, notebook_edit, fetch, agent)
- State centralized in vm.ts with getter/setter functions to avoid circular dependencies
- getOrCreateVM takes handlers param to break handler→vm→handler cycle
- Build → `data/tools/repl.js` (33.49KB from TypeScript, vs 37.2KB hand-written original)
- Live probes: REPL 42*42=1764, glob handler found 16 files in src/tools/repl/
- **Verify:** Layers 1, 2, 3, 4, 5, 6 (build, signatures, clean apply, probe, hooks, tool deploy)
- **Status:** COMPLETE

### T7: Split Tungsten tool
- Created `src/tools/tungsten/` with 6 modules: index.ts, prompt.ts, schema.ts, tmux.ts, state.ts, validate.ts
- Created `src/tools/tungsten/actions/` with 6 action files (create, send, capture, list, kill, interrupt)
- Fixed code splitting: separate builds per tool (defineConfig array) prevents shared chunks
- Build → `data/tools/tungsten.js` (17.27KB from TypeScript, vs 18.8KB hand-written original)
- Live probe: Tungsten create + send 'echo T7-TUNGSTEN-VERIFIED' — output captured correctly
- **Verify:** Layers 1, 2, 3, 4, 5, 6 (build, signatures, clean apply, probe, hooks, tool deploy)
- **Status:** COMPLETE

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
- **Status:** COMPLETE

## Dependencies

T1 → independent (do first)
T2 → independent of T3 (can parallel)
T3 → independent of T2 (can parallel)
T4 → blocks T5, T6, T7
T5 → validates T4 pipeline
T6 → after T5 (pipeline proven)
T7 → after T5 (pipeline proven), can parallel with T6
T8 → after all others
