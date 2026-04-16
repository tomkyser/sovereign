# M-3.5 Wire — Phase Context

Last updated: 2026-04-16

## Status: Phases 3.5a-c COMPLETE — Phase 3.5d PLANNING COMPLETE, ready for ACT

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

### Wire Architecture (finalized after 3.5b)
1. **MCP Server** — declares `claude/channel`, sends notifications inbound, exposes tools outbound
2. **HTTP Relay** — standalone Node.js server, routes messages between MCP servers via long-poll
3. **Registry** — session tracking with TTL disconnect buffering (inside relay)
4. **Priority Queue** — urgency-based message ordering (inside relay mailboxes)
5. **Relay Client** — fetch-based HTTP client in each MCP server process
6. **Relay Lifecycle** — auto-start, PID coordination, health check
7. **Prompt/Hook/Skill layer** — teaches model to use Wire (3.5c-3.5e)

### GrowthBook Risk
`cachedGrowthBookFeatures` is synced from Anthropic's server on bootstrap.
`tengu_harbor: True` could be overwritten if Anthropic disables it.
Our PATCH 12 only protects `clientDataCache`, not `cachedGrowthBookFeatures`.
May need future protection if Anthropic reverts.

### Binary-Confirmed Details (from 3.5a research)
- **Notification schema**: `{ method: "notifications/claude/channel", params: { content: string, meta?: Record<string, string> } }`
- **Meta key regex**: `/^[a-zA-Z_][a-zA-Z0-9_]*$/` — underscores only, no hyphens
- **Gate bypass**: `--channels wire` + `--dangerously-load-development-channels`

## Open Questions
See 3.5a RESEARCH.md "Open Questions" section

## Dynamo Source Location
`/Users/tom.kyser/Library/Mobile Documents/com~apple~CloudDocs/dev/dynamo/core/services/wire/`
