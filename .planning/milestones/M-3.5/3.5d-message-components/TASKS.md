# Phase 3.5d Tasks — Message Components Control

Status: P2 COMPLETE (29/29 SOVEREIGN). Phase steps 4-6 complete. P3 next session.

---

## P0: Tool Visibility — COMPLETE

- [x] T1-T6: All tool visibility tasks complete and verified in live TUI

## P1: Thinking Restoration — COMPLETE

- [x] T7-T10: All thinking patches written
- [x] T11: Thinking blocks verified visible in live TUI (∴ Thinking… renders with full content)

## P1.5: Binary Patch Pattern Migration — COMPLETE (session 2026-04-16-h)

- [x] T25-T32: All 13 patch regex patterns migrated for esbuild CJS output
- [x] Explore prompt override fix (pieces + bundled data fallback)

## P2: Override System — COMPLETE (session 2026-04-16-i)

- [x] T12: globalThis.__govMessageOverrides registry + binary injection at oOY() dispatcher
- [x] T13: Override check in SystemTextMessage (covered by oOY — all message types)
- [x] T14: Override check in AssistantToolUseMessage (covered by sOY content-level injection)
- [x] T15: Attachment visibility toggle infrastructure (override deploy pipeline)
- [x] T16: Override system added to VERIFICATION_REGISTRY + PATCH_DEFINITIONS

## Verification — COMPLETE

- [x] T21: All new patches in VERIFICATION_REGISTRY (covered by T16)
- [x] T22: Full SOVEREIGN check — 29/29 verified
- [x] T23: Interactive TUI verification — thinking, Ping, Tungsten, tool visibility, status bar

## Phase Steps 4-6 — COMPLETE

- [x] Step 4: End-to-end verification (build, SOVEREIGN, syntax, version, deploy, TUI)
- [x] Step 5: Gap analysis (override content deferred to P3, no blocking gaps)
- [x] Step 6: Housekeeping and handoff

## P3: User Customization — NEXT SESSION

- [ ] T17: Implement ~/.claude-governance/components/ directory loading
- [ ] T18: Governance default component overrides in data/components/
- [ ] T19: Unhide hidden commands patch
- [ ] T20: Documentation for component override API
