# Phase 2 Handoff — PreToolUse Hook (RALPH Enforcement for REPL)

**Status:** COMPLETE

## What Was Built

- `~/.claude/hooks/ralph-repl-checkpoint.cjs` — PreToolUse command hook for REPL
  - Reads REPL tool input from stdin JSON
  - Detects write operations (edit, write, agent, mutating bash)
  - Read-only REPL calls (read, grep, glob, cat, git log) skip RALPH
  - Outputs `additionalContext` with R-A-L-P-H checkpoint for write operations

- `settings.json` — PreToolUse hook entry added (REPL matcher)

## Key Findings

1. `"type": "prompt"` hooks send text to a **separate Haiku model** for evaluation.
   They're designed for yes/no permission decisions, not reasoning scaffolds.
   All RALPH hooks use `"type": "command"` with `additionalContext`.

2. The REPL checkpoint fires on the session's own REPL calls (self-referential).
   This is correct behavior — it enforces RALPH on all REPL usage.

3. Bash command analysis distinguishes read-only (cat, ls, git log) from
   mutating (npm build, rm) — prevents false positives on diagnostic scripts.

## Interactive TUI Verification Results

### Trivial query ("what branch am I on")
- Thinking showed: "Tier 1: act directly"
- Response: "You're on master."
- No RALPH ceremony. Fast path confirmed.

### Complex task ("implement a new config option to disable patches")
- Thinking showed: HALT → END → HERE (KNOWN/ASSUMED/UNKNOWN) → Tier 3 classification
- Model resolved unknowns by reading 7+ files
- Produced concrete 4-file plan
- Asked before proceeding — did NOT start coding prematurely

## For Phase 3

Phase 3 defines agent dispatch patterns for unknown resolution. The interactive test
already showed natural agent-like behavior (reading files to resolve unknowns).
Phase 3 codifies this as reusable templates.
