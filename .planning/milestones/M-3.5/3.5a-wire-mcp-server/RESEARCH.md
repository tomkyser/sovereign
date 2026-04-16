# Phase 3.5a Research — Wire MCP Server

Date: 2026-04-15
Sources: CC 2.1.101 binary analysis, fakechat reference [fakechat1], dynamo Wire [dynamoWire], channels-reference [channelsRef1]

---

## Executive Summary

The Wire MCP server is a single-process stdio MCP server that declares `claude/channel`
capability. CC handles the entire lifecycle — registration, notification delivery, XML
wrapping, prompt injection. Our server exposes tools for outbound messaging and emits
notifications for inbound. The reference implementation (fakechat) is 268 lines of TS.

---

## Finding 1: Channel Notification Schema (Binary-Confirmed)

From binary offset 9987836 (`$4_` lazy schema):

```javascript
$4_ = h.object({
  method: h.literal("notifications/claude/channel"),
  params: h.object({
    content: h.string(),
    meta: h.record(h.string(), h.string()).optional()
  })
})
```

**content**: Required string. This becomes the body of the `<channel>` XML tag.
**meta**: Optional `Record<string, string>`. Each key-value becomes an XML attribute.

### Meta Key Validation

Binary regex `nz5 = /^[a-zA-Z_][a-zA-Z0-9_]*$/` validates meta keys. Only alphanumeric
and underscores allowed. **No hyphens, no dots, no special characters.** Keys failing
this regex are silently dropped by `A4_()` (the `filter` before `map`).

This explains dynamo's `from_session`, `urgency_level`, `message_type` naming convention.

---

## Finding 2: Message Wrapping Function (A4_)

Binary offset 9985686:

```javascript
function A4_(H, _, q) {
  let K = Object.entries(q ?? {})
    .filter(([O]) => nz5.test(O))
    .map(([O, T]) => ` ${O}="${f5(T)}"`)
    .join("");
  return `<${DWH} source="${f5(H)}"${K}>\n${_}\n</${DWH}>`;
}
```

Where `DWH = "channel"` and `f5()` is XML escape. Output format:

```xml
<channel source="wire" from_session="abc" message_type="text">
message content here
</channel>
```

The `source` attribute is always the MCP server name. Additional meta becomes attributes.

---

## Finding 3: Prompt Injection Path (Confirmed)

All three call sites for `A4_()` (offsets 9993657, 12673976, 12674745) follow the same pattern:

```javascript
vD({
  mode: "prompt",
  value: A4_(serverName, content, meta),
  priority: "next",
  isMeta: true,
  origin: { kind: "channel", server: serverName },
  skipSlashCommands: true
})
```

- **priority: "next"** — lands as the next message in conversation (priority 1, behind "now"=0)
- **isMeta: true** — marked as meta/system content
- **origin.kind: "channel"** — classified as channel origin for routing
- **skipSlashCommands: true** — channel messages bypass slash command processing

---

## Finding 4: Channel Server Registration Flow

### Initial Registration (Three Paths)

1. **Stdio MCP server connection** (offset 9993500) — when a new MCP server connects,
   `z4_()` gate is checked. If action is "register", the notification handler is installed.

2. **Plugin loaded connection** (offset 12673900) — plugin-loaded servers follow a
   separate path through the plugin manager but same notification handler pattern.

3. **Reconnection handler** (`uf8`, offset 12674030) — if a connected server reconnects
   (e.g., after temporary disconnect), `uf8()` re-registers the notification handler
   automatically. Only fires for servers that pass the gate.

All three paths end identically: `client.setNotificationHandler($4_(), async handler)`.

### What This Means for Wire

Our MCP server just needs to:
1. Declare `experimental: { 'claude/channel': {} }` in capabilities
2. Connect via StdioServerTransport
3. CC does the rest — installs the handler, wraps messages, injects into prompt queue

No binary patching needed for the transport layer.

---

## Finding 5: Gate Bypass Strategy

`z4_()` (gateChannelServer) has 6 layers. For Wire:

| Layer | Gate | Our Strategy |
|-------|------|-------------|
| 1. Capability | Server declares `claude/channel` | We control this |
| 2. Feature flag | `vMH()` → `tengu_harbor` | Currently True, monitor |
| 3. Auth | `Tq()?.accessToken` | Requires `/login` — document |
| 4. Org policy | `channelsEnabled` | N/A for individuals |
| 5. Session list | `ew()` → `--channels` | Shim passes `--channels wire` |
| 6. Allowlist | Ledger or org policy | `--dangerously-load-development-channels` bypasses |

The `--dangerously-load-development-channels` flag bypasses layer 6 entirely. For
layer 5, the session must be launched with `--channels wire` (or whatever our server
name is). Our governance shim (`claude-governance launch`) already wraps CC — adding
these flags is trivial.

### Dev Mode Detection

`$.dev` is true for servers loaded with `--dangerously-load-development-channels`.
Dev servers skip the allowlist check entirely. This is our primary development path.

---

## Finding 6: fakechat Reference Analysis (268 lines)

[fakechat1] is Anthropic's canonical channel plugin.

### Architecture

```
fakechat/server.ts (268 lines)
  ├── MCP Server with claude/channel capability
  ├── Two tools: reply, edit_message
  ├── deliver() function → mcp.notification()
  ├── Bun.serve HTTP+WebSocket for web UI
  └── instructions field teaches Claude how to reply
```

### Key Patterns

**Capability declaration:**
```javascript
capabilities: { tools: {}, experimental: { 'claude/channel': {} } }
```

**Instructions (critical — this is how Claude learns to use the channel):**
```
"The sender reads the fakechat UI, not this session. Anything you want them to
see must go through the reply tool — your transcript output never reaches the UI.
Messages from the fakechat web UI arrive as <channel source=\"fakechat\" ...>.
Reply with the reply tool."
```

**Notification emission (inbound to Claude):**
```javascript
mcp.notification({
  method: 'notifications/claude/channel',
  params: {
    content: text,
    meta: { chat_id: 'web', message_id: id, user: 'web', ts: isoString }
  }
})
```

**Tool response format (outbound from Claude):**
```javascript
return { content: [{ type: 'text', text: 'sent (m123)' }] }
```

### What to Port

- MCP server setup with `@modelcontextprotocol/sdk`
- Capability declaration pattern
- Instructions pattern (adapted for Wire — teach Claude about sessions, not chat UI)
- Notification emission pattern
- Tool response format

### What NOT to Port

- Bun.serve web UI (Wire has no web UI in 3.5a)
- File upload/download (not in scope)
- WebSocket client management (Wire uses relay, not direct WS)

---

## Finding 7: dynamo Wire Source Analysis (2526 lines, 10 files)

[dynamoWire] is the existing Wire implementation from another project. Selectively
port — don't copy wholesale.

### Component Assessment for 3.5a

| Component | Lines | Port to 3.5a? | Notes |
|-----------|-------|---------------|-------|
| `protocol.cjs` | 128 | **YES** | Typed envelopes, message types, validation |
| `channel-server.cjs` | 367 | **PARTIAL** | MCP server pattern — adapt to simpler fakechat style |
| `registry.cjs` | 238 | **NO (3.5b)** | Session registry — separate phase |
| `queue.cjs` | 141 | **NO (3.5b)** | Priority queue — separate phase |
| `transport.cjs` | 184 | **NO (3.5b)** | Transport router — separate phase |
| `relay-server.cjs` | 315 | **NO (3.5b)** | HTTP relay — separate phase |
| `wire.cjs` | 429 | **NO (3.5b+)** | Main composition — after subcomponents exist |
| `write-coordinator.cjs` | 413 | **NO** | Ledger write serialization — not in scope |
| `channels-transport.cjs` | 102 | **REFERENCE** | Shows notification emission pattern |
| `relay-transport.cjs` | 209 | **NO (3.5b)** | HTTP transport — separate phase |

### Key Patterns to Adopt

**Typed envelopes (protocol.cjs):**
```javascript
{ id, from, to, type, urgency, payload, timestamp, correlationId }
```
Message types: context-injection, directive, recall-product, sublimation, write-intent,
snapshot, heartbeat, ack. Urgency: background, active, directive, urgent.

**Meta key naming:**
Use underscores, not hyphens. Validated by binary regex `nz5`.

### Patterns to Simplify for 3.5a

dynamo's channel-server polls a relay via HTTP. For 3.5a, Wire's MCP server only
needs direct notification emission — no relay, no polling. The relay comes in 3.5b.

dynamo uses `ok()/err()/createContract()` from its own lib. We use plain return
values and throw/catch, matching our existing tool patterns.

---

## Finding 8: Server Packaging and Registration

### How MCP Servers Are Loaded

CC loads MCP servers from three sources:
1. **`.mcp.json`** in the project directory — per-project servers
2. **`~/.claude/settings.json`** mcpServers section — global servers
3. **`--channels` CLI flag** — explicitly named servers for channel capability

For Wire to be a channel server, it must:
1. Be listed in `.mcp.json` or `settings.json` as an MCP server
2. Be named in `--channels wire` at session launch
3. OR: use `--dangerously-load-development-channels` to bypass the allowlist

### Packaging Decision

**TypeScript, built to CJS** — same as our existing tools (Ping, REPL, Tungsten).
The MCP server runs as a stdio process spawned by CC. It needs:
- A single entry point CJS file
- `@modelcontextprotocol/sdk` as a dependency (npm package, bundled)
- Stdio transport (stdin/stdout for MCP protocol)

### Build Pipeline

Our existing `tsdown` pipeline handles this. Wire server goes in `src/tools/wire/`
alongside the other tools, builds to `data/tools/wire-server.js` (or similar).

But there's a key difference: **Wire is an MCP server, not a CC tool.** Our tools
(Ping, REPL, Tungsten) are loaded into CC's tool registry via the `getAllBaseTools()`
patch. Wire is loaded as an external MCP server via `.mcp.json` and `--channels`.

This means Wire needs its own build artifact that can run as a standalone process,
separate from the tools bundle. The governance shim must configure the MCP server
entry in settings and pass the right flags.

---

## Key Decisions for Planning

### D-01: Server Language
**TypeScript, built to CJS via tsdown.** Same toolchain as existing tools. The MCP
SDK has TypeScript types. fakechat uses TS.

### D-02: Protocol Subset
Port `protocol.cjs` envelope types and validation. Simplify message types for Wire's
use case (don't need write-intent, sublimation, etc. from dynamo).

### D-03: Packaging Model
Wire MCP server is a standalone CJS entry point. Registered in `.mcp.json` or
`settings.json` with the appropriate command. Governance shim adds `--channels wire`
and `--dangerously-load-development-channels` to launch flags.

### D-04: Relay in 3.5a?
**No.** 3.5a is the channel server only — bidirectional messaging between one Wire
server instance and its CC session. Cross-session routing (relay) is 3.5b.

### D-05: Tool Surface
Minimum for 3.5a:
- `wire_send` — send a message (triggers notification on the receiving end)
- `wire_status` — check connection status

More tools (wire_discover, wire_register, etc.) come with 3.5b registry.

### D-06: Instructions Text
Adapt fakechat's instructions pattern: "Messages from other sessions arrive as
`<channel source="wire" ...>`. Reply using the wire_send tool. Your transcript
output does not reach other sessions."

---

## Open Questions (Carry to Planning)

1. **Bundling the MCP SDK**: `@modelcontextprotocol/sdk` needs to be available at
   runtime. Options: bundle it into the CJS output (tsdown can do this), or declare
   it as a dependency of the npm package and resolve from node_modules.

2. **Process lifecycle**: The MCP server runs as a child process of CC. Who starts it?
   CC spawns it based on `.mcp.json` config. Who stops it? CC kills it on session end.
   Do we need a cleanup hook?

3. **Testing strategy**: fakechat uses Bun.serve for a test UI. For Wire in 3.5a,
   testing means: launch CC with `--channels wire`, send a message via tool, verify
   the notification arrives. The relay (3.5b) enables actual cross-session testing.

4. **Configuration**: Where does Wire server config live? `~/.claude-governance/config.json`
   has our governance config. The MCP server entry goes in `~/.claude/settings.json`
   or project `.mcp.json`. These are different files with different purposes.

---

## References

- [fakechat1] — Anthropic's canonical channel plugin reference
- [channelsRef1] — Official channels API reference docs
- [dynamoWire] — dynamo Wire implementation (port source)
- Binary offsets verified against `native-claudejs-patched.js` (CC 2.1.101)
