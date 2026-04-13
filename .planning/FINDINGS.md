# Findings — Notable Discoveries

Record significant technical discoveries, goldmine moments, and architecture-informing
findings here. These are facts that shape decisions across phases and milestones.

---

## F1: ToolUseContext Exposes Full Tool Registry (2026-04-13)

**Phase:** 2b planning | **Impact:** Eliminates need for Option A (direct fs/child_process)

When CC calls an external tool's `call(args, context)`, the `context` parameter is a
`ToolUseContext` with 31 live properties. Critical for REPL design:

**`context.options.tools`** — Array of 46 tool objects, each with callable `call()`,
`checkPermissions()`, `prompt()`, and 23 other methods. Every native tool (Read, Write,
Edit, Bash, Agent) can be found by name and invoked directly from injected code.

This means the REPL's inner tool handlers can delegate to CC's actual tools instead of
reimplementing file I/O. Permission checks, file tracking, error formatting — all free.

**Key details:**
- `context.getAppState()` / `context.setAppState()` — live session state access
- `context.abortController` — cancellation support
- `context.messages` — full conversation accessible
- `context.readFileState` — CC's file tracking
- `context.options.refreshTools` — can refresh tool list dynamically
- `context.options.mainLoopModel` — current model string
- `context.options.thinkingConfig` — thinking configuration
- `context.options.mcpClients` — MCP client references
- `context.options.agentDefinitions` — agent type definitions
- Grep/Glob are NOT in the tools array (excluded by embedded tools gate) — route through Bash
- Each tool has `inputSchema` (Zod), not `inputJSONSchema` (our injected tools have both)

**Probe method:** Modified Ping tool to inspect context, tested via `claude -p`.

---

## F2: Ant REPL Prompt Handling (2026-04-13)

**Phase:** 2b planning | **Impact:** Informs "replace primitives" mode design

From CC source (`constants/prompts.ts:269-285`):

When REPL mode is active, `getUsingYourToolsSection()` **completely replaces** the
normal "Using your tools" system prompt section. The standard guidance ("prefer
dedicated tools over Bash", "use Read instead of cat", etc.) is removed entirely.
The REPL-mode version contains only TaskCreate guidance — the REPL tool's own
`prompt()` method handles all tool usage guidance.

**How it works:**
1. `isReplModeEnabled()` checks `CLAUDE_CODE_REPL`, `CLAUDE_REPL_MODE`, or `USER_TYPE=ant`
2. `getTools()` filters out `REPL_ONLY_TOOLS` (Read, Write, Edit, Glob, Grep, Bash, NotebookEdit, Agent)
3. `getUsingYourToolsSection()` returns a minimal version with only task management guidance
4. The REPL tool's `prompt()` provides its own "how to use me" text

**Implication for us:** In "replace primitives" mode, we need to:
- Remove REPL_ONLY_TOOLS from the tool list (can do via filtering `context.options.tools`)
- Override the "Using your tools" prompt section (we already have the prompt override pipeline)
- Provide comprehensive guidance in the REPL tool's own `prompt()` method

---

## F3: EMBEDDED_SEARCH_TOOLS Activates 3 Compiled-In Binaries (2026-04-11)

**Phase:** Research | **Impact:** No external dependencies for search

Setting `EMBEDDED_SEARCH_TOOLS=1` activates bfs 4.1, ugrep 7.5.0, and rg 14.1.1 —
all already compiled into every native CC binary. 14 callsites respond. No homebrew,
no PATH manipulation, no downloads. The claude binary itself is invoked with argv[0]
rewriting to dispatch to the embedded tools.

---

## F4: Compile-Time Dead Code Elimination Pattern (2026-04-11)

**Phase:** Research | **Impact:** Ant-only tools require clean-room reimplementation

`process.env.USER_TYPE === 'ant'` branches are eliminated at compile time by Bun's
bundler. The entire REPLTool.ts, TungstenTool.ts, and ConfigTool.ts implementations
are stripped from the external binary. Only the gating functions (`isReplModeEnabled()`,
`qS()`) remain, returning false unconditionally. Clean-room reimplementation is the
only path — no binary patching can restore what was never included.

---

## F5: CC Tool Architecture Pipeline (2026-04-12)

**Phase:** 2a | **Impact:** Tool injection design

`getAllBaseTools()` → `getTools(permissionContext)` → `assembleToolPool()` → `toolToAPISchema()` → API

- `buildTool()` merges ToolDef onto TOOL_DEFAULTS
- `toolToAPISchema()` checks `inputJSONSchema` first (MCP path), then `inputSchema` (Zod)
- External tools use `inputJSONSchema` to bypass Zod entirely
- Our loader fills TOOL_DEFAULTS for missing methods

---

## F6: Binary Minification Map v2.1.101 (2026-04-12)

**Phase:** 2a | **Impact:** Reference for pattern matching

| Symbol | Minified | Notes |
|--------|----------|-------|
| getAllBaseTools | `Ut()` | Patched — loads external tools |
| buildTool | `lq()` | Tool factory |
| TOOL_DEFAULTS | `LE4` | Default methods |
| getTools | `xW()` | Permission filtering |
| MCPTool base | `Kc6` | MCP tool template |
| REPL gate | `qS()` | Returns false (dead code) |
| REPL var | `jn_` | Always null in external build |

These are version-specific. Pattern matching (not offsets) is used for resilience.

---

## F7: Glob/Grep Registry Exclusion Pattern (2026-04-13)

**Phase:** 2a-gaps (G11) | **Impact:** Verification signature

Minified pattern `jD()?[]:[nI,_v]` is uniquely the Glob/Grep exclusion gate. Only ONE
match in the entire 12.8M character binary. When `EMBEDDED_SEARCH_TOOLS=1`, Glob and
Grep are excluded from `getAllBaseTools()` and replaced by shadow functions in Bash.
Tool injection preserves this because our concat only adds external tools.

---

## F8: System Prompt Is Three Pieces (2026-04-11)

**Phase:** Research | **Impact:** Prompt override strategy

1. **Billing header** — injected by API proxy, contains subscription/usage info
2. **Static prompt** — the main system prompt, verifiable via extraction
3. **Dynamic prompt** — assembled at runtime from enabled tools, flags, session state

The static prompt is what we patch. The dynamic prompt changes based on tool
availability (which is why REPL mode changes the "Using your tools" section).

---

## F9: REPLTool.ts Not in Leaked Source (2026-04-13)

**Phase:** 2b planning | **Impact:** Confirms clean-room approach

The leaked CC source contains `REPLTool/constants.ts` and `REPLTool/primitiveTools.ts`
but NOT the actual `REPLTool.ts` implementation. The `require('./tools/REPLTool/REPLTool.js')`
in tools.ts references a file that doesn't exist in the dump. We have the interface
contracts (state shapes, tool list, gating logic) but not the implementation — which
is exactly what clean-room means.

---

## F10: Tool.call() Return Shapes (2026-04-13)

**Phase:** 2b planning | **Impact:** Defines REPL inner handler result extraction

Probed by calling native tools from injected Ping tool. All successful calls return
`{ data: <structured-object> }`. Errors **throw** (not return error objects).

### Read.call()
- **Success:** `{ data: { type: "text", file: { filePath, content, numLines, startLine, totalLines } } }`
- **Error:** Throws `Error` with descriptive message (e.g., "File does not exist")
- **With offset/limit:** Works — returns partial content with correct numLines/startLine
- **REPL extraction:** `result.data.file.content`

### Write.call()
- **Success:** `{ data: { type: "create"|"update", filePath, content, structuredPatch, originalFile } }`
- **REPL extraction:** `result.data.filePath` + `result.data.type` for confirmation

### Edit.call()
- **Success:** `{ data: { filePath, oldString, newString, originalFile, structuredPatch, userModified, replaceAll } }`
- **REPL extraction:** `result.data.filePath` for confirmation

### Bash.call()
- **Success:** `{ data: { stdout, stderr, interrupted, isImage, returnCodeInterpretation, noOutputExpected, backgroundTaskId, persistedOutputPath, persistedOutputSize, ... } }`
- **Error (non-zero exit):** Throws `wV` (minified class) with "Shell command failed"
- **REPL extraction:** `result.data.stdout` (primary), `result.data.stderr` (secondary)

### Call Signatures
- Read/Write/Edit: 4 args — `(args, context, canUseTool, parentMessage)`
- Bash/Agent: 5 args — `(args, context, canUseTool, parentMessage, onProgress)`
- We pass `(args, context)` — remaining args are optional and handled internally

### Error Pattern
Tools THROW on failure, they don't return error objects. REPL handlers must wrap
every delegation in try/catch. The error message is user-friendly (CC formats it).

### Read.call() Signature Detail (from .toString())
```javascript
async call({file_path:H, offset:_=1, limit:q=void 0, pages:K}, O, T, $)
```
The second arg `O` is context (has `readFileState`, `fileReadingLimits`). This confirms
tool.call() expects `(args, context, ...)` — our delegation pattern is correct.

---

## F11: Tool Call Delegation Pattern Confirmed (2026-04-13)

**Phase:** 2b planning | **Impact:** Validates REPL delegation architecture

The full delegation chain works:
1. CC calls our tool's `call(args, context)` 
2. Our tool calls `nativeTool.call(args, context)` — same context passthrough
3. Native tool executes with full CC infrastructure (permissions, file tracking, hooks)
4. Result returns through the same `{ data: ... }` contract
5. Errors throw and can be caught

This means REPL inner handlers are ~5 lines each: find tool, format args, call, extract
result, catch errors. No reimplementation of any CC functionality needed.
