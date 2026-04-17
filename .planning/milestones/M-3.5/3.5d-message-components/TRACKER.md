# Phase 3.5d Tracker — Message Components Control

## Status: P3-GAP-REPL COMPLETE — 1 gap phase remaining (P3-GAP)

## Phase Progress
- [x] Research — CC source analysis, binary patterns, rendering pipeline
- [x] Planning — PLANNING.md with implementation approach per deliverable
- [~] Act — P0-P2 complete. P3 partially complete (T17/T19/T21 done, T18/T20 marked in error)
- [~] Verify — SOVEREIGN 32/32 but behavioral gaps found: REPL invisible, components untested
- [~] Gap Analysis — TWO gap phases identified (REPL visibility, component verification)
- [ ] Housekeeping — blocked until gap phases resolve

## Decisions
- REPL env flag (CLAUDE_CODE_REPL=1) does NOT fix TUI visibility — binary patch required
- T-REPL-2 skipped: env flag handles isReplModeEnabled(), patch unnecessary
- CC source components (389 files, 9.3MB) too coupled to extract/edit — override system is correct architecture
- T18/T20 were marked complete without behavioral verification — corrected

## Blockers
- ~~REPL tool calls invisible in TUI~~ RESOLVED: repl-visibility.ts + repl-transcript.ts
- Component override system never tested end-to-end
- Handler signature in docs unverified against binary injection
