# Handoff — Phase 2c: Clean-Room Tungsten

**Completed:** 2026-04-13
**Commits:** 07598a7, f7d87f2, 4028775, 29b686a
**Verification:** 19/19 SOVEREIGN on 2.1.101

## What Was Built

6 deliverables implementing persistent execution context for Claude Code:

### D1: tungsten.js (data/tools/tungsten.js)
Persistent terminal tool with 6 actions (send/capture/create/list/kill/interrupt). PID-based socket isolation (`claude-<PID>`), lazy session creation, auto-capture after send. All tmux operations via `execFileSync` (no shell interpretation). Sets `process.env.__CLAUDE_GOVERNANCE_TMUX_ENV` for FS9 patch communication. Writes AppState for UI panel. Writes `tungsten-state.json` for statusline.

### D2: FS9() Binary Patch (src/patches/governance.ts)
Replaces `function FS9(){return null}` with a version that reads `__CLAUDE_GOVERNANCE_TMUX_ENV` from process.env. This activates bashProvider's tmux passthrough for ALL Bash commands after Tungsten creates a session. Two detection strategies: exact FS9 stub (high confidence), pattern-based TMUX assignment chain (medium, version-resilient).

### D3: Render Tree Injection (src/patches/governance.ts)
Patches the DCE'd TungstenLiveMonitor site (`!1,null`) with a self-executing function that require()s the panel component and passes React primitives as props. Unique signature: `cn7(O_)))),!1,null,b_.createElement(m,{flexGrow:1})`.

### D4: tungsten-panel.js (data/ui/tungsten-panel.js)
Clean-room live monitor component. Factory function receives `{R: React, S: useAppState, B: Box, T: Text}` as props (since it runs outside the binary's module scope). Reads `tungstenActiveSession` from AppState, renders terminal content in bordered cyan Box. 2-second polling with 500ms debounce. Renders nothing when no active session.

### D5: Statusline TNG Segment (~/.claude/hooks/statusline-combined.cjs)
Cyan `TNG` segment when active Tungsten session exists. Reads `tungsten-state.json` from config dir. Stale process detection: `process.kill(pid, 0)` — ESRCH = dead (clean up state file), EPERM = alive (show segment).

### D6: REPL Prompt Update (data/tools/repl.js)
Added "Tungsten Integration" section to both coexist and replace prompts. Guides: REPL bash() for one-shot, Tungsten for persistent processes.

## Key Decisions

1. **process.env for FS9 communication** — synchronous, global, race-free within a single process. No temp files, no IPC.
2. **execFileSync throughout** — eliminates shell interpretation, prevents command injection, fixes tmux format string quoting issues.
3. **data/ui/ for panel** — auto-discovery loader in data/tools/ has `Function.name` collision with factory exports. Separate directory avoids the issue.
4. **ESRCH vs EPERM** — macOS `process.kill(1, 0)` throws EPERM (root process). Only ESRCH means dead.

## Issues Discovered & Resolved

1. tmuxCmd double `-L` flag — callers added `-L` when tmuxCmd already prepends it
2. execSync shell quoting broke tmux `#{...}` format strings — switched to execFileSync
3. `session_activity_string` not a valid tmux format — simplified to name + window count
4. Panel factory's `Function.name` tripped auto-discovery loader — moved to data/ui/

## What's NOT Tested Yet (Requires Live CC Session)

- Bash tool inheriting TMUX env after Tungsten create (FS9 patch chain)
- REPL bash() inheriting TMUX env (delegation through stashed Bash tool)
- Live panel rendering in interactive session (React component injection)
- Model naturally choosing Tungsten based on prompt guidance

## Post-Tungsten Gaps (from 2b-gaps-3)

G24-G28 tracked in ROADMAP.md under Phase 2b-gaps-3:
- G24: Functional probe in replace mode
- G25: Coexist nudging (prompt effectiveness)
- G26: Oversized result labeling
- G27: CLI mode switch command
- G28: Coexist prompt parity with replace

## Next Phase

Phase 2d: Context Snipping Tool — design spec needed first.
