# Phase 1 Handoff — UserPromptSubmit Hook (Cognitive Redirect)

**Status:** COMPLETE

## What Was Built

- `~/.claude/hooks/ralph-layer0.cjs` — UserPromptSubmit command hook
  - Reads user prompt from stdin JSON
  - Outputs `hookSpecificOutput.additionalContext` with RALPH scaffold
  - Confirmations ("yes", "do it") and slash commands skip entirely
  - All other prompts get the 808-char scaffold; model decides tier

- `settings.json` — UserPromptSubmit hook entry added
  - `"type": "command"`, 5s timeout

## Key Findings

1. `"type": "prompt"` hooks only work for PreToolUse/PostToolUse/PermissionRequest.
   Phase 2 (PreToolUse RALPH) can use prompt hooks. Phase 1 cannot.

2. The model reliably follows the HALT/END/HERE/DELTA scaffold for complex tasks
   and correctly fast-paths trivial queries without ceremony.

3. `additionalContext` injection works via `hook_additional_context` message type,
   which is injected into the conversation alongside the user's prompt.

## Behavioral Verification Results

| Test | Classification | Behavior |
|------|---------------|----------|
| "what branch am I on" | Tier 1 | Direct answer, no scaffold output |
| "what does SOVEREIGN do" | Tier 1 | Direct informational answer |
| "implement disable option" | Tier 3 | Full HALT/END/HERE/DELTA with [F]/[A]/[U] markers |
| "yes" | Skipped | No hook output at all |
| "/commit" | Skipped | No hook output at all |

## For Phase 2

Phase 2 adds a PreToolUse hook for REPL calls. Key differences:
- CAN use `"type": "prompt"` hooks (PreToolUse supports them)
- Need to detect Tier 2/3 context (the model should have already classified)
- RALPH checkpoint: R → A → L → P → H before REPL execution
