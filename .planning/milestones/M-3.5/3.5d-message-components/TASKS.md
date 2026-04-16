# Phase 3.5d Tasks — Message Components Control

Status: PLANNING COMPLETE — ready for ACT

---

## P0: Tool Visibility

- [ ] T1: Update tool-injection.ts renderToolUseMessage default to create visible React elements
- [ ] T2: Capture React/Ink references in tool loader scope for element creation
- [ ] T3: Implement REPL-specific renderToolUseMessage (show script description + operations)
- [ ] T4: Implement Tungsten-specific renderToolUseMessage (show action + session)
- [ ] T5: Binary patch to override empty-userFacingName suppression check
- [ ] T6: Verify all external tools visible in live TUI session

## P1: Thinking Restoration

- [ ] T7: Binary patch SystemTextMessage thinking dispatch (offset 8193543)
- [ ] T8: Identify ThinkingMessage minified function name in binary
- [ ] T9: Binary patch streaming thinking auto-hide (30s timeout removal)
- [ ] T10: Binary patch AssistantThinkingMessage to show full thinking by default
- [ ] T11: Verify thinking blocks visible in live TUI session

## P2: Override System

- [ ] T12: Design and implement globalThis.__govMessageOverrides registry
- [ ] T13: Binary patch override check injection points in SystemTextMessage
- [ ] T14: Binary patch override check injection in AssistantToolUseMessage
- [ ] T15: Implement null-rendered attachment visibility toggle
- [ ] T16: Add override system to verification registry

## P3: User Customization

- [ ] T17: Implement ~/.claude-governance/components/ directory loading
- [ ] T18: Governance default component overrides in data/components/
- [ ] T19: Unhide hidden commands patch
- [ ] T20: Documentation for component override API

## Verification

- [ ] T21: Add all new patches to VERIFICATION_REGISTRY
- [ ] T22: Full SOVEREIGN check (target: 23+ signatures)
- [ ] T23: Interactive TUI verification of all restored UI elements

