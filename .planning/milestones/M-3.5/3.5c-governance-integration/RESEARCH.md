# Phase 3.5c Research — Governance Integration

## Channel Approval Gating

Binary analysis of CC 2.1.101 channel loading flow:

1. `--dangerously-load-development-channels` sets channels array T with `dev:true`
2. Two paths diverge based on authentication:
   - **API key users (no OAuth)**: `!z() || !w()?.accessToken` → auto-accept, no dialog
   - **Claude.ai OAuth users**: Shows `DevChannelsDialog` requiring "I am using this for local development" confirmation
3. Our users run via API key → **no binary patch needed** for channel approval bypass

### Key Binary References
- `si()` sets `R_.allowedChannels` (session channel list)
- `WT_()` sets `R_.hasDevChannels` flag
- `ew()` reads current `R_.allowedChannels`
- Auto-accept path: `si([...ew(),...T.map((Y)=>({...Y,dev:!0}))]),WT_(!0)`

### Existing Integration Points
- `handleLaunch` (index.tsx:1016) already injects `--dangerously-load-development-channels server:wire`
- `wire.ts` module skeleton exists with MCP registration in `apply()`
- Wire state files already at `~/.claude-governance/wire/` (relay.pid, relay.port, relay.log)
- Tungsten hooks provide exact pattern to follow (verify + cleanup)

## What Needs Building
1. Wire verification entries in the module (not binary-level — runtime health checks)
2. Wire verify hook (SessionStart) — check Wire health before model starts
3. Wire cleanup hook (SessionStop) — graceful relay unregistration
4. Wire module enhancement — relay auto-start awareness, better status
5. Hook registration in settings.json via `apply()`
