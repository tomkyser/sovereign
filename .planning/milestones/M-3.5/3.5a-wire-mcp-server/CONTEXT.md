# 3.5a-wire-mcp-server — Context

Last updated: 2026-04-16

## Phase Status: Act COMPLETE (T1-T5 done, T6 needs interactive test)

## Official Docs Review (code.claude.com/docs/en/channels-reference)

### Corrections to Our Approach
- **Only --dangerously-load-development-channels needed** — no --channels flag. The dev flag IS the registration for custom channels during research preview.
- **Flag format confirmed**: `claude --dangerously-load-development-channels server:wire`
- **The flag does NOT consume positional args** — our earlier -p failures were likely a different issue (possibly slow MCP init, not arg parsing). Need to retest with interactive mode.
- **Requires claude.ai login** — Console and API key auth not supported.

### Confirmed Correct
- MCP server with `claude/channel` capability in experimental — exact match
- Notification format: `{ method: "notifications/claude/channel", params: { content, meta } }` — exact match  
- Meta keys: identifiers only (letters, digits, underscores) — exact match
- Instructions field → Claude's system prompt — exact match
- Stdio transport, CC spawns as subprocess — exact match
- .mcp.json registration — exact match
- tools: {} for two-way, omit for one-way — we declare tools (correct for two-way Wire)

### New Capabilities Discovered
- **Permission relay**: `claude/channel/permission` capability + `permission_request` notification. Not needed for 3.5a but valuable for 3.5d+
- **Plugin packaging**: Wrap in plugin for installability. Relevant for 3.5c governance integration.

## What Was Built

### Source Files
- `src/wire/types.ts` — MessageType, UrgencyLevel, Envelope, EnvelopeInput, Result<T>
- `src/wire/protocol.ts` — createEnvelope, validateEnvelope, filterMetaKeys, envelopeToMeta
- `src/wire/server.ts` — MCP Server with claude/channel, wire_send + wire_status tools

### Build Pipeline
- `tsdown.wire.config.ts` — Standalone CJS build config (bundles MCP SDK + ajv)
- `data/wire/wire-server.cjs` — 462KB self-contained artifact
- `package.json` — build:wire script, data/wire/*.cjs in files array

### Governance Integration
- `src/modules/wire.ts` — Wire governance module (registers in .mcp.json)
- `src/modules/registry.ts` — Wire added to ALL_MODULES
- `src/index.tsx` — handleLaunch injects --dangerously-load-development-channels server:wire

## Findings During Act

### F-ACT-1: Channel names must be tagged
`--channels wire` rejected. Must be `server:wire` or `plugin:name@marketplace`.

### F-ACT-2: MCP SDK v1.29.0 uses newline-delimited JSON
Not Content-Length framing. ReadBuffer scans for \n delimiter.

### F-ACT-3: .cjs extension required
package.json has "type": "module". Node treats .js as ESM, breaking require(). Keep .cjs.

### F-ACT-4: Official docs confirm --dangerously-load-development-channels is the only flag
No need for --channels separately. The dev flag bypasses allowlist AND registers the channel.

## Next: Interactive Test
Test with: `claude --dangerously-load-development-channels server:wire`
(interactive mode, not -p)
