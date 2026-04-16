# Phase 3.5d Context — Message Components Control

Date: 2026-04-16
Status: ACT IN PROGRESS — P0 complete (24/24 SOVEREIGN), P1 next
Previous: 3.5c (Governance Integration)

## Scope
Complete message component override and patching capability for claude-governance.
Every tool call visible, thinking blocks restored, user-customizable component overrides.

## Deliverables (9)
1. P0: Fix external tool rendering (REPL/Tungsten/Ping visible in TUI)
2. P0: Full tool visibility (override empty-name suppression)
3. P1: Restore thinking blocks (SystemTextMessage dispatch patch)
4. P1: Disable thinking auto-hide (remove 30s streaming timeout)
5. P1: Show full thinking by default (skip Ctrl+O stub)
6. P2: Expose null-rendered attachments (user-configurable)
7. P2: Build override registry (globalThis component overrides)
8. P3: User customization (~/.claude-governance/components/)
9. P3: Unhide hidden commands

## Key Binary Offsets (v2.1.101)
- thinking null-return: 8193543
- isTransparentWrapper: 8131112, 8131136, 8131405
- SystemTextMessage region: ~8192000-8195000

## Key Source Files
- CC source messages: /Users/tom.kyser/dev/cc-source/.../src/components/messages/
- Tool interface: /Users/tom.kyser/dev/cc-source/.../src/Tool.ts (lines 529-793)
- nullRenderingAttachments: /Users/tom.kyser/dev/cc-source/.../src/components/messages/nullRenderingAttachments.ts
- Our tool injection: src/patches/governance/tool-injection.ts
- Our render tree patch: src/patches/governance/render-tree.ts (closest analog)

## Decisions
- D-01: Full tool visibility is a P0 deliverable — nothing hidden from governance users
- D-02: 9 deliverables across P0-P3 priority tiers

