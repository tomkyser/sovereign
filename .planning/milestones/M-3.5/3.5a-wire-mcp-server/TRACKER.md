# 3.5a-wire-mcp-server — Tracker

Status: PLANNING COMPLETE
Phase: Research ✓ → Planning ✓ → **Act** → Verify → Gap → Housekeeping

## Decisions

- **D-01**: TypeScript + CJS build via tsdown (same toolchain as REPL/Tungsten)
- **D-02**: Port protocol.cjs envelope types, simplify message types for Wire scope
- **D-03**: Standalone CJS entry point, registered in .mcp.json/settings.json
- **D-04**: No relay in 3.5a — direct channel notification only
- **D-05**: Minimum tools: wire_send, wire_status
- **D-06**: Instructions pattern adapted from fakechat

## Blockers

None currently.

## Status Updates

- 2026-04-15: Research complete. 8 findings documented. Binary analysis confirmed channel notification schema, meta key validation, prompt injection path, gate bypass strategy. fakechat and dynamo source fully analyzed. Ready for planning.
- 2026-04-16: Planning complete. PLANNING.md and TASKS.md created. 6 tasks defined (T1-T6). Architecture: standalone CJS MCP server via tsdown, bundle MCP SDK, fakechat-style instructions. Ready for Act.
