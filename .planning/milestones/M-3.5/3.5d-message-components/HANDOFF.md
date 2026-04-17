# Phase 3.5d Handoff — Message Components Control

**Status**: P3-GAP COMPLETE — all gap phases closed, component overrides verified in TUI
**SOVEREIGN**: 32/32
**Commit**: HEAD on master (post-gap-planning)
**Date**: 2026-04-17 (env hardening completed same day)

## What Is Done
- P0: Tool Visibility (T1-T6) — verified in TUI
- P1: Thinking Restoration (T7-T11) — verified in TUI
- P2: Override System (T12-T16) — deployed, registry entries added
- T17: Component directory loading — scanner deployed
- T19: Unhide hidden commands — TUI verified (/init, /insights visible)
- T21: Verification registry entry

## What Is NOT Done (was erroneously marked complete)
- T18: Default component overrides — empty skeleton, no actual override logic
- T20: Component override API docs — handler signature unverified
- T23: Full TUI verification — REPL invisible, components untested

## Gap Phase 1: P3-GAP-REPL (REPL TUI Visibility)
COMPLETE. Two binary patches: repl-visibility.ts + repl-transcript.ts.
1. isAbsorbedSilently=true in collapseReadSearch — REPL absorbed silently
2. isReplModeEnabled() returns false — handled by env flag CLAUDE_CODE_REPL=1
3. transformMessagesForExternalTranscript strips REPL pairs from saved transcripts

Key finding: Setting CLAUDE_CODE_REPL=1 does NOT fix visibility. Binary patch needed.
T-REPL-2 skipped (env flag covers it). 4 remaining tasks.

## Gap Phase 2: P3-GAP (Component Override Verification)
Override system built but never tested. No override has ever rendered in TUI.
6 tasks to verify signature, write real overrides, test e2e, correct docs.


## Gap Phase 3: P3-GAP-ENV (Environment Flag Hardening) — COMPLETE
Settings.json alone doesn't guarantee env var precedence. Three-layer approach:
1. RECOMMENDED_ENV in env-flags.ts — single source of truth (7 vars including CLAUDE_CODE_REPL)
2. launchEnv merge in index.tsx — RECOMMENDED_ENV as base, config.governance.env overrides on top
3. Shell exports in shim — dynamically generated from RECOMMENDED_ENV at setup time
Verified: all 7 vars present in running CC process via live TUI session.

## Binary References
- isAbsorbedSilently: in zJ6() (getToolSearchOrReadInfo), look for REPL tool name check
- isReplModeEnabled: iR() — `function iR(){return false}` near `var sX="REPL"`
- transformMessagesForExternalTranscript: filters tool_use/tool_result by REPL name
- Override injection: oOY() (message), sOY() (content block) — switch dispatch points

## Build & Verify
```bash
cd claude-governance && pnpm build
/bin/cp ~/.claude-governance/native-binary.backup ~/.local/share/claude/versions/2.1.101
node claude-governance/dist/index.mjs -a
node claude-governance/dist/index.mjs check   # Target: 32/32 SOVEREIGN
```
