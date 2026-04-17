# Phase 2 Context — PreToolUse Hook (RALPH Enforcement for REPL)

## What This Phase Does

Adds a PreToolUse prompt hook that fires before REPL tool calls, enforcing RALPH
completion for Tier 2/3 operations before the script executes.

## Key Finding: Same Mechanism as Phase 1

`"type": "prompt"` hooks send text to a **separate small model (Haiku)** for yes/no
evaluation — they're designed for permission decisions, not reasoning scaffolds.
Phase 2 uses `"type": "command"` hooks with `additionalContext` output, same as
Phase 1. The additionalContext gets injected into the main model's conversation.

The hook script reads the REPL tool input from stdin and outputs JSON with the
RALPH checkpoint prompt as additionalContext.

## Existing PreToolUse Hooks (must compose)

- `gsd-prompt-guard.js` — Write|Edit matcher
- `gsd-read-guard.js` — Write|Edit matcher
- `gsd-workflow-guard.js` — Write|Edit matcher
- `gsd-validate-commit.sh` — Bash matcher
- `protect-files.cjs` — Edit|Write matcher
- `read-before-edit.cjs` — Edit|Write matcher
- `commit-validate.cjs` — Bash matcher
- `repl-precheck.cjs` — REPL matcher (our neighbor)
- `team-agent-blocker.js` — Agent matcher

Only `repl-precheck.cjs` shares the REPL matcher. It's a command hook that
validates REPL inputs. Our prompt hook should coexist without conflict.
