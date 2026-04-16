# Phase 3.5c Handoff — Governance Integration

Date: 2026-04-16
Status: COMPLETE
Previous: 3.5b (Session Registry & Cross-Session Routing)

---

## What Was Built

Wire integrated into claude-governance's module lifecycle: auto-deploy hooks,
self-verify at SessionStart, clean up at SessionStop, report health in modules command.

### New Files (2)

| File | Purpose |
|------|---------|
| `data/hooks/wire-verify.cjs` | SessionStart hook — checks MCP registration + relay health |
| `data/hooks/wire-cleanup.cjs` | SessionStop hook — HTTP unregister from relay, clean state |

### Modified Files (2)

| File | Changes |
|------|---------|
| `src/modules/wire.ts` | Full rewrite: ESM path resolution, hook deployment, settings.json registration, enhanced getStatus() with 4-point health check |
| `.gitignore` | Added .planning/ exclusion |

## What apply() Now Does for Wire

1. Registers Wire MCP server in `~/.claude/.mcp.json`
2. Copies wire-verify.cjs and wire-cleanup.cjs to `~/.claude/hooks/`
3. Registers hooks in `~/.claude/settings.json` (SessionStart + Stop)
4. Ensures `~/.claude-governance/wire/` directory exists

## Key Decisions

- D-01: No binary-level verification entries (Wire has no binary patches). Health via getStatus().
- D-02: Channel approval bypass not needed. API key users auto-accept dev channels.
- D-03: Cleanup = HTTP unregister only. Relay self-terminates after 5 min idle.
- D-04: ESM compatibility: import.meta.url + dirname/resolve replaces __dirname.
- D-05: Wire health = 4-point check: server artifact, MCP registration, hooks deployed, relay alive.

## What's NOT Done (for next phases)

- **3.5d**: Prompt overrides teaching the model Wire usage patterns
- **3.5e**: /coordinate skill + Tungsten orchestration
- **3.5f**: Hardening, WebSocket upgrade, testing, docs

## Gotchas for Next Phase

1. **Wire module is defaultEnabled: false.** Must be enabled in config.json: `{ "modules": { "wire": true } }`
2. **Relay auto-start** happens when the first MCP server connects, not at apply time.
3. **settings.json hooks accumulate.** Multiple apply() calls won't duplicate (idempotent check).
