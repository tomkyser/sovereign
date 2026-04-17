# Phase 3 Handoff — Agent Dispatch Patterns

**Status:** COMPLETE

## What Was Built

- `P3-agent-dispatch/PATTERNS.md` — Reference documentation:
  - Research agent template (`agent()` with scoped questions)
  - Scoping rules (one concern per agent, read-only, structured return)
  - Anti-patterns (no open-ended exploration, no trivial lookups)
  - Integration with RALPH loop (L → dispatch → [U]→[F] → re-enter)

- REPL checkpoint prompt updated: L step now says "Use agent() with scoped questions"

## Key Observation

The Phase 2 interactive test showed the model naturally resolving unknowns by
reading files directly — it didn't need explicit agent() dispatch for a
single-domain investigation. Agent dispatch is for multi-domain or broad
investigations where a single REPL call would be unwieldy.

## For Phase 4

Phase 4 codifies the execution scaffold (preflight → read → transform → verify).
This is the pattern that ensures H items become actual check() calls in scripts.
