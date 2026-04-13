# Milestone 2 Context — Native Tool Injection

**READ THIS FIRST.** Shared context for all agents working on Milestone 2.

## What We're Building

Clean-room implementations of ant-only tools (REPL, Tungsten), injected into CC's tool registry via binary patching. Users get the tools that Anthropic restricts to internal use.

**Location:** `/Users/tom.kyser/dev/claude-code-patches/claude-governance/`
**Build:** `pnpm build` → 153KB | **Verify:** `node dist/index.mjs check` → 15/15 SOVEREIGN
**CC Version:** 2.1.101 (native, arm64-darwin, pinned via DISABLE_AUTOUPDATER=1)

## Current State

| Phase | Status |
|-------|--------|
| 2a: Tool Injection Mechanism | COMPLETE |
| 2a-gaps: Tool Injection Hardening | COMPLETE — 12/12 gaps, 15/15 SOVEREIGN |
| 2b: Clean-Room REPL | COMPLETE — auto-discovery loader, 9 handlers, coexist/replace modes |
| 2b-gaps: REPL Hardening + Functional Verification | NEXT — 14 gaps (verification, handlers, execution, resilience) |
| 2c: Clean-Room Tungsten | Planned |
| 2d: Context Snipping Tool | Planned |

## Binary Vault (baked into codebase — G1+G2)

**Module:** `src/binaryVault.ts` — full vault with XDG path discovery, GCS download, SHA256 verification, cross-platform support.

**Paths (from CC's own xdg.ts):** Versions at `$XDG_DATA_HOME/claude/versions`, bin at `~/.local/bin/claude`.

**GCS:** `$BUCKET/{version}/{platform}/claude` with `manifest.json` SHA256 checksums. `$BUCKET/latest` returns current version. Platforms: `darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, `linux-x64-musl`, `win32-x64`, `win32-arm64`.

**Binary-safe ops:** `binarySafeCopy()` — `/bin/cp` (unix), `copy /b` (win32). NEVER Node.js fs for binary I/O. `installationBackup.ts` now uses this too.

**Shim failsafe (G8):** Exit code 111 = governance failed. Shim falls through to find real claude via PATH or XDG versions dir. Writes `shim-fallback.json` marker (G10) so session-start hook shows UNPROTECTED banner.

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
| `src/binaryVault.ts` | Binary vault — download, verify, lock, copy |
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

- REPL: `.planning/specs/repl-clean-room.md` (v1.0 — updated with probe findings, Option B, config modes)
- Tungsten: `.planning/specs/tungsten-clean-room.md` (v0.2 — draft)
- Findings: `.planning/FINDINGS.md` (F1-F11, architecture-informing discoveries)

## External References

- CC leaked source: `/Users/tom.kyser/dev/cc-source/collection-claude-code-source-code/claude-code-source-code/src/`
- Tool.ts (types): `cc-source/.../src/Tool.ts`
- tools.ts (registry): `cc-source/.../src/tools.ts`
- REPLTool constants: `cc-source/.../src/tools/REPLTool/constants.ts`
- REPLTool primitives: `cc-source/.../src/tools/REPLTool/primitiveTools.ts`
- Prompt assembly: `cc-source/.../src/constants/prompts.ts` (lines 269-285 = REPL prompt handling)
- MCP tool creation: `cc-source/.../src/services/mcp/client.ts`
