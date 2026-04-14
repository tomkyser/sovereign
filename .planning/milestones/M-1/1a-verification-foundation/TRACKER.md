# Phase 1a-verification-foundation Tracker

**Status:** COMPLETE
**Started:** 2026-04-12
**Completed:** 2026-04-12
**Scope:** Standalone verification improvements — no dependency on 1b wrapper

## Work Items

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Signature + anti-signature registry in governance.ts | Done | VERIFICATION_REGISTRY with 13 entries |
| 2 | Refactor handleCheck to iterate registry | Done | Category-grouped display |
| 3 | Full prompt override verification (all 8) | Done | Per-override unique signatures |
| 4 | Apply state output (state.json) | Done | Written by both check and apply flows |
| 5 | Build + verify SOVEREIGN | Done | 13/13 SOVEREIGN, 129KB build |

## Decisions

1. **Prompt override anti-signatures omitted:** The pieces replacement system replaces text at template USE sites, but original constants persist as dead code in the binary (e.g., `d77="...gold-plate..."` remains even after the template is overridden). Anti-signatures would produce false negatives. Signature-only verification is reliable for prompt overrides.

2. **Governance patch anti-signatures kept:** Direct string replacement fully removes originals — anti-signatures are reliable for the 4 governance patches.

3. **Gate verification uses anti-signature only:** `USE_EMBEDDED_TOOLS_FN` absence is the check — no replacement signature needed.

4. **Registry categories:** governance (4, critical), gate (1, optional), prompt-override (8, optional). Total: 13 checks.

## Issues

None.
