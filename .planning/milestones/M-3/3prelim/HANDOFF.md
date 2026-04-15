# Phase 3prelim Handoff — Codebase Reorganization

**Status:** COMPLETE
**Commits:** `a674460` through `d8c1591` (8 commits, 8 tasks)
**Baseline:** 20/20 SOVEREIGN on CC 2.1.101
**Final state:** 20/20 SOVEREIGN, 170.46KB main build + 51.46KB tools build

## What Was Delivered

Full codebase reorganization — no new functionality, pure structural improvement.

### Source Changes

1. **Orphaned files cleaned** — deleted root `prompts/` (9 stale duplicates of `data/overrides/`) and empty `docs/`
2. **governance.ts split** — 1184-line monolith → `src/patches/governance/` (14 files: 11 per-patch + types + defaults + registry + barrel)
3. **index.ts split** — 955-line monolith → `src/patches/orchestration/` (3 modules: index, deploy, validate) + thin barrel (~310 lines)
4. **Tool build pipeline** — `tsdown.tools.config.ts` (CJS output, per-tool builds, no shared chunks), `build:tools` integrated into `pnpm build`
5. **Ping tool** — hand-written JS → `src/tools/ping/index.ts` (24 lines, trivial)
6. **REPL tool** — 919-line JS → `src/tools/repl/` (16 files: 6 core + 9 handlers + barrel)
7. **Tungsten tool** — 565-line JS → `src/tools/tungsten/` (12 files: 6 core + 6 actions)

### Infrastructure Added

- `data/tools/package.json` — `{"type":"commonjs"}` for `require()` compatibility in ESM project
- `tsdown.tools.config.ts` — `defineConfig([...])` array pattern, each tool built separately
- `.cjs→.js` rename step in build:tools (package.json `"type":"module"` forces .cjs)

## Key Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Directory/index.ts barrel pattern | TypeScript resolves `import from './governance'` to `./governance/index.ts` — zero consumer changes |
| D3 | PatchGroup enum in orchestration, not barrel | Breaks circular import (barrel imports orchestration, orchestration defines enum) |
| D4 | `import.meta.url` paths: single `..` | Bundle is flat (`dist/index.mjs`) regardless of source depth — data dirs are `../data/` from dist |
| D5 | deployUiComponents in orchestration/deploy.ts | Same deployment pattern as deployTools/deployPromptOverrides, belongs together |
| D6 | CJS build: tsdown + rename + commonjs package.json | Three-part solution for CJS tools in ESM project |
| D7 | defineConfig array (per-tool builds) | Multi-entry config creates shared chunks → breaks standalone requirement |

## Gotchas for Future Work

1. **Tool build paths**: `import.meta.url` in built tools resolves to `dist/index.mjs`, not the source location. Data directories are always `../data/` from dist, not from source.
2. **CJS in ESM project**: Tools must be CJS (`module.exports`) for the auto-discovery loader. The rename step + `data/tools/package.json` handle this, but any new tool dir needs to follow the same pattern.
3. **No shared chunks**: `defineConfig([...])` array is required. Single config with multiple entries creates rolldown helper chunks that break the loader.
4. **REPL state architecture**: Module-level state centralized in `vm.ts` with getter/setter functions. `getOrCreateVM(handlers)` takes handlers as param to break the circular dependency (handlers → vm → handlers).
5. **Build size**: Tools are NOT minified (readable for debugging). Main CLI IS minified. Build sizes: Ping 0.70KB, REPL 33.49KB, Tungsten 17.27KB.

## Verification

T8 passed all 7 layers:
1. Build: 170.46KB (0.02% of baseline), zero errors/warnings
2. Signatures: SOVEREIGN 20/20, all 4 categories
3. Clean apply: restore → apply → 20/20
4. Functional probes: Ping + REPL both functional
5. Hooks: SessionStart + Stop hooks confirmed
6. Tool deploy: 3 tools, all 5 methods valid
7. Restore round-trip: restore → claude --version → apply → 20/20

Live `claude -p` probes: Ping (injection marker), REPL (42*42=1764, glob handler delegation), Tungsten (create + send + capture).

## What's Next

Phase 3a (or GP3 research first, per M-2 retro recommendation): Full system prompt extraction with version tracking. The codebase is now organized for it — governance patches have clean per-file homes, orchestration is modular, tools build from TypeScript.
