# Phase 3.5d Planning — Message Components Control

Status: PENDING (populate during Planning step)
Previous: 3.5c (Governance Integration)
Research: RESEARCH.md (complete)

---

## Scope

Complete message component override and patching capability. Three pillars:
1. Tool visibility — every tool call visible, nothing hidden
2. Thinking/reasoning restoration — all suppressed thinking made visible
3. User-customizable component overrides — governance defaults, user edits

### Scope Relationship
- **Phase → Milestone**: Blocks remaining Wire phases (3.5e/f). Model must see its own
  tool output to coordinate effectively across sessions.
- **Milestone → Project**: Extends M-2's tool injection with rendering. Extends M-3's
  prompt overrides with UI overrides. First binary patching of React components.

## Approach

*(To be filled during Planning step — implementation strategy per deliverable)*

## Deliverables

### P0 (Blocking)
1. Fix external tool rendering — REPL/Tungsten/Ping visible in TUI
2. Full tool visibility — override empty-name suppression check

### P1 (Core)
3. Restore thinking blocks — SystemTextMessage dispatch patch
4. Disable thinking auto-hide — remove 30s streaming timeout
5. Show full thinking by default — skip Ctrl+O stub

### P2 (Extended)
6. Expose null-rendered attachments — user-configurable visibility
7. Build override registry — globalThis component overrides

### P3 (Future)
8. User customization — ~/.claude-governance/components/ file loading
9. Unhide hidden commands — all /commands visible in help

## Risks

1. **React component patching fragility** — function boundaries shift between versions.
   Mitigation: multi-detector pattern matching, string literal anchors.
2. **React Compiler memo cache invalidation** — injected code may break _c() slot indexing.
   Mitigation: inject at dispatch boundaries, not inside memo blocks.
3. **Tool rendering without React access** — CJS tool files can't import React.
   Mitigation: capture refs in loader scope, inject factory functions.

## Dependencies

- Existing: render-tree.ts patch pattern (Tungsten panel injection)
- Existing: tool-injection.ts loader (binary-scope execution context)
- CC source: /Users/tom.kyser/dev/cc-source/.../src/components/messages/

