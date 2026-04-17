# Milestone 3.75 Impact — RALPH

## Scope

RALPH introduces **behavioral governance** — a new category alongside the existing
access/visibility governance (binary patches) and prompt governance (prompt overrides).
Where prior milestones ensure the user *can* do things (see thinking, use tools, control
the system prompt), RALPH ensures the model *reasons well* before doing them.

## Mechanism

Entirely hook-based. No binary patching. No prompt override files. Two hooks:

1. **UserPromptSubmit** — Layer 0 cognitive redirect. Fires on every user message.
   Injects HALT → END → HERE → DELTA scaffold before the model begins reasoning.
2. **PreToolUse (REPL)** — RALPH enforcement. Fires before REPL calls for Tier 2/3
   operations. Injects R → A → L → P → H checkpoint.

Both are `"type": "prompt"` hooks — they inject text into the conversation context,
not run shell commands. This is a fundamentally different mechanism from all existing
hooks in settings.json, which are `"type": "command"` hooks.

## Dependencies on Existing Infrastructure

| Dependency | Status | Risk |
|-----------|--------|------|
| CC hooks system (UserPromptSubmit) | Stable, already in use | Low |
| CC hooks system (PreToolUse) | Stable, already in use | Low |
| `"type": "prompt"` hook support | Documented in CC, untested by us | **Medium** |
| REPL tool availability | Guaranteed by governance patches | Low |
| Agent dispatch via agent() | Available in REPL, proven in M-3.5 | Low |
| settings.json hook registration | Well-understood, many existing hooks | Low |

**Key risk (RESOLVED):** `"type": "prompt"` hooks are only available for
PreToolUse/PostToolUse/PermissionRequest — NOT for UserPromptSubmit. Our approach
uses `"type": "command"` hooks that output JSON with `hookSpecificOutput.additionalContext`
to inject text into model context. This is proven by existing SessionStart hooks
(governance-verify, embedded-tools-verify) that already use this pattern.

Phase 2 (PreToolUse RALPH) also uses `"type": "command"` hooks. While PreToolUse
supports `"type": "prompt"` hooks, those send text to a separate Haiku model for
yes/no evaluation — not suitable for injecting reasoning scaffolds into the main model.

## Impact on Existing Systems

### settings.json
Two new hook entries added. Must compose with existing hooks:
- UserPromptSubmit: NEW event type (no existing hooks use this)
- PreToolUse (REPL): Adds alongside existing `repl-precheck.cjs` command hook

### claude-governance package
No changes to the package itself. RALPH hooks are standalone — they could ship as
separate files installed by `claude-governance setup` or as user-managed config.

**Decision needed:** Should RALPH hooks be managed by claude-governance (installed
during setup, version-tracked) or remain user-managed (manual settings.json edits)?

### Clawback hooks
RALPH's PreToolUse prompt hook must compose with Clawback's PreToolUse command hooks.
CC processes all hooks for a matcher — prompt and command hooks coexist.

## What This Does NOT Touch

- Binary patches (SOVEREIGN count unchanged, target remains 32/32)
- Prompt override files (prompts/ directory)
- Component overrides (data/components/, data/overrides/)
- Tool injection (embedded tools)
- Wire relay or message routing

## Success Criteria

| Metric | Target |
|--------|--------|
| Tier 1 overhead | <5s additional latency for trivial requests |
| Unknown detection | >90% of assumptions surfaced before execution |
| First-pass success | >85% execution without post-hoc fixes |
| Context efficiency | ≤50% tool calls vs. baseline |
| SOVEREIGN regression | 0 (32/32 maintained) |

## Artifacts Produced

| Artifact | Type | Location |
|----------|------|----------|
| Layer 0 prompt | Text (hook injection) | TBD — settings.json or managed file |
| RALPH checkpoint prompt | Text (hook injection) | TBD |
| Research agent template | JS pattern | Documented, not installed |
| Execution scaffold | JS pattern | Documented, not installed |
| Integration test cases | Manual test protocol | Phase 5 |
