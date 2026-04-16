# Phase 3.5a Tasks — Wire MCP Server

## Task List

### T1: Protocol Module
**Status**: TODO
**Files**: `src/wire/types.ts`, `src/wire/protocol.ts`
**Scope**: Define TypeScript types and protocol functions — message types, urgency levels,
envelope creation, envelope validation. Port from dynamo `protocol.cjs`, adapt types to TS,
simplify message type enum for Wire scope.

### T2: MCP Server Core
**Status**: TODO
**Files**: `src/wire/server.ts`
**Scope**: Create the Wire MCP server using `@modelcontextprotocol/sdk`. Declare
`claude/channel` capability. Connect via StdioServerTransport. Implement ListTools
and CallTool handlers. Write `instructions` text. Handle graceful shutdown.

### T3: Wire Tools (wire_send, wire_status)
**Status**: TODO
**Files**: `src/wire/server.ts` (tool handlers within server)
**Scope**: Implement `wire_send` tool (creates envelope, emits notification to confirm,
stores/logs for 3.5b relay pickup). Implement `wire_status` tool (reports session ID,
connection state, server uptime). Input schemas with proper Zod-compatible JSON Schema.

### T4: Build Pipeline Integration
**Status**: TODO
**Files**: `package.json` (or tsdown config), `data/wire/wire-server.cjs`
**Scope**: Add tsdown build target for Wire server. Bundle `@modelcontextprotocol/sdk`
into standalone CJS. Verify the artifact runs as a standalone Node.js/Bun process.
Wire server is a separate build target from tools — it's an MCP server, not a CC tool.

### T5: MCP Server Registration Config
**Status**: TODO
**Files**: `src/wire/config.ts` (or in governance setup), `.mcp.json` template
**Scope**: Create the configuration that registers Wire as an MCP server in CC.
This includes the `.mcp.json` entry (or `settings.json` mcpServers entry) specifying
the Wire server command and args. The governance shim must add `--channels wire` and
`--dangerously-load-development-channels` to launch flags.

### T6: End-to-End Verification
**Status**: TODO
**Scope**: Test the complete flow: launch CC with Wire as channel server → manually
trigger inbound notification (or have Claude call wire_send) → verify `<channel>`
message appears in conversation → verify Claude can call wire_send tool. Document
the test procedure for future sessions.
