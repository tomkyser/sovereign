# Phase 2 Tasks — PreToolUse Hook (RALPH Enforcement for REPL)

**Status:** COMPLETE

## Tasks

- [x] T1: Research "type": "prompt" hook behavior for PreToolUse
- [x] T2: Write RALPH checkpoint prompt (R → A → L → P → H)
- [x] T3: Register PreToolUse prompt hook in settings.json
- [x] T4: Behavioral verification — Tier 2/3 REPL calls show RALPH, Tier 1 unaffected
- [x] T5: Iterate based on observations

## Task Details

### T1: Research "type": "prompt" hook for PreToolUse
Binary confirmed PreToolUse supports prompt hooks. Research:
- How does the prompt hook text interact with the model's next response?
- Does it block the tool call or inject advisory text?
- How does it compose with existing PreToolUse command hooks (repl-precheck)?

### T2: Write RALPH checkpoint prompt
- R: Reasoned intent from facts
- A: Backward chain from END to first action
- L: Remaining unknowns (if any → STOP, resolve first)
- P: Script structure (preflight → read → transform → verify)
- H: Surviving assumptions → preflight checks
- Tier 1 bypass: skip RALPH for simple reads/queries

### T3: Register hook
- PreToolUse prompt hook, matcher: "REPL"
- Must compose with existing repl-precheck.cjs command hook
- Prompt hooks and command hooks should coexist per binary analysis

### T4: Behavioral verification
- Tier 1 REPL call (simple read): no RALPH overhead
- Tier 2 REPL call (multi-file edit): RALPH once visible
- Tier 3 REPL call (unknowns): L non-empty, model dispatches research
- Verify H items appear as check() calls in scripts

### T5: Iterate
- Observe model behavior, adjust prompt
- Key risk: cargo-cult RALPH (model fills template without thinking)
