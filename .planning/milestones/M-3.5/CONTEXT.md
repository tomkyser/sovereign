# M-3.5 Wire — Phase Context

Last updated: 2026-04-15

## Status: Research Phase

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

### Wire Architecture (revised from dynamo)
Wire becomes a multi-component integration:
1. **MCP Server** — declares `claude/channel`, receives from relay, pushes to session
2. **Injected Tool** — session calls tool to send messages outbound
3. **Relay Server** — localhost HTTP, routes between Wire MCP servers
4. **Registry** — port from dynamo, session discovery + capabilities
5. **Prompt/Hook/Skill layer** — teaches model to use Wire

### GrowthBook Risk
`cachedGrowthBookFeatures` is synced from Anthropic's server on bootstrap.
`tengu_harbor: True` could be overwritten if Anthropic disables it.
Our PATCH 12 only protects `clientDataCache`, not `cachedGrowthBookFeatures`.
May need future protection if Anthropic reverts.

## Open Questions
See RESEARCH.md "Open Questions for Phase Planning"

## Dynamo Source Location
`/Users/tom.kyser/Library/Mobile Documents/com~apple~CloudDocs/dev/dynamo/core/services/wire/`
