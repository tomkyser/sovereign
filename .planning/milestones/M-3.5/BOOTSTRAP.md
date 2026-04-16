# Milestone 3.5 Bootstrap — Wire Inter-Session Communication

---

**Status:** Phases 3.5a-c COMPLETE — Phase 3.5d P0+P1 COMPLETE (27/27 SOVEREIGN)
**Baseline:** 27/27 SOVEREIGN on CC 2.1.101
**Previous milestone:** M-3 (System Prompt Control) — COMPLETE

## Read These Files (In This Order)

1. `.planning/milestones/M-3.5/3.5d-message-components/TASKS.md` — **P0+P1 complete, T11 verify next**
2. `.planning/milestones/M-3.5/3.5d-message-components/PLANNING.md` — Approach per deliverable
3. `.planning/milestones/M-3.5/3.5d-message-components/CONTEXT.md` — Phase context + decisions
4. `.planning/milestones/M-3.5/CONTEXT.md` — Milestone-level shared state

## What Was Built

### P0: Tool Visibility (PATCH 14, T1-T6 verified)
- Default `renderToolUseMessage` returns visible React element (cyan text)
- `globalThis.__govReactRefs` captures React/Ink refs in tool loader scope
- REPL/Tungsten per-tool renderers
- Binary patch removes empty-name suppression

### P1: Thinking Restoration (PATCHES 15-17, T7-T10b complete)
- **PATCH 15 (T7)**: SystemTextMessage thinking dispatch — inline renderer replaces null return
  - Uses r6/m/L from local scope (ql_ not accessible cross-module)
  - Shows "∴ Thinking…" header + first 500 chars of content
  - Anchor: `q.subtype==="thinking")return null;if(q.subtype==="bridge_status")` (unique)
- **PATCH 16 (T10)**: AssistantThinkingMessage fullshow — dead-codes `if(!(O||T))` guard
  - Stub branch ("∴ Thinking" + Ctrl+O hint) never executes
  - Full thinking content always rendered via Markdown component
- **PATCH 17 (T10b)**: Assistant message thinking dispatch guard removal
  - Removes `if(!j&&!$)return null` so thinking always passes to ql_
- **T8**: ThinkingMessage identified as `ql_` (AssistantThinkingMessage)
- **T9**: CLOSED — 30s streaming timeout does not exist. thinkingClearLatched (1hr) affects API only.

### Key Implementation Details
- Three separate thinking suppression points patched:
  1. SystemTextMessage subtype dispatch → null (PATCH 15)
  2. AssistantMessage case dispatch → null when !verbose && !transcript (PATCH 17)
  3. ql_ component → shows stub when !verbose && !transcript (PATCH 16)
- Inline renderer needed for SystemTextMessage because ql_ is in a different module scope
- `r6` = React, `m` = Box, `L` = Text in SystemTextMessage scope

## What's Next — P1 Verify Phase

### Step 4: Verify
- T11: Interactive TUI verification — trigger thinking and confirm blocks render visually
- Test: use "think hard about" or effort:max to trigger thinking blocks
- Verify full content shown (not just stub)

### Step 5: Gap Analysis
- Check: does thinking render correctly during streaming?
- Check: does thinking content truncation (500 chars in SystemTextMessage) work?
- Edge cases: redacted_thinking blocks, error states

### Step 6: Housekeeping
- Update all tracking docs
- Commit and push
- Bootstrap for P2 (Override System) or next milestone phase

### Build
- `cd claude-governance && pnpm build` → full project build
- `node claude-governance/dist/index.mjs -a` → apply patches
- `node claude-governance/dist/index.mjs check` → 27/27 SOVEREIGN
