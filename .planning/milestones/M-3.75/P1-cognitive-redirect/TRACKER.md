# Phase 1 Tracker — UserPromptSubmit Hook (Cognitive Redirect)

**Status:** COMPLETE
**Milestone:** M-3.75 RALPH
**Phase:** P1 — Cognitive Redirect

## Decisions

1. **Command hook, not prompt hook** — `"type": "prompt"` is only available for
   PreToolUse/PostToolUse/PermissionRequest. UserPromptSubmit uses `"type": "command"`
   with `hookSpecificOutput.additionalContext` for text injection.

2. **Model classifies, not hook** — The hook doesn't try to detect trivial queries
   lexically (too error-prone for ambiguous short prompts like "fix the display").
   Instead, the prompt includes Tier 1 fast-path instructions and the model decides.

3. **Confirmations skip entirely** — "yes", "do it", "push", slash commands produce
   no hook output at all. Zero overhead for workflow confirmations.

## Blockers

(none — all resolved)

## Status

| Task | Status | Notes |
|------|--------|-------|
| T1: Validate prompt hook | ✅ Complete | "type": "prompt" not available for UPS |
| T2: Write Layer 0 prompt | ✅ Complete | 808 chars (~160 tokens) |
| T3: Register hook | ✅ Complete | settings.json updated |
| T4: Behavioral verification | ✅ Complete | 4 test cases, all correct |
| T5: Iterate prompt | ✅ Complete | Removed lexical detection, trimmed prompt |
