# M-3.5 Wire — Phase Context

Last updated: 2026-04-15

## Status: Phase 3.5a — Research COMPLETE, Planning next

## Key Discoveries

### Channels API is the viable transport
- `tengu_harbor` is True on this machine — Channels API is LIVE
- MCP servers declare `experimental["claude/channel"]` capability
- Inbound messages arrive via `notifications/claude/channel` → enqueued as next prompt
- Message wrapped in `<channel source="...">` XML tag
- No binary patching needed for transport itself

### UDS Inbox is fully DCE'd
- `feature('UDS_INBOX')`, `cross-session-message`, `ListPeers`, `COORDINATOR_MODE` — all gone
- SendMessage tool exists but only routes to in-process teammates, not cross-session
- `uds:` scheme remnant at one offset but no implementation behind it

### MCP Server Registration Model
- Plugins declare MCP servers in `.mcp.json` (e.g., claude-mem's `mcp-search`)
- `--channels server:name` or `--dangerously-load-development-channels` enables channel notifications
- Our governance shim (`claude-governance launch`) can pass `--dangerously-load-development-channels`

### Wire Architecture (revised after channels reference + fakechat analysis)
Wire is one MCP server per session, handling both directions:
1. **MCP Server** — declares `claude/channel`, sends notifications inbound, exposes reply tools outbound
2. **Relay/Router** — routes messages between Wire MCP servers (for cross-session)
3. **Registry** — port from dynamo, session discovery + capabilities
4. **Prompt/Hook/Skill layer** — teaches model to use Wire

Key correction: Channels API is BIDIRECTIONAL. Server exposes MCP tools for outbound
(Claude calls `reply` tool), sends notifications for inbound. No separate injected
tool needed. See [fakechat1] reference implementation.

### GrowthBook Risk
`cachedGrowthBookFeatures` is synced from Anthropic's server on bootstrap.
`tengu_harbor: True` could be overwritten if Anthropic disables it.
Our PATCH 12 only protects `clientDataCache`, not `cachedGrowthBookFeatures`.
May need future protection if Anthropic reverts.

### Binary-Confirmed Details (from 3.5a research)
- **Notification schema ($4_)**: `{ method: "notifications/claude/channel", params: { content: string, meta?: Record<string, string> } }`
- **Meta key regex (nz5)**: `/^[a-zA-Z_][a-zA-Z0-9_]*$/` — underscores only, no hyphens
- **Three notification handler registration paths** in binary — all identical behavior
- **Reconnection handler (uf8)**: CC auto-re-registers channel handlers on reconnect
- **Gate bypass**: `--channels wire` + `--dangerously-load-development-channels`

## Open Questions
See 3.5a RESEARCH.md "Open Questions" section

## Dynamo Source Location
`/Users/tom.kyser/Library/Mobile Documents/com~apple~CloudDocs/dev/dynamo/core/services/wire/`
