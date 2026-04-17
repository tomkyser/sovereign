# Phase 1 Tasks — UserPromptSubmit Hook (Cognitive Redirect)

**Status:** COMPLETE

## Tasks

- [x] T1: Validate prompt hook mechanism — confirm `"type": "prompt"` hooks work in UserPromptSubmit
- [x] T2: Write Layer 0 prompt text — HALT → END → HERE → DELTA scaffold with Tier 1 fast path
- [x] T3: Register hook in settings.json — UserPromptSubmit prompt hook entry
- [x] T4: Behavioral verification — test all three tiers with real prompts in TUI
- [x] T5: Iterate prompt based on behavioral observations — refine wording, adjust fast path

## Task Details

### T1: Validate prompt hook mechanism
**Risk:** Medium — we've never used `"type": "prompt"` hooks.
- Create a minimal prompt hook in UserPromptSubmit
- Verify the injected text appears in model context
- Verify it composes with existing command hooks
- If prompt hooks don't work as expected, research alternatives

### T2: Write Layer 0 prompt text
- HALT: Suppress forward-chaining impulse
- END: Concrete, verifiable end state
- HERE: KNOWN/ASSUMED/UNKNOWN separation
- DELTA: Gap items marked [F]/[A]/[U]
- CLASSIFY: Tier routing logic
- Tier 1 fast path: ≤3 sentences for trivial requests
- Target: ~200 tokens total injection

### T3: Register hook in settings.json
- Add UserPromptSubmit hook entry with `"type": "prompt"`
- Prompt text either inline or loaded from file
- Must not conflict with existing hooks
- Consider: inline vs. file-based prompt storage

### T4: Behavioral verification
Test cases:
- "What branch am I on?" → Tier 1, minimal overhead
- "Read this file" → Tier 1, direct action
- "Add a new field to this config" → Tier 2, RALPH once
- "Fix the display" (ambiguous) → Tier 3, unknowns surfaced
- Follow-up in ongoing task → appropriate depth reduction

### T5: Iterate prompt
- Observe actual model behavior with the hook active
- Identify: over-classification, cargo-cult filling, excessive overhead
- Adjust wording, add/remove constraints
- Re-test after each iteration
