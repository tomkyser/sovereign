# Milestone 2 Context — Native Tool Injection

**READ THIS FIRST.** Shared context for all agents working on Milestone 2.

## What We're Building

Clean-room implementations of ant-only tools (REPL, Tungsten), injected into CC's tool registry via binary patching. Users get the tools that Anthropic restricts to internal use.

**Location:** `/Users/tom.kyser/dev/claude-code-patches/claude-governance/`
**Build:** `pnpm build` → 145KB | **Verify:** `node dist/index.mjs check` → 14/14 SOVEREIGN
**CC Version:** 2.1.101 (native, arm64-darwin, pinned via DISABLE_AUTOUPDATER=1)

## Current State

| Phase | Status |
|-------|--------|
| 2a: Tool Injection Mechanism | COMPLETE |
| 2a-gaps: Tool Injection Hardening | NEXT — 7 gaps (4 high, 2 medium, 1 low) |
| 2b: Clean-Room REPL | Blocked on 2a-gaps |
| 2c: Clean-Room Tungsten | Planned |
| 2d: Context Snipping Tool | Planned |

## Binary Vault (NEW — from 2a-gaps)

Virgin binaries stored at `~/.claude-governance/binaries/virgin-{version}.bin`. Immutable, verified at download time. All operations work on copies made with `/bin/cp` (NOT Node.js `fs`).

**Critical discovery:** Node.js v24 `fs.copyFile()` / `fs.writeFile()` corrupts Mach-O binaries — replaces non-UTF-8 bytes with U+FFFD, bloating 201MB → 304MB. Shell `/bin/cp` is binary-safe.

**Apply workaround:** Pre-create `~/.claude-governance/native-binary.backup` with `/bin/cp` from virgin before running apply. Apply finds existing backup, skips creating one (avoids `fs.copyFile` corruption).

**GCS download URL:** `https://storage.googleapis.com/claude-code-dist-86c565f3-f756-42ad-8dfa-d59b1c096819/claude-code-releases/{version}/darwin-arm64/claude`

## What's Working (Phase 2a)

**Tool injection patch** — `getAllBaseTools()` (minified `Ut()`) is patched to load external tools from `~/.claude-governance/tools/index.js` at runtime. The loader:
- Reads tools via `require()` — hot-reloadable without re-patching
- Fills TOOL_DEFAULTS for missing methods
- Tools use `inputJSONSchema` (standard JSON Schema, no Zod)
- Silent failure on missing tools dir

**Transparent claude shim** — `~/.claude-governance/bin/claude` wraps every `claude` invocation through `claude-governance launch` for governance pre-flight. All args pass through.

**Sample Ping tool** deployed at `~/.claude-governance/tools/index.js` for runtime testing. Not yet verified in a live CC session.

## Tool Injection Contract

External tools must provide at minimum:
```javascript
{
  name: 'ToolName',
  inputJSONSchema: { type: 'object', properties: {...}, required: [...] },
  async prompt() { return 'Description for the model' },
  async description() { return 'One-line description' },
  async call(args, context) { return { data: 'result' } },
}
```

The `call()` function receives:
- `args` — parsed input matching the JSON schema
- `context` — ToolUseContext with `abortController`, `getAppState()`, `messages`, `options.tools`

Return `{ data: string }` for simple text results. The loader provides defaults for all other methods.

## Key Files (claude-governance/)

| File | Purpose |
|------|---------|
| `src/patches/governance.ts` | All patches incl. `writeToolInjection()` |
| `src/patches/index.ts` | Patch orchestrator + definitions |
| `src/shim.ts` | Claude wrapper shim generator |
| `src/setup.ts` | First-run wizard with shim + module setup |
| `src/modules/` | Module system — types, registry, core, env-flags |
| `src/verification.ts` | Verification API — 14 entries |
| `~/.claude-governance/tools/index.js` | External tool definitions (user space) |

## Minified Binary Map (v2.1.101)

| Symbol | Minified | Notes |
|--------|----------|-------|
| getAllBaseTools | `Ut()` | Patched — loads external tools |
| buildTool | `lq()` | Tool factory |
| TOOL_DEFAULTS | `LE4` | Default methods |
| getTools | `xW()` | Permission filtering |
| MCPTool base | `Kc6` | MCP tool template |
| REPL gate | `qS()` | Returns false (dead code) |
| REPL var | `jn_` | Always null in external build |

## Design Specs

- REPL: `/Users/tom.kyser/dev/claude-code-patches/specs/repl-clean-room.md`
- Tungsten: `/Users/tom.kyser/dev/claude-code-patches/specs/tungsten-clean-room.md`

## External References

- CC leaked source: `/Users/tom.kyser/dev/cc-source/`
- Tool.ts (types): `cc-source/.../src/Tool.ts`
- tools.ts (registry): `cc-source/.../src/tools.ts`
- MCP tool creation: `cc-source/.../src/services/mcp/client.ts`
