# Phase 2 Tracker — PreToolUse Hook (RALPH Enforcement for REPL)

**Status:** COMPLETE
**Milestone:** M-3.75 RALPH
**Phase:** P2 — REPL RALPH Enforcement

## Decisions

1. **Command hook, not prompt hook** — `"type": "prompt"` hooks send text to a
   separate Haiku model for yes/no evaluation. Not suitable for reasoning scaffolds.
   Same approach as Phase 1: `"type": "command"` with `additionalContext`.

2. **Smart bash detection** — Read-only bash commands (cat, ls, git log, grep) don't
   trigger RALPH. Mutating commands (npm build, rm, etc.) do.

3. **Simple heuristic, model decides** — Hook checks for write operations in the
   script. If none found, skip RALPH. If found, inject checkpoint. The model
   decides whether to perform full RALPH or treat it as routine.

## Status

| Task | Status | Notes |
|------|--------|-------|
| T1: Research prompt hook | ✅ Complete | Haiku-based evaluation, not suitable |
| T2: Write checkpoint | ✅ Complete | 10-line scaffold with Tier bypass |
| T3: Register hook | ✅ Complete | PreToolUse REPL matcher |
| T4: Behavioral verification | ✅ Complete | Interactive TUI verified |
| T5: Iterate | ✅ Complete | Bash read-only detection added |
