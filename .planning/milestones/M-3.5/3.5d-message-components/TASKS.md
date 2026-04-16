# Phase 3.5d Tasks — Message Components Control

Status: ACT IN PROGRESS — P0 VERIFIED, P1 COMPLETE (27/27 SOVEREIGN)

---

## P0: Tool Visibility

- [x] T1: Update tool-injection.ts renderToolUseMessage default to create visible React elements
- [x] T2: Capture React/Ink references in tool loader scope for element creation
- [x] T3: Implement REPL-specific renderToolUseMessage (show script description + operations)
- [x] T4: Implement Tungsten-specific renderToolUseMessage (show action + session)
- [x] T5: Binary patch to override empty-userFacingName suppression check
- [ ] T11: Verify thinking blocks visible in live TUI session
- [x] T6: Phase steps 4-6 for P0 — VERIFIED
  - [x] 4. TUI verification: tools render visibly, no crash
  - [x] 5. Gap analysis: 9 built-in CC tools still null (by design, P2 scope), no regressions
  - [x] 6. Housekeeping complete, bootstrap for P1

## P1: Thinking Restoration

- [x] T7: Binary patch SystemTextMessage thinking dispatch — inline renderer replaces null return
- [x] T8: ThinkingMessage identified as `ql_` (AssistantThinkingMessage)
- [x] T9: CLOSED — 30s timeout does not exist; thinkingClearLatched (1hr) only affects API, not rendering
- [x] T10: Binary patch ql_ — verbose guard dead-coded, full thinking always shown
- [x] T10b: Binary patch assistant message thinking dispatch guard (case"thinking" verbose gate removed)
- [ ] T11: STOP - Prepare for new session with bootstrap! - THEN: Phase steps 4-6 (/.planning/project-management/phase-steps/{step_number}.md)
  - [ ] 4. Verify all new and existing functionality in live TUI session
  - [ ] 5. Gap analysis & report-discuss-resolve loop
  - [ ] 6. Housekeeping and handoff

## P2: Override System

- [ ] T12: Design and implement globalThis.__govMessageOverrides registry
- [ ] T13: Binary patch override check injection points in SystemTextMessage
- [ ] T14: Binary patch override check injection in AssistantToolUseMessage
- [ ] T15: Implement null-rendered attachment visibility toggle
- [ ] T16: Add override system to verification registry
- [ ] STOP - Prepare for new session with bootstrap! - THEN: Phase steps 4-6 (/.planning/project-management/phase-steps/{step_number}.md)
  - [ ] 4. Verify all new and existing functionality in live TUI session
  - [ ] 5. Gap analysis & report-discuss-resolve loop
  - [ ] 6. Housekeeping and handoff

## P3: User Customization

- [ ] T17: Implement ~/.claude-governance/components/ directory loading
- [ ] T18: Governance default component overrides in data/components/
- [ ] T19: Unhide hidden commands patch
- [ ] T20: Documentation for component override API
- [ ] STOP - Prepare for new session with bootstrap! - THEN: Phase steps 4-6 (/.planning/project-management/phase-steps/{step_number}.md)
  - [ ] 4. Verify all new and existing functionality in live TUI session
  - [ ] 5. Gap analysis & report-discuss-resolve loop
  - [ ] 6. Housekeeping and handoff

## Verification

- [ ] T21: Add all new patches to VERIFICATION_REGISTRY
- [ ] T22: Full SOVEREIGN check (target: 23+ signatures)
- [ ] T23: Interactive TUI verification of all restored UI elements
