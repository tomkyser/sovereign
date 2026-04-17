# Findings — claude-governance

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

---

## F12: "Using Your Tools" Is Runtime-Generated (2026-04-13)

**Phase:** 2b implementation | **Impact:** Replace-mode prompt override limitation

The "Using your tools" system prompt section is NOT stored in prompt data files. It's
assembled at runtime by `getUsingYourToolsSection()` in the binary JS. The pieces
matching pipeline (which works against prompt data) cannot target it.

This means a replace-mode prompt override (replacing "Using your tools" with minimal
REPL-only guidance, as Ant does) would require a binary-level patch of that function,
not a data-level prompt override.

**Current workaround:** In replace mode, primitives are filtered from the tool registry.
CC's "Using your tools" section still references them, but the model ignores irrelevant
guidance when those tools don't exist. The REPL tool's own `prompt()` provides
comprehensive guidance. Testing confirms the model uses REPL correctly without the
prompt override.

**Future option:** Binary patch `getUsingYourToolsSection()` to detect REPL-only mode
and return minimal text. Low priority — current approach works.

---

## F13: Replace Mode Requires Tool Stashing (2026-04-13)

**Phase:** 2b gap-closing | **Impact:** Critical architectural fix

Replace mode filters primitives (Read, Write, Edit, Bash, NotebookEdit, Agent) from
`getAllBaseTools()` return array. But `context.options.tools` is built FROM that return
array — so REPL's `findTool('Read')` returns null in replace mode. The REPL can't
delegate to tools that were filtered out.

Ant's REPL avoids this because `getReplPrimitiveTools()` bypasses `getAllBaseTools()`
entirely, giving the REPL direct tool references outside the registry.

**Fix:** The binary-patched loader stashes filtered tools on the REPL tool object
(`_replTool._stashedTools = [...]`) BEFORE removing them from the array. REPL's
`findTool()` checks `selfRef._stashedTools` first, then falls back to
`context.options.tools`. This gives REPL access to tools the user can't see.

**Lesson:** When one component filters tools and another component delegates to them,
the delegation path must be considered before the filter is applied.

---

## F14: VM SyntaxError Crosses Realms (2026-04-13)

**Phase:** 2b gap-closing | **Impact:** IIFE fallback detection

`vm.runInContext` throws errors from the sandbox's V8 realm. The sandbox has its own
`SyntaxError` constructor, different from the outer Node.js realm. So `err instanceof
SyntaxError` always returns `false` for errors thrown inside the VM.

**Fix:** Use `err.name === 'SyntaxError'` (string-based check) instead of `instanceof`.
This is a well-known VM gotcha that applies to all error types across realm boundaries.

---

## F15: IIFE Wrapping Kills Variable Persistence (2026-04-13)

**Phase:** 2b gap-closing | **Impact:** State persistence design

Wrapping scripts in `(async () => { ${script} })()` for top-level `await` support
creates a function scope. All `const`, `let`, and `var` declarations inside the IIFE
are local to that function — they never touch the VM context and don't persist.

Only bare assignments (`x = 42`) persist in an IIFE because they create implicit
globals. But `const x = 42` is function-scoped and lost.

**Fix:** Two-pass execution:
1. Try running script directly (no IIFE). `var` and implicit globals persist on VM
   context. Fails with SyntaxError if script uses `await` or `return`.
2. On SyntaxError, fall back to IIFE wrapper. Variables don't persist but `await`
   and `return` work.
3. `state` object always persists (it's on the VM context, not in the script scope).

**Lesson:** Any VM-based REPL that wraps for async support must explicitly address
the persistence trade-off. The Ant REPL likely handles this — worth investigating
if their approach is better.

---

## F16: WebFetch Returns AI-Processed Content (2026-04-13)

**Phase:** 2b gap-closing | **Impact:** REPL fetch handler behavior

CC's WebFetch tool does NOT return raw HTTP response bodies. It returns an object with:
- `bytes`, `code`, `codeText`, `url`, `durationMs` — metadata
- `result` — an AI-generated markdown **summary** of the response content

The raw response (e.g., JSON from httpbin.org) is transformed into a narrative
description. Users expecting `fetch()` in the REPL to behave like `node-fetch` or
browser `fetch()` will get summarized text instead of raw data.

**This is CC's design, not our bug.** But it needs documentation in the REPL prompt
and user-facing docs. Users who need raw HTTP should use `bash('curl ...')` instead.

---

## F17: parentMessage Is Load-Bearing for Tool Delegation (2026-04-13)

**Phase:** 2b-gaps testing | **Impact:** CRITICAL — Write/Edit/Read all crash without it

CC's `tool.call()` takes 4 args: `(args, context, canUseTool, parentMessage)`. The
4th arg (`parentMessage`, minified as `$`) is accessed via `$?.message.id` for file
history tracking (`FilePersistence` feature, enabled in 2.1.101).

**The trap:** When `$` is `undefined` (not passed at all), optional chaining
`$?.message.id` short-circuits entirely to `undefined` — no crash. But when `$` is
a non-null object missing `.message`, `$?.message` returns `undefined` and then
`.id` throws `TypeError: undefined is not an object`.

This means passing `{ uuid: '...' }` as parentMessage is WORSE than passing nothing.
The mock must include `{ uuid, message: { id, role, content } }` at minimum.

**Discovery:** User benchmark testing found Write and Edit completely non-functional
(crash on every call). Read also crashed after the initial fix attempt added a
parentMessage without the `message` field. Only Read, Bash, and Grep had been working
because they either don't access parentMessage or tolerate its absence.

**Lesson:** When delegating to CC tools, the call signature contract includes implicit
field requirements that only surface when specific feature flags are active. Always
test with the actual binary, not assumptions from source reading.

---

## F18: Bash Tool Shell Snapshot Shadows find/grep With Embedded Tools (2026-04-13)

**Phase:** 2b-gaps-2 (G15) | **Impact:** G15 resolved — no code changes needed

CC's Bash tool sources a "shell snapshot" (`~/.claude/shell-snapshots/snapshot-*.sh`)
before every command execution. When `EMBEDDED_SEARCH_TOOLS=1`, the snapshot contains
shell functions that shadow `find` and `grep`:

- `find` → `ARGV0=bfs "$_cc_bin" -regextype findutils-default "$@"`
- `grep` → `ARGV0=ugrep "$_cc_bin" -G --ignore-files --hidden -I --exclude-dir=.git... "$@"`

The bun binary dispatches based on argv[0], running embedded bfs 4.1 or ugrep 7.5.0.

**Why G15 was a false alarm:** REPL's `grep()` and `glob()` construct `grep`/`find`
commands and delegate to `findTool('Bash').call()`. The Bash tool sources the snapshot,
so the shell functions shadow the commands before execution. The REPL was already using
embedded tools all along — the assumption that it used system binaries was never verified.

**The `**` glob degradation** from the benchmark was a usage issue: `glob('**/*.ts')`
constructs `find ... -name "**/*.ts"` which isn't valid find/bfs syntax. The correct
pattern is `glob('*.ts', { cwd: 'dir' })` for recursive search.

**Source:** `ShellSnapshot.ts:createFindGrepShellIntegration()` generates the functions.
`bashProvider.ts:createBashShellProvider()` sources the snapshot via `createAndSaveSnapshot()`.

**Lesson:** Verify assumptions empirically before filing gaps. `type find` inside a
Bash tool call would have caught this immediately.

## F19: FS9() Is Stubbed getClaudeTmuxEnv — bashProvider Plumbing Intact (2026-04-13)

**Phase:** 2c research | **Impact:** CRITICAL — enables Tungsten environment persistence via single-function patch

In the binary, `getClaudeTmuxEnv()` is minified to `FS9()` and stubbed: `function FS9(){return null}`.
The bashProvider's `getEnvironmentOverrides()` calls it unconditionally:

```javascript
let z = FS9();        // always null (stubbed)
if (z) w.TMUX = z;   // never true — but plumbing is intact
```

The entire tmuxSocket.ts initialization chain (ensureSocketInitialized, hasTmuxToolBeenUsed,
markTmuxToolUsed, getClaudeSocketName) was DCE'd — zero occurrences. But FS9 survived as
a stub because bashProvider calls it unconditionally (not gated on USER_TYPE).

**Patch strategy:** Replace `function FS9(){return null}` with a function that reads socket
info from our Tungsten tool (e.g., process.env or temp file). Once non-null, ALL Bash commands
(including REPL's bash() delegation) inherit the tmux context automatically.

**Unique signature for patching:** The function definition is uniquely identifiable in context.

## F20: TungstenLiveMonitor DCE Left Render Tree Marker (2026-04-13)

**Phase:** 2c research | **Impact:** Enables UI component injection via binary patching

The DCE'd `{"external" === 'ant' && <TungstenLiveMonitor />}` compiled to `!1,null` in the
React children array at byte offset 11998161. Unique signature:

```
cn7(O_)))),!1,null,b_.createElement(m,{flexGrow:1})
```

This is between the tool output rendering (toolJSX/I9) and the flex spacer before the spinner.
Only 1 match in the entire 12.8MB JS file.

**Injection strategy:** Replace `!1,null` (within the unique context) with a self-executing
function that require()s our panel component and passes React primitives as props:
- b_ = React (createElement, Fragment)
- Y_ = useAppState (Zustand-like selector hook)
- m = Box (Ink layout component)
- L = Text (Ink text component)

The component renders inside the existing AppStateProvider tree, so React hooks work.
The tool writes to AppState via context.setAppState(), the component reads via useAppState.

## F21: All Tungsten AppState Fields Survive as Writable (2026-04-13)

**Phase:** 2c research | **Impact:** Tool-to-UI communication works despite DCE

The typed AppState fields (tungstenActiveSession, tungstenLastCommand, tungstenPanelVisible,
etc.) are all DCE'd as string literals — zero occurrences. But AppState is a plain JS object
at runtime. Any key can be written via context.setAppState() and read via useAppState().

The Zustand-like store (useSyncExternalStore) triggers re-renders on any state change,
regardless of which keys changed. Our tool writes, our injected component reads.

## F22: clientDataCache Is the quiet_salted_ember Activation Vector (2026-04-15)

**Phase:** P0 investigation | **Impact:** CRITICAL — unlocks 7 prompt improvements

`wJH()` gate function: `if(!L1(H).includes("opus-4-6")) return !1; return w_().clientDataCache?.quiet_salted_ember==="true"`

- `w_()` = `getGlobalConfig()` reading `~/.claude.json`
- `clientDataCache` is a top-level key in the global config, currently `{}`
- Populated by bootstrap function `ms7()` which calls Anthropic's API for `client_data`
- Server returns `null` for external users → field stays empty
- `ms7()` only writes if server data differs from cache: `Pj(O.clientDataCache,_)` (deep equal)
- Since server returns `null` and our cache would be `{quiet_salted_ember:"true"}`, `Pj(null, {...})` is false → **server overwrites our manual write on every bootstrap**
- Fix requires binary patching `ms7()` to skip the `clientDataCache` write

**Bonus:** `coral_reef_sonnet` uses identical mechanism — gates Sonnet 4.6 extended context (1M tokens).
Same function: `JZ_()` checks `w_().clientDataCache?.coral_reef_sonnet==="true"`.

---

## F23: System Prompt Assembly Order Confirmed (2026-04-15)

**Phase:** P0 investigation | **Impact:** Confirms prompt cache safety

Binary line 7868 reveals exact prompt assembly:
```
[bk5($), Ik5(), xk5(_), uk5(), mk5(w,_), gk5(_), ...xLH()?[HMH]:[], ...D]
```

- Static sections (bk5 through gk5) → BEFORE boundary
- `HMH` = `__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__`
- Dynamic array `D` (anti_verbosity, session_guidance, memory, env, etc.) → AFTER boundary

Our prompt overrides replace text within static section functions → always cached.
wJH-gated sections (Communication Style, numeric anchors) are in dynamic array D → regenerated each turn.

---

## F24: tengu_hive_evidence Absent from v2.1.101 Binary (2026-04-15)

**Phase:** P0 investigation | **Impact:** VERIFICATION_AGENT not activatable

Zero occurrences of `tengu_hive_evidence` in the 12.8M character binary JS.
`VERIFICATION_AGENT` / `verification_agent` exists only as a `querySource` string
in the streaming API client (telemetry routing), not as a feature gate.

The leaked source showed this flag, but it was either:
1. Removed before the v2.1.101 build
2. Renamed to a different flag name
3. Not yet shipped in external builds

---

## F25: Per-Tool maxResultSizeChars Limits (2026-04-15)

**Phase:** REPL-fixes | **Impact:** CRITICAL — explains all tool output truncation behavior

From leaked source `FileReadTool.ts:342`, `BashTool.tsx:424`, `AgentTool.tsx:229`:

| Tool | maxResultSizeChars | Notes |
|------|-------------------|-------|
| Read | Infinity | No output truncation — unlimited result size |
| Bash | 30,000 | Hard 30K char ceiling on stdout capture |
| Agent | 100,000 | 100K agent result cap |

The 30K Bash limit explains all observed stdout truncation. Read has no limit — the
gates are `fileReadingLimits.maxSizeBytes` (256KB) and `fileReadingLimits.maxTokens` (25K),
both overridable via context.

---

## F26: fileReadingLimits Context Override (2026-04-15)

**Phase:** REPL-fixes | **Impact:** CRITICAL — removes CC's artificial read limits

From `FileReadTool/limits.ts` and `FileReadTool.ts:502-507`:

```typescript
const { readFileState, fileReadingLimits } = context
const maxSizeBytes = fileReadingLimits?.maxSizeBytes ?? defaults.maxSizeBytes
const maxTokens = fileReadingLimits?.maxTokens ?? defaults.maxTokens
```

Both limits come from the context object passed to tool.call(). Our REPL handler
clones the context and sets `{ maxSizeBytes: 10MB, maxTokens: Infinity }`. Tested:
289KB, 1.2MB, and 3.4MB files all read in full via this override.

**Env var:** `CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS` overrides maxTokens globally.
**GrowthBook:** `tengu_amber_wren` can override both limits remotely.
**Known mismatch (line 9):** "maxSizeBytes gates on total file size, not the slice."

---

## F27: Agent canUseTool — "O is not a function" Root Cause (2026-04-15)

**Phase:** REPL-fixes | **Impact:** Fixes agents spawned from injected tools

When our REPL handler calls `Agent.call(args, context, undefined, parentMessage)`,
passing `undefined` for `canUseTool` causes the subagent's tool execution loop
(`toolExecution.ts:1207`) to crash when invoking any tool. The minified parameter
`O` is `canUseTool`, and `O(...)` on undefined throws "O is not a function."

**Fix:** Pass a permissive callback: `async (_tool, input) => ({ behavior: 'allow',
updatedInput: input, decisionReason: { type: 'mode', mode: 'bypassPermissions' } })`.

Leaked source context: `AgentTool.tsx:606-627` shows fork-path vs non-fork-path tool
inheritance. Non-fork path calls `assembleToolPool()` fresh. Fork path inherits
parent's `toolUseContext.options.tools` directly. The `canUseTool` callback is threaded
through both paths and must be a callable function.

---

## F28: Agent Result Structure — content[0].text Extraction (2026-04-15)

**Phase:** REPL-fixes | **Impact:** Fixes agent() return values in REPL

CC's Agent tool returns: `{ status, content: [{type: "text", text: "..."}], totalTokens, ... }`
as a JSON-serialized string in `result.data`. Our original handler returned this raw JSON.
Fix: parse the JSON string, extract `content[0].text` for each text block, join with newlines.

---

## F29: ms7() Bootstrap Patch Unlocks 12 Issues (2026-04-15)

**Phase:** 3a | **Impact:** CRITICAL — highest-leverage single patch in the project

`ms7()` is the bootstrap function at offset 12007569 that calls `ip5()` (API fetch to
`/api/claude_cli/bootstrap`). For external users, the server returns `client_data: null`,
which ms7() writes to `~/.claude.json`'s `clientDataCache` field, destroying any manually-set values.

**Patch (PATCH 12):** Three surgical removals from ms7():
1. `let _=H.client_data??null,` — dead variable removed
2. `Pj(O.clientDataCache,_)&&` — comparison removed from deep-equal chain
3. `clientDataCache:_,` — field removed from p_() config write callback

This preserves `additionalModelOptionsCache` and `additionalModelCostsCache` writes while
leaving `clientDataCache` untouched. Combined with writing `{quiet_salted_ember:"true",
coral_reef_sonnet:"true"}` to `~/.claude.json` during `apply`, this unlocks:

- 7 wJH-gated prompt sections (Communication Style, numeric anchors, comment discipline,
  exploratory questions, condensed Doing tasks, condensed Using your tools, session guidance)
- coral_reef_sonnet (Sonnet 4.6 1M context window)
- Issues resolved: I-040, I-054, I-001, I-051, I-052, I-053, I-091 (via wJH activation)
  + I-003, I-004, I-005, I-092, I-094 (via P1 prompt overrides in same phase)

**Unique patterns for detection:**
- `Pj(*.clientDataCache,*)&&Pj(*.additionalModelOptionsCache,*)` — the triple Pj chain
- `clientDataCache:*,additionalModelOptionsCache:*,additionalModelCostsCache:*` — the p_ write
- Both are unique in the entire 12.8M character binary

---

--- OLD FINDINGS FROM CLAUDE.md refactor: ---

- **EMBEDDED_SEARCH_TOOLS**: Single env var activates bfs/ugrep/rg already compiled into
  every native CC binary. 14 callsites respond. No brew install needed.
- **Compile-time flags**: 90 flags via `bun:bundle`. 14 enabled in 2.1.101 external build
  including Monitor, Kairos, WebBrowser, UltraPlan, VoiceMode, FilePersistence.
- **Runtime flags**: ~70+ `tengu_*` flags in `~/.claude.json`. Both code branches ship in
  binary. Override via disk cache manipulation (startup window) or binary patching.
- **Ant-only tools**: REPL, Tungsten, Config gated by build-time USER_TYPE define.
  Implementations stripped from external binary. Require clean-room reimplementation.
- **The disclaimer**: `prependUserContext` wraps CLAUDE.md in system-reminder tags with
  dismissive framing. Patched by governance engine.
- **Subagent CLAUDE.md stripping**: `tengu_slim_subagent_claudemd` defaults true. Patched.
- **output-efficiency prompt**: Removed by Anthropic in CC 2.1.100, replaced by
  communication-style prompt.

## F30: Channel Dialog Bypass — OAuth Gate Analysis (2026-04-16)

**Phase:** 3.5c | **Impact:** CRITICAL — required binary patch for Wire to work for all users

The dev channel loading path: `if(!isChannelsEnabled() || !getClaudeAIOAuthTokens()?.accessToken)` → auto-accept, else show dialog.

- `isChannelsEnabled()` = `E_("tengu_harbor", false)` — GrowthBook feature flag
- `getClaudeAIOAuthTokens()` reads OAuth tokens from keychain/env/credential store
- OAuth users (majority) have `accessToken` at runtime → dialog APPEARS

**PATCH 13:** Replaces entire if/else block (288 chars) with auto-accept call (83 chars).
Unique match. Verified in interactive session — no dialog, Wire channel active.

**Lesson:** Never trust "works on my machine" when the gate involves auth state that varies across users.

## F31: Bun Binary Bytecode Compilation and ESM→CJS Transformation (2026-04-16)

**Phase:** 3.5d P1 | **Impact:** CRITICAL — foundational for ALL native binary patching

Claude Code 2.1.101's Bun v1.3.12 binary compiles `cli.js` to bytecode. The source text
stored in the binary starts with `// @bun @bytecode @bun-cjs` and function bodies are
compiled stubs — not readable JavaScript. This prevents direct text-based patching of the
binary's embedded JS.

### Binary Structure (Verified)

| Component | Value |
|-----------|-------|
| Binary size | 201,445,232 bytes (191MB Mach-O) |
| `__BUN` segment | fileOffset=70,762,496, fileSize=128,876,544 |
| Section header | u64 (8 bytes) containing bun data size |
| Module count | 11 (6 JS + 5 native .node) |
| cli.js bytecode | 111,477,040 bytes (111MB) |
| cli.js source | 12,791,987 bytes (bytecode stubs, not interpretable) |

### Module Struct (52 bytes = SIZEOF_MODULE_NEW)
```
name:               {offset: u32, length: u32}  (StringPointer)
contents:           {offset: u32, length: u32}
sourcemap:          {offset: u32, length: u32}
bytecode:           {offset: u32, length: u32}
moduleInfo:         {offset: u32, length: u32}
bytecodeOriginPath: {offset: u32, length: u32}
encoding:           u8  (0=source, 1=bytecode)
loader:             u8  (1=JS, 10=native)
moduleFormat:       u8  (0=CJS, 2=ESM)
side:               u8  (0=main, 1=side-loaded)
```

### Three-Layer Incompatibility

1. **Bytecode stubs** are not interpretable JS — clearing bytecode + encoding=0 crashes
2. **npm cli.js is ESM** — 753 static imports, 67 default imports, 12 import.meta, 6 TLA
3. **ESM ↔ CJS** — ESM import/export is top-level-only syntax, invalid in function bodies

### Solution: esbuild ESM→CJS + Raw Overwrite

`npx esbuild cli.js --bundle --format=cjs --platform=node` converts all ESM syntax to
CJS `require()` calls. The output is wrapped in Bun's CJS function wrapper and repacked.
esbuild's empty `var import_meta = {};` stub is replaced with a proper URL polyfill.
LIEF's Mach-O `section.content =` is silently ignored — raw binary overwrite at the known
file offset bypasses this bug.

### Critical Notes for Future Sessions

- **Pattern migration required**: esbuild-bundled CJS has fundamentally different variable
  names, statement ordering, and structure from Bun's minified output. Every regex pattern
  must be re-derived against the new code.
- **esbuild version sensitivity**: Variable names in esbuild output may change between
  versions. Patterns should match structural features (function signatures, string literals,
  API calls) rather than generated identifiers.
- **npm package availability**: This approach requires the npm package for the exact CC
  version to be available on the npm registry. If Anthropic stops publishing to npm, an
  alternative source is needed.
- **Section header preserved**: The Mach-O section metadata still says 128MB after raw
  overwrite. The `hasBunTrailerAt()` validation function handles zero-padded sections.

### LIEF Mach-O Writer Bug

`bunSection.content = newData` is silently ignored for Mach-O binaries unless
`extendSegment()` is called first (even if the data is shrinking). This is a confirmed
LIEF bug. The raw overwrite path (`readFileSync` → buffer copy → `writeFileSync`)
bypasses LIEF's writer entirely and is reliable for both shrinking and same-size data.


### F33: Tool userFacingName empty string (2026-04-16, session i)
CC assigns `userFacingName: () => ""` as default for custom tools. Loader fallback
`if(!_t.userFacingName)` doesn't trigger. Must set explicitly on each tool.

### F34: React refs .default resolution for esbuild CJS (2026-04-16, session i)
`require("react")` in esbuild CJS returns module object, not React namespace.
`createElement` is at `.default.createElement`. Fix: `_govR.default || _govR`.

## F32: "type": "prompt" Hooks Use Separate Haiku Model
**Discovered:** 2026-04-17 (M-3.75 P1/P2)
**Impact:** All RALPH hooks must use `"type": "command"` with `additionalContext`

CC's `"type": "prompt"` hooks send the prompt text to a **separate small model
(Haiku by default)** for yes/no evaluation. They are designed for permission
decisions, not reasoning scaffolds. Only available for PreToolUse, PostToolUse,
and PermissionRequest events.

For injecting text into the main model's conversation context, use
`"type": "command"` hooks that output JSON with
`hookSpecificOutput.additionalContext`. This creates a `hook_additional_context`
message that gets injected alongside the user's prompt.

## F33: UserPromptSubmit Hook additionalContext Injection Path
**Discovered:** 2026-04-17 (M-3.75 P1)
**Impact:** Confirmed mechanism for Layer 0 cognitive redirect

The `executeUserPromptSubmitHooks` function (i$7) fires for all prompt types.
When a command hook returns `hookSpecificOutput.additionalContext`, CC creates
a `hook_additional_context` message via H4() and pushes it into the conversation
messages array. This is the same mechanism used by SessionStart hooks.

## F34: Model Reliably Follows HALT/END/HERE/DELTA When Scaffolded
**Discovered:** 2026-04-17 (M-3.75 P1-P2)
**Impact:** Core RALPH hypothesis validated

When the cognitive redirect scaffold is injected via additionalContext, the model
consistently:
- Classifies Tier 1 requests and acts directly (no overhead)
- Classifies Tier 3 requests and resolves unknowns before planning
- Produces structured DELTA with [F]/[A]/[U] markers
- Asks before proceeding on complex tasks
Tested in both headless (-p) and interactive TUI modes.
