# Phase 3.5c Context — Governance Integration

Last updated: 2026-04-16

## Active Work
Implementing Wire governance integration — hooks, verification entries, module enhancement.

## Key Files Being Modified
- `claude-governance/src/modules/wire.ts` — module with verification entries + apply
- `claude-governance/src/wire-hooks/wire-verify.cjs` — SessionStart hook (new)
- `claude-governance/src/wire-hooks/wire-cleanup.cjs` — SessionStop hook (new)

## Integration Pattern (from Tungsten)
1. Module apply() deploys hooks to ~/.claude/hooks/ and registers in settings.json
2. Module verificationEntries array feeds into check command
3. SessionStart hook reports health to user via stdout
4. SessionStop hook cleans up state

## Channel Approval: Resolved
API key users auto-accept dev channels. No binary patch needed.
Existing handleLaunch already passes --dangerously-load-development-channels.
