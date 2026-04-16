# 3.5a-wire-mcp-server — Context

Last updated: 2026-04-16

## Phase Status: Research COMPLETE, Planning COMPLETE, ready for Act

## Key Findings

### Binary-Confirmed Channel API Contract
- **Notification schema**: `{ method: "notifications/claude/channel", params: { content: string, meta?: Record<string, string> } }`
- **Meta key regex**: `/^[a-zA-Z_][a-zA-Z0-9_]*$/` — underscores only, no hyphens
- **Message wrapping**: `<channel source="NAME" key="val">CONTENT</channel>`
- **Prompt injection**: `vD({mode:"prompt", priority:"next", isMeta:true, origin:{kind:"channel"}})`

### What CC Does Automatically
1. Installs notification handler on MCP server connection (if gate passes)
2. Wraps content in `<channel>` XML with meta as attributes
3. Injects into prompt queue at priority "next"
4. Re-registers handler on reconnection (uf8)
5. Validates meta keys, drops invalid ones silently

### What Wire Must Do
1. Declare `experimental: { 'claude/channel': {} }` in MCP capabilities
2. Connect via StdioServerTransport
3. Emit `notifications/claude/channel` for inbound messages
4. Expose MCP tools for outbound messages
5. Provide `instructions` text teaching Claude how to use Wire tools

### Gate Bypass Strategy
- Layer 5 (session list): Shim passes `--channels wire`
- Layer 6 (allowlist): `--dangerously-load-development-channels` bypasses
- Layer 2 (feature flag): `tengu_harbor` currently True, risk monitored
- Layer 3 (auth): Requires `/login` — document as requirement

## Decisions Made

### D-01: TypeScript + CJS (same toolchain as REPL/Tungsten/Ping)
### D-02: Port protocol.cjs envelope types, simplify message types
### D-03: Standalone CJS entry point, registered in .mcp.json/settings.json
### D-04: No relay in 3.5a — direct notification only
### D-05: Minimum tools: wire_send, wire_status
### D-06: Instructions pattern adapted from fakechat

## Planning Docs Created
- `PLANNING.md` — scope, approach, architecture, dependency strategy, risks
- `TASKS.md` — 6 tasks (T1-T6): protocol → server → tools → build → config → verify

## Interstitial: REPL allowAllModules
Between research and act, enhanced REPL tool:
- `repl.allowAllModules: true` in config unlocks all Node.js built-in modules
- `process` added to VM sandbox globals
- Tungsten guidance added to project CLAUDE.md
- All built, applied, verified 22/22 SOVEREIGN, tested via Tungsten child session

## Agent Notes
- Binary meta key regex is strict — only underscores, letters, digits
- Three code paths for notification handler registration — all identical behavior
- fakechat is 268 lines TS — Wire 3.5a should be similar scope
- REPL now has full `require('fs')` etc when `allowAllModules: true` — use native JS for binary analysis
