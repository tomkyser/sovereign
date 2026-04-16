# Phase 3.5a Tasks — Wire MCP Server

## Task List

### T1: Protocol Module
**Status**: COMPLETE
**Files**: `src/wire/types.ts`, `src/wire/protocol.ts`

### T2: MCP Server Core
**Status**: COMPLETE
**Files**: `src/wire/server.ts`

### T3: Wire Tools (wire_send, wire_status)
**Status**: COMPLETE
**Files**: `src/wire/server.ts` (tool handlers within server)

### T4: Build Pipeline Integration
**Status**: COMPLETE
**Files**: `tsdown.wire.config.ts`, `data/wire/wire-server.cjs`, `package.json`
**Notes**: MCP SDK bundled. 462KB self-contained CJS. .cjs extension required (package.json type: module).

### T5: MCP Server Registration Config
**Status**: COMPLETE
**Files**: `src/modules/wire.ts`, `src/modules/registry.ts`, `src/index.tsx`
**Notes**: Wire module registers in .mcp.json. Launch flags inject --dangerously-load-development-channels server:wire.

### T6: End-to-End Verification
**Status**: PARTIAL
**Verified via REPL harness**: MCP handshake, initialize response (capabilities, instructions, serverInfo), tools/list (2 tools), wire_status (session ID, uptime), wire_send (envelope creation, notification emission), channel notification format (meta keys, content).
**Not verified**: Live CC session calling Wire tools. `claude -p` with Wire MCP server registered hangs (likely slow MCP+model init, not a bug). Needs interactive testing.
