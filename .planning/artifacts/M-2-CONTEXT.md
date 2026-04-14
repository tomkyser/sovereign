# Milestone 2 Context — Native Tool Injection

**READ THIS FIRST.** Shared context for all agents working on Milestone 2.

## What We're Building

Clean-room implementations of ant-only tools (REPL, Tungsten), injected into CC's tool registry via binary patching. Users get the tools that Anthropic restricts to internal use.

**Location:** `/Users/tom.kyser/dev/claude-code-patches/claude-governance/`
**Build:** `pnpm build` → 163KB | **Verify:** `node dist/index.mjs check` → 19/19 SOVEREIGN
**CC Version:** 2.1.101 (native, arm64-darwin, pinned via DISABLE_AUTOUPDATER=1)

## Current State

| Phase | Status |
|-------|--------|
| 2a: Tool Injection Mechanism | COMPLETE |
| 2a-gaps: Tool Injection Hardening | COMPLETE — 12/12 gaps, 15/15 SOVEREIGN |
| 2b: Clean-Room REPL | COMPLETE — auto-discovery loader, 9 handlers, coexist/replace modes |
| 2b-gaps: REPL Hardening + Functional Verification | COMPLETE — 14/14 gaps + 2 post-testing fixes |
| 2b-gaps-2: Production Readiness | COMPLETE — G15 already working (F18), G9/G11 prompt effectiveness verified |
| 2b-gaps-3: REPL Coexist Hardening | COMPLETE — 8/8 gaps + replace mode. Glob fix, mode-aware prompts, verified Sonnet single-prompt dashboard |
| 2c: Clean-Room Tungsten | COMPLETE — 6 deliverables, 19/19 SOVEREIGN |
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

## Phase 2c Research Findings (from session 2026-04-13-b)

**Binary state of Tungsten infrastructure:**
- TungstenTool implementation: fully DCE'd (zero occurrences of "Tungsten" or "Tmux" as tool name)
- tmuxSocket.ts functions: all DCE'd (hasTmuxToolBeenUsed, ensureSocketInitialized, markTmuxToolUsed, getClaudeTmuxEnv)
- `FS9()` = getClaudeTmuxEnv stub: `function FS9(){return null}` — bashProvider plumbing intact, calls FS9() and sets TMUX env if non-null
- TungstenLiveMonitor + AppState fields + footer pill: all DCE'd
- Render tree injection point: `!1,null` at offset 11998161, unique signature `cn7(O_)))),!1,null,b_.createElement(m,{flexGrow:1})`
- useAppState hook (Y_): survives, Zustand-like via useSyncExternalStore
- React (b_), Box (m), Text (L): survive and accessible at injection point
- Agent swarm tmux code: survives (separate from Tungsten)

**Minified symbol map (Tungsten-related):**

| Symbol | Minified | Notes |
|--------|----------|-------|
| getClaudeTmuxEnv | `FS9()` | Stubbed to `return null` — patch target |
| useAppState | `Y_()` | Zustand-like selector hook |
| React | `b_` | createElement, Fragment, etc. |
| Box (Ink) | `m` | Layout component |
| SpinnerWithVerb | `I67` | After the injection point |
| toolJSX | `I9` | Tool output rendering variable |

**6 deliverables scoped:**
1. D1: `tungsten.js` — persistent execution context tool (6 actions)
2. D2: FS9() binary patch — bashProvider tmux activation
3. D3: Render tree injection — `!1,null` → panel component createElement
4. D4: `tungsten-panel.js` — clean-room live monitor component
5. D5: Statusline TNG segment + state file + cleanup hooks
6. D6: REPL prompt update — Tungsten awareness

**REPL agent() verified:** Smoke test passed. Delegates to native Agent tool via stash, returns result.

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
