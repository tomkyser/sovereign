# Phase 3.5d Tasks — Message Components Control

Status: P3 INCOMPLETE — two gap phases required before phase can close
SOVEREIGN: 32/32 (patches work, but component system untested, REPL invisible)

---

## P0: Tool Visibility — COMPLETE
- [x] T1-T6: All tool visibility tasks complete and verified in live TUI

## P1: Thinking Restoration — COMPLETE
- [x] T7-T11: All thinking restoration tasks complete and verified in live TUI

## P2: Override System — COMPLETE
- [x] T12-T16: Override system deployed, registry entries added, verified

## P3: User Customization — PARTIALLY COMPLETE
- [x] T17: Component directory loading (defaults.js scans ~/.claude-governance/components/)
- [ ] ~~T18~~ **MARKED IN ERROR** — skeleton only, no actual override logic, never tested
- [x] T19: Unhide hidden commands (32/32 SOVEREIGN, TUI verified: /init, /insights visible)
- [ ] ~~T20~~ **MARKED IN ERROR** — handler signature never verified against binary injection
- [x] T21: Verification registry entry for unhide-commands

## P3-GAP-REPL: REPL Tool TUI Visibility
> Gap phase. REPL tool calls were invisible in TUI. COMPLETE — 2 patches, TUI + resume verified.
> Root cause: collapseReadSearch sets isAbsorbedSilently=true for REPL.
> Env flag CLAUDE_CODE_REPL=1 enables REPL mode but does NOT fix TUI visibility.
> Source: sessionStorage.ts:4372-4448, collapseReadSearch.ts

- [x] T-REPL-1: Patch isAbsorbedSilently for REPL from true→false in zJ6()
- [~] T-REPL-2: SKIPPED — env flag CLAUDE_CODE_REPL=1 handles isReplModeEnabled
- [x] T-REPL-3: Patch D_8() to bypass REPL stripping from external transcripts
- [x] T-REPL-4: Verify REPL tool call renders visibly in TUI
- [x] T-REPL-5: Verify REPL calls persist in transcript on --resume

## P3-GAP: Component Override Verification
> Gap phase. T18/T20 were rubber-stamped without behavioral verification.
> No component override has ever rendered in the TUI.
> Reason: Claude's sloppy verification — build-time checks treated as done.

- [ ] T-GAP-1: Verify handler signature matches binary injection code
- [ ] T-GAP-2: Write a real component override (e.g., thinking block custom render)
- [ ] T-GAP-3: Test override end-to-end in TUI
- [ ] T-GAP-4: Ship verified default overrides in data/components/
- [ ] T-GAP-5: Correct docs/README.md to match verified handler signature
- [ ] T-GAP-6: Document update resilience (what survives CC updates, what doesn't)

## T23: Interactive TUI Verification — BLOCKED
> Cannot complete until both gap phases pass. Partial verification done:
> tools visible, thinking visible, hidden commands visible.
> Missing: REPL visibility, component override rendering.
