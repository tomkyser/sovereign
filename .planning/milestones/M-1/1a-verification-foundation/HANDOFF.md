# Phase 1a-verification-foundation Handoff

Written: 2026-04-12
Status: COMPLETE — 13/13 SOVEREIGN

## What Was Done

### Verification Registry
Added `VERIFICATION_REGISTRY` to `governance.ts` — a structured array of 13 verification entries, each declaring:
- `signature` (string or RegExp) — text that MUST be present in extracted JS
- `antiSignature` (string or RegExp) — text that MUST be absent
- `critical` flag — affects SOVEREIGN vs PARTIAL vs DEGRADED status
- `category` — governance | gate | prompt-override

### Registry Entries (13 total)

**Governance Patches (4, critical):**
- Disclaimer Neutralization — sig: replacement text, antiSig: "may or may not be relevant"
- Context Header Reframing — sig: replacement text, antiSig: "use the following context"
- System-Reminder Authority Fix — sig: replacement text, antiSig: "bear no direct relation"
- Subagent CLAUDE.md Restoration — sig: regex for flag=false, antiSig: regex for flag=true

**Gate Resolution (1, optional):**
- Embedded Tools Gate Resolution — antiSig: "USE_EMBEDDED_TOOLS_FN" (absence = pass)

**Prompt Overrides (8, optional):**
- Explore: "do not sacrifice completeness for speed"
- General Purpose: "careful senior developer would do"
- Agent Thread Notes: "when they provide useful context"
- No Unnecessary Additions: "adjacent code is broken, fragile, or directly contributes"
- No Premature Abstractions: "duplication causes real maintenance risk"
- Proportional Error Handling: "at real boundaries where failures can realistically occur"
- Executing Actions: "clearly the right thing to do"
- Tone & Style: "appropriately detailed for the complexity"

### handleCheck Refactored
- Replaced ~80 lines of hardcoded checks with `runVerification()` function
- Registry iteration with `matchEntry()` helper (handles string and RegExp)
- Category-grouped display: Governance Patches → Gate Resolution → Prompt Overrides
- Shared by both `check` CLI command and post-apply verification

### State Output (state.json)
- Written to `CONFIG_DIR/state.json` by both `check` and `apply` flows
- Contains: timestamp, governanceVersion, binaryPath, status, per-check results, counts
- `writeVerificationState()` creates config dir if needed

## Key Design Decisions

1. **Prompt overrides use signature-only (no anti-signature):** The pieces replacement system replaces text at template USE sites in the binary, but original Anthropic text persists as dead-code variable constants (e.g., `d77="...gold-plate..."`). Anti-signatures would produce false negatives. Governance patches use direct string replacement which fully removes originals — anti-signatures are reliable there.

2. **Gate uses anti-signature only:** No specific replacement text to check for. The verification is purely "are there zero remaining `USE_EMBEDDED_TOOLS_FN` references?"

3. **Build size:** 129KB (up from 126KB — registry adds ~3KB)

## Files Changed

| File | Change |
|------|--------|
| `src/patches/governance.ts` | Added `VerificationEntry`, `VERIFICATION_REGISTRY` (13 entries) |
| `src/patches/index.ts` | Added `VERIFICATION_REGISTRY`, `VerificationEntry` to imports |
| `src/index.tsx` | Added `runVerification()`, `matchEntry()`, `writeVerificationState()`. Refactored `handleCheck` to use registry. Added post-apply verification + state.json. |

## What's Next

**Phase 1b: Wrapper Layer** — ClawGod-style wrapper that becomes the entry point, spawns real CC binary. Pre-flight governance verification before CC launch, process-level control, env var injection, version-change detection.

## What NOT To Do

- Do NOT add anti-signatures to prompt override entries — dead-code constants cause false negatives
- Do NOT use `strings` on binary for verification — always extract JS first
- Do NOT assume `CONFIG_DIR` is `~/.claude-governance/` — it falls back to `~/.tweakcc/` if the new dir doesn't exist yet
