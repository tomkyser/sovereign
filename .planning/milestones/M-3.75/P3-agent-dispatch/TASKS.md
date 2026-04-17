# Phase 3 Tasks — Agent Dispatch Patterns for Unknown Resolution

**Status:** COMPLETE

## Tasks

- [x] T1: Define research agent template for REPL
- [x] T2: Define agent scoping rules
- [x] T3: Integrate dispatch guidance into RALPH prompts
- [x] T4: Behavioral verification — test agent dispatch for Tier 3

## Task Details

### T1: Research agent template
Create a reusable pattern for spawning scoped research agents within REPL.
Key properties: read-only mandate, structured return, scoped questions.

### T2: Agent scoping rules
Document: one question per agent (preferred), explicit search scope,
structured return format, timeout awareness.

### T3: Integrate into RALPH prompts
Update the Layer 0 and REPL checkpoint prompts to reference agent dispatch
when Tier 3 unknowns exist. Currently the prompts say "resolve unknowns"
but don't give concrete instructions for HOW.

### T4: Behavioral verification
Test a Tier 3 prompt where the model dispatches research agents via agent()
to resolve unknowns before planning.
