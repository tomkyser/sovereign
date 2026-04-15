# Phase 3prelim Context — Codebase Reorganization

**Status:** COMPLETE — all 8 tasks done, SOVEREIGN 20/20, all 7 verification layers passed.

## What This Phase Does

Restructures the codebase for maintainability. No new functionality — code moves to
where it belongs, tools gain type safety, duplication is eliminated.

## Key Constraint

**Deploy format is fixed.** Tools deploy as single `.js` files via auto-discovery loader.
The restructuring happens in TypeScript source; a build step produces the deploy artifacts.

## Target

- `governance.ts` (1184 lines) → 11 per-patch files + registry index
- `patches/index.ts` (955 lines) → 3 orchestration modules + thin barrel
- `repl.js` (919 lines) → TypeScript source with handlers/, prompt, schema, vm, config
- `tungsten.js` (565 lines) → TypeScript source with actions/, prompt, schema, tmux, state
- Orphaned `prompts/` and empty `docs/` deleted

## Verification Protocol

Every task must pass a multi-layer verification protocol — signatures prove presence,
but every layer must be proven functional. See PLANNING.md for the full 7-layer
protocol. Summary:

1. **Build Integrity** — zero errors, size within baseline
2. **Signature Verification** — 20/20 SOVEREIGN, all categories, tool shapes
3. **Clean Apply** — restore → apply → check round-trip
4. **Functional Probe** — validateToolDeployment(), Ping probe if available
5. **Hook Integrity** — all 6 hooks execute without error
6. **Tool Deployment Validation** — require() loader, all 3 tools respond to full API
7. **Restore Round-Trip** — restore → claude --version → re-apply → check

Tasks specify which layers apply. T8 (final) requires all 7. Any layer failure = task
not complete. Ignorance of degradation is worse than degradation itself.
