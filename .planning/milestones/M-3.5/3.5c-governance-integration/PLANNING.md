# Phase 3.5c Planning — Governance Integration

## Scope
Wire the Wire inter-session communication system into claude-governance's module
lifecycle: auto-start, self-verify, clean up, report status.

## Approach
Follow the Tungsten pattern exactly — it's the proven integration template:
- Verification hook at SessionStart (like tungsten-verify.cjs)
- Cleanup hook at SessionStop (like tungsten-session-end.cjs)
- Verification entries in the module (like core module's VERIFICATION_REGISTRY)
- State files in ~/.claude-governance/wire/

## Tasks
1. **Wire verification entries** — Add non-binary checks to wire module:
   - wire-server-deployed: wire-server.cjs exists in data/wire/
   - wire-mcp-registered: .mcp.json has wire entry
   - wire-relay-healthy: relay PID file exists and process is alive
2. **Wire verify hook** — wire-verify.cjs for SessionStart
3. **Wire cleanup hook** — wire-cleanup.cjs for SessionStop
4. **Wire module apply enhancement** — write hooks during apply, ensure relay config
5. **Settings.json hook registration** — wire module apply() registers hooks
6. **Typecheck + build + verify**

## Key Decisions
- D-01: Verification entries are NOT binary signature checks (Wire has no binary patches).
  They're runtime health checks evaluated by the governance `check` command.
- D-02: Channel approval bypass is NOT needed (API key users auto-accept). ROADMAP task resolved.
- D-03: Relay cleanup is graceful unregistration only — don't kill relay, it self-terminates.
- D-04: Hooks are CJS files deployed to ~/.claude/hooks/ by the wire module's apply().

## Dependencies
- Phase 3.5b artifacts (wire-server.cjs, wire-relay.cjs) must be built
- Existing governance module infrastructure (types, registry, apply pipeline)
