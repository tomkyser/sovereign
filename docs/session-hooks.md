# Session Hooks

claude-governance installs several hooks in `~/.claude/hooks/` that run during CC sessions.
These hooks provide verification, monitoring, and cleanup without requiring the user to
manually run commands.

## Governance Hooks

These are the hooks installed by claude-governance. Other hooks in the directory
(gsd-*, team-*, fp-*, etc.) belong to other tools and are not documented here.

### governance-verify.cjs — SessionStart

**Fires:** Every CC session start (including resumes after compaction)

**Purpose:** Verify governance is active; warn Claude if degraded.

**Flow:**
1. Read `state.json` from config dir
2. Check staleness (>4 hours = stale)
3. Check CC version match (state ccVersion vs installed binary)
4. If stale, missing, or version mismatch → run live `claude-governance check`
5. Display SOVEREIGN/PARTIAL/UNPROTECTED banner to stderr (user sees)
6. If not SOVEREIGN → output warning to stdout (Claude sees)

**Output to user (stderr):**
```
 ═══════════════════════════════════════
  SOVEREIGN — 20/20 governance active
  Tools: Ping, REPL probe:✓
 ═══════════════════════════════════════
```

**Output to Claude (stdout):**
Only if degraded — warns Claude that governance is not fully active.

### tungsten-verify.cjs — SessionStart

**Fires:** Every CC session start

**Purpose:** Verify tmux is available and prompt Tungsten session creation.

**Flow:**
1. Check if `tmux` is on PATH
2. Read state.json tools section
3. Display Tungsten availability to stderr
4. Output session creation directive to stdout (Claude sees):
   `"[TUNGSTEN] Establish a Tungsten session as your first action..."`

### embedded-tools-verify.cjs — SessionStart

**Fires:** Every CC session start

**Purpose:** Verify embedded search tools (bfs, ugrep, rg) are activated.

**8-point verification:**
1. `EMBEDDED_SEARCH_TOOLS` env var is set
2. Binary contains embedded tool dispatch code
3. `find --version` returns bfs
4. `grep --version` returns ugrep
5. Shell snapshot contains find/grep functions
6. rg is available
7. No PATH pollution from system versions
8. All three tools functional

### statusline-combined.cjs — StatusLine

**Fires:** On every statusline render (throttled by CC)

**Purpose:** Combined status display for governance + other tools.

**Segments:**
- `GOV:20/20` (green) or `GOV:15/20!` (yellow/red) — governance check count
- `EMB:✓` or `EMB:!` — embedded tools status
- `TOOLS:3` (green) or `TOOLS:!` (red) — injected tool count
- `TNG:main` — active Tungsten session (if any)

### governance-statusline.cjs — StatusLine Helper

**Fires:** Called by statusline-combined.cjs

**Purpose:** Reads state.json and formats the GOV/TOOLS/EMB segments.

### tungsten-session-end.cjs — Stop

**Fires:** When CC session ends (model stops, user exits)

**Purpose:** Clean up tmux resources.

**Flow:**
1. Kill tmux server for the session's socket
2. Remove tungsten-state.json
3. Clean up any orphaned session files

### stop-verify.cjs — Stop

**Fires:** When CC session ends

**Purpose:** Final verification check (typecheck + lint in Clawback context).

### post-compact-reinject.cjs — PostCompact

**Fires:** After CC compacts the conversation

**Purpose:** Re-inject context that compaction may have destroyed.

**Injects:**
- Git state (branch, recent commits)
- Content from `gotchas.md` if it exists
- Any other context markers needed for session continuity

## Hook Installation

Hooks are NOT automatically installed by `claude-governance apply`. They are part of the
user's CC configuration. The setup wizard (`claude-governance setup`) can install them,
or they can be manually placed in `~/.claude/hooks/`.

Hook registration happens in `~/.claude/settings.json`:
```json
{
  "hooks": {
    "SessionStart": [
      { "type": "command", "command": "node ~/.claude/hooks/governance-verify.cjs" },
      { "type": "command", "command": "node ~/.claude/hooks/tungsten-verify.cjs" }
    ],
    "StatusLine": [
      { "type": "command", "command": "node ~/.claude/hooks/statusline-combined.cjs" }
    ],
    "Stop": [
      { "type": "command", "command": "node ~/.claude/hooks/tungsten-session-end.cjs" }
    ]
  }
}
```

## Config Dir Resolution in Hooks

All hooks mirror the config dir resolution from `src/config.ts`:
1. `CLAUDE_GOVERNANCE_CONFIG_DIR` env var
2. `~/.claude-governance/`
3. `~/.tweakcc/` (legacy fallback)
4. `$XDG_CONFIG_HOME/claude-governance`

This ensures hooks find the correct state.json regardless of installation path.
