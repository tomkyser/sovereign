# Phase 2a Handoff — Tool Injection Mechanism

Written: 2026-04-12
Status: COMPLETE

## What Was Done

### Tool Injection Patch (`governance.ts`)

Patches `getAllBaseTools()` (minified as `Ut()`) in the CC binary to load external tools from `~/.claude-governance/tools/index.js` at runtime.

**How it works:**
1. `writeToolInjection()` finds `getAllBaseTools` via structural pattern matching:
   - Matches `function XX(){return[` where the function body has 10+ conditional spreads
   - This is unique to the tool registry function — no other function has that pattern
2. Wraps the return array: `var _b=[...original...]; return _b.concat(__claude_governance_tools__)`
3. Injects ~1.2KB of loader code before the array that:
   - Reads `~/.claude-governance/tools/index.js` via `require()`
   - Accepts arrays or `{default}` or `{tools}` exports
   - Fills TOOL_DEFAULTS for any missing methods on each tool object
   - Silently skips on error (missing file = no external tools, not a crash)

**Loader-provided defaults:**
- `isEnabled: () => true`
- `isConcurrencySafe: () => false`
- `isReadOnly: () => false`
- `isDestructive: () => false`
- `checkPermissions: (a) => Promise.resolve({behavior:"allow",updatedInput:a})`
- `toAutoClassifierInput: () => ""`
- `userFacingName: () => tool.name`
- `renderToolUseMessage: () => null`
- `mapToolResultToToolResultBlockParam: (content, id) => {tool_use_id, type:"tool_result", content}`
- `maxResultSizeChars: 100000`

**External tool contract (minimum viable):**
```javascript
{
  name: 'ToolName',
  inputJSONSchema: { type: 'object', properties: {...}, required: [...] },
  async prompt() { return 'Tool description for the model...' },
  async description() { return 'One-line description' },
  async call(args, context) { return { data: 'result string' } },
}
```

Tools use `inputJSONSchema` (standard JSON Schema) instead of Zod `inputSchema`, following the MCP tool pattern. This bypasses Zod entirely — the API schema conversion in `toolToAPISchema()` checks for `inputJSONSchema` first.

### Verification

- New verification entry: `tool-injection` category
- Signature: `__claude_governance_tools__` (the loader variable name)
- Check command displays "Tool Injection" section
- **14/14 SOVEREIGN** (up from 13)

### Transparent Claude Shim (pre-2a addition)

- `src/shim.ts` — generates and installs wrapper at `~/.claude-governance/bin/claude`
- Setup wizard offers shim installation + shell profile PATH injection
- `claude --resume`, `claude -p "..."`, etc. all pass through unchanged
- Commander fix: `enablePositionalOptions()` + `passThroughOptions()` on launch subcommand
- Setup writes `ccInstallationPath` to config for reliable binary detection

### Sample Tool

`~/.claude-governance/tools/index.js` — Ping tool for runtime testing:
```javascript
module.exports = [{
  name: 'Ping',
  inputJSONSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
  async prompt() { return 'Echo a message back...' },
  async description() { return 'Echo a message (governance tool injection test)' },
  async call(args) { return { data: `Ping response: ${args.message}` } },
}];
```

## Files Changed

| File | Change |
|------|--------|
| `src/patches/governance.ts` | NEW: `writeToolInjection()`, tool-injection verification entry, `tool-injection` category |
| `src/patches/index.ts` | Register tool-injection in PATCH_DEFINITIONS + implementations |
| `src/index.tsx` | Tool Injection category in check display, enablePositionalOptions, passThroughOptions |
| `src/shim.ts` | NEW: shim generator, installer, PATH management |
| `src/setup.ts` | Shim installation step, ccInstallationPath in config |

## Research Findings (informing 2b/2c)

### CC Tool Architecture
- `getAllBaseTools()` → `getTools(permissionContext)` → `assembleToolPool()` → `toolToAPISchema()` → API
- `buildTool()` merges ToolDef onto TOOL_DEFAULTS: `{ ...TOOL_DEFAULTS, userFacingName: () => def.name, ...def }`
- MCP tools bypass Zod via `inputJSONSchema` — our injected tools follow this path
- Tool `call()` receives `(args, context, canUseTool, parentMessage, onProgress?)` → returns `{ data: T }`

### Minified Binary Map (v2.1.101)
| Symbol | Minified | Byte Offset |
|--------|----------|-------------|
| getAllBaseTools | `Ut()` | 8,814,887 |
| buildTool | `lq()` | 2,968,626 |
| TOOL_DEFAULTS | `LE4` | 2,968,922 |
| getTools | `xW()` | 8,815,987 |
| MCPTool base | `Kc6` | ~5,977,200 |
| REPL gate | `qS()` | 2,979,539 (returns false) |
| REPL var | `jn_` | always null |

### Ant-Only Tool Gating
- Build-time dead code elimination: `process.env.USER_TYPE === 'ant'` branches stripped
- REPL/Tungsten implementations not in external binary — must be clean-room reimplemented
- `qS()` (REPL gate) returns `false` unconditionally in external build

## What's Next

**Phase 2b: Clean-Room REPL** — Node VM with persistent context, inner tool handlers (read/write/edit/grep/glob/bash/fetch), operation tracking. Plugs into the tool injection mechanism as an entry in `~/.claude-governance/tools/index.js`.

## Key Design Decisions

1. **Structural pattern matching over byte offsets.** The patch finds `getAllBaseTools` by matching `function XX(){return[` + 10+ conditional spreads. This survives minifier variable name changes (different CC versions may use different names for `Ut`). Byte offsets are version-specific and would break on any update.

2. **Loader fills defaults, not buildTool.** We can't call the minified `lq()` (buildTool) from injected code because we'd need to locate it by minified name. Instead, the loader inlines the TOOL_DEFAULTS logic. This is more verbose but version-independent.

3. **inputJSONSchema over inputSchema.** Using standard JSON Schema (the MCP path) means no Zod dependency in external tool code. The API schema conversion handles this natively.

4. **Silent failure on missing tools dir.** If `~/.claude-governance/tools/index.js` doesn't exist, the loader catches the error and returns an empty array. CC boots normally with base tools only.
