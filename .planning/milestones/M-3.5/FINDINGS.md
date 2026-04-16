# Milestone 3.5 Findings — Wire

Milestone-scoped discoveries. Project-level findings go to `.planning/FINDINGS.md`.

---

---

## F-3.5a-1: MCP SDK v1.29.0 Uses Newline-Delimited JSON (2026-04-16)

**Phase:** 3.5a Act | **Impact:** Transport framing for all Wire communication

The MCP SDK's `StdioServerTransport` uses `ReadBuffer` which scans for `\n` delimiters,
not Content-Length headers. Messages are `JSON.stringify(msg) + '\n'`. This is the v1.29.0
behavior — older SDK versions used Content-Length framing.

---

## F-3.5a-2: --dangerously-load-development-channels Takes Tagged Channel Names (2026-04-16)

**Phase:** 3.5a Act | **Impact:** Corrects launch flag strategy

The flag is NOT boolean. It takes space-separated tagged channel names:
`--dangerously-load-development-channels server:wire`

Without a tagged value, it consumes the next CLI argument. Passing `--dangerously-load-development-channels -p "prompt"` eats `-p` as its argument.

The `server:` prefix means "manually configured MCP server" (from .mcp.json).
The `plugin:` prefix means "plugin-provided channel" (from marketplace).

No `--channels` flag needed separately for dev channels.

---

## F-3.5a-3: Official Channels Docs Confirm Wire Architecture (2026-04-16)

**Phase:** 3.5a Act | **Impact:** Validates entire approach

`code.claude.com/docs/en/channels-reference` confirms:
- `capabilities: { experimental: { 'claude/channel': {} } }` — exact match
- `notifications/claude/channel` with `{ content, meta }` — exact match
- Meta keys: identifiers only (letters, digits, underscores) — exact match
- `instructions` field → Claude's system prompt — exact match
- Permission relay via `claude/channel/permission` capability (future use)
- Plugin packaging path for distribution

---

## F-3.5a-4: .mcp.json Must Be Project-Level for Channel Registration (2026-04-16)

**Phase:** 3.5a Act | **Impact:** Configuration strategy

`~/.claude/.mcp.json` registered the MCP server but channel matching failed with
"no MCP server configured with that name". Project-level `.mcp.json` works correctly.
The `server:wire` tag in `--dangerously-load-development-channels` matches against
MCP server names in the project config, not user-level config.
