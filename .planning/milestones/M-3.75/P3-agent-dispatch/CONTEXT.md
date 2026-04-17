# Phase 3 Context — Agent Dispatch Patterns

## What This Phase Does

Codifies reusable patterns for spawning scoped research agents within REPL
to resolve Tier 3 unknowns. The interactive test in Phase 2 showed the model
naturally resolving unknowns by reading files directly. Phase 3 formalizes
this as agent() dispatch patterns for cases where unknowns require broader
investigation that exceeds what a single REPL call can accomplish.

## Key Observation from Phase 2

The model (in the interactive test) resolved unknowns by reading 7+ files
directly — it didn't use agent() calls. This is actually fine for most cases.
Agent dispatch is for situations where:
1. The investigation is too broad for one REPL call (many files, multiple concerns)
2. The unknown is in a different domain than the current work
3. Parallel investigation would be more efficient

## Artifacts

Phase 3 produces documentation and templates, not hooks. The templates
go into the RALPH prompt guidance or CLAUDE.md.
