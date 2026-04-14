# Phase 2c Tracker — Clean-Room Tungsten

**Status:** COMPLETE
**Started:** 2026-04-13
**Completed:** 2026-04-13
**Scope:** 6 deliverables, persistent execution context tool + binary patches + UI injection

## Deliverables

### D1: tungsten.js — Persistent Execution Context Tool [COMPLETE]
**File:** data/tools/tungsten.js | **Commit:** 07598a7

- [x] Tool contract (name, inputJSONSchema, prompt, description, call)
- [x] Socket isolation: claude-<PID> per CC process
- [x] Actions: send, capture, create, list, kill, interrupt
- [x] Lazy session creation (ensureSession on first send/create)
- [x] Auto-capture after send (150ms delay + capture output)
- [x] Shell safety: all tmux ops via execFileSync (no shell interpretation)
- [x] tmux availability check (graceful error if missing)
- [x] Cleanup on process exit (kill-server for our socket)
- [x] Socket info via process.env.__CLAUDE_GOVERNANCE_TMUX_ENV for FS9 patch
- [x] AppState write via context.setAppState()
- [x] prompt() with usage guidance (when Tungsten vs Bash vs REPL)

### D2: FS9() Binary Patch — bashProvider tmux Activation [COMPLETE]
**Files:** src/patches/governance.ts, src/patches/index.ts | **Commit:** f7d87f2

- [x] Patch: replace function FS9(){return null} with socket-aware version
- [x] FS9 reads process.env.__CLAUDE_GOVERNANCE_TMUX_ENV from D1
- [x] Two detection strategies: exact FS9 stub (high), pattern-based TMUX chain (medium)
- [x] Version-resilient: adapts to function name changes
- [x] Verification signature in VERIFICATION_REGISTRY
- [x] Already-applied detection

### D3: Render Tree Injection — Live Panel Mounting [COMPLETE]
**Files:** src/patches/governance.ts, src/patches/index.ts | **Commit:** 4028775

- [x] Patch: replace !1,null at unique DCE site with createElement call
- [x] Unique match: cn7(O_)))),!1,null,b_.createElement(m,{flexGrow:1})
- [x] Self-executing function: try/catch require() of panel component
- [x] Pass props: React (b_), useAppState (Y_), Box (m), Text (L)
- [x] Null fallback on load failure
- [x] Verification signature + already-applied detection

### D4: tungsten-panel.js — Clean-Room Live Monitor [COMPLETE]
**File:** data/ui/tungsten-panel.js | **Commit:** 4028775

- [x] React component factory receiving {R: React, S: useAppState, B: Box, T: Text} as props
- [x] Read tungstenActiveSession from AppState
- [x] Render nothing if no active session
- [x] Render terminal content (tmux capture-pane) in bordered Box
- [x] Show session name, last command
- [x] Respect tungstenPanelVisible / tungstenPanelAutoHidden
- [x] 2-second polling with 500ms debounce
- [x] Graceful degradation if tmux capture fails
- [x] Lives in data/ui/ (not data/tools/) to avoid auto-discovery loader

### D5: Statusline TNG Segment [COMPLETE]
**File:** ~/.claude/hooks/statusline-combined.cjs | **Commit:** 29b686a

- [x] TNG segment in combined statusline (cyan)
- [x] Reads tungsten-state.json from config dir
- [x] Stale process detection: ESRCH = dead (clean up), EPERM = alive (show TNG)
- [x] No segment if no active session

### D6: REPL Prompt Update — Tungsten Awareness [COMPLETE]
**File:** data/tools/repl.js | **Commit:** 29b686a

- [x] Coexist prompt: Tungsten Integration section
- [x] Replace prompt: Tungsten Integration section
- [x] Guidance: Tungsten for long-running, REPL bash() for one-shot

## Verification Results

- [x] Build clean (pnpm build) — 163KB
- [x] check: 19/19 SOVEREIGN
- [x] Functional test: create, send, capture, list, kill, interrupt all pass
- [x] State persistence: cd + export survive between send calls
- [x] FS9 env: process.env.__CLAUDE_GOVERNANCE_TMUX_ENV set after create
- [x] Lazy init: send without prior create auto-creates session
- [x] Multi-session: create/list/kill multiple sessions
- [x] Error handling: missing command, bad action
- [x] Cleanup: sessions killed on process exit, state file cleaned
- [x] Tool shape validation: 3 tools discovered (Ping, REPL, Tungsten)
- [x] Statusline: TNG shows for live pid, absent for dead pid, cleans stale file

## Pending Verification (requires live CC session)

- [ ] Bash inheritance: after Tungsten create, native Bash cd persists
- [ ] REPL inheritance: after Tungsten create, REPL bash() cd persists
- [ ] Live panel renders in interactive session
- [ ] Fresh session test: natural language prompt triggers Tungsten use

## Decisions

1. Tungsten is a persistent execution context, not just a tmux tool
2. Implementation order: D1 > D2 > D3+D4 > D5+D6
3. Socket info sharing: process.env (synchronous, no race, global within process)
4. Panel receives React primitives as props, renders inside existing AppStateProvider
5. All tmux operations via execFileSync (no shell interpretation, no injection risk)
6. Panel lives in data/ui/ not data/tools/ (avoids auto-discovery loader conflict)
7. Stale PID detection: ESRCH = dead, EPERM = alive (macOS launchd compatibility)

## Issues Found & Resolved

1. **tmuxCmdSafe double -L**: tmuxCmd already prepends `-L SOCKET`, callers were adding it again. Fixed: all callers use tmuxCmd.
2. **tmux format string quoting**: execSync shell strings broke #{...} format strings. Fixed: switched to execFileSync throughout.
3. **Function.name on panel factory**: auto-discovery loader pushed the panel factory as a "tool" (Function has .name). Fixed: moved panel to data/ui/ directory.
4. **session_activity_string**: Not a valid tmux format variable in 3.6a. Fixed: simplified format to session_name + session_windows.
5. **ESRCH vs EPERM**: process.kill(pid, 0) throws EPERM for root processes on macOS. Fixed: only treat ESRCH as dead process.
