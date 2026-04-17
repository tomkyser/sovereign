# Phase 1 Context — UserPromptSubmit Hook (Cognitive Redirect)

## What This Phase Does

Implements Layer 0 of the RALPH framework: a UserPromptSubmit prompt hook that
injects cognitive redirect scaffolding (HALT → END → HERE → DELTA) before the
model begins reasoning about a user message.

## Key Constraint

`"type": "prompt"` hooks are NOT available for UserPromptSubmit (only for
PreToolUse/PostToolUse/PermissionRequest). We use `"type": "command"` hooks that
output JSON with `hookSpecificOutput.additionalContext` to inject our RALPH prompt
into model context. This is proven: existing SessionStart hooks already use this pattern.

## Architecture Reference

See `.planning/research/2026-04-17-ralph-framework-design.md` — Layer 0 section.

## settings.json Hook Structure

Current UserPromptSubmit: NO existing hooks (this is a new event type for us).
Current PreToolUse: Multiple command hooks exist (gsd-prompt-guard, read-before-edit,
repl-precheck, etc.). Phase 2 will add a prompt hook here.

## Shared State

(none yet — will be populated during work)
