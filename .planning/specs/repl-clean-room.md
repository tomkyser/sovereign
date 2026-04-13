# Clean-Room REPL: Batch Operations Engine

Version: 1.0 (implementation spec)
Date: 2026-04-13
Status: Approved — ready for implementation

## Problem Statement

Claude Code's tool architecture requires one API round-trip per tool call. A task that
reads 5 files, greps 3 patterns, and edits 2 files costs 10 tool calls — 10 round-trips,
10 permission checks rendered to the user, 10 entries in context consuming tokens. This
is slow, expensive, and noisy.

Anthropic's internal REPLTool solves this by wrapping all primitive tools in a Node.js
VM. Claude writes a single JavaScript script that calls multiple tools, and the whole
thing executes in one tool invocation. The REPL implementation is stripped from external
builds via compile-time dead code elimination (`process.env.USER_TYPE === 'ant'`).

## What Ant REPL Does

Reconstructed from state shapes, tool registry, constants, comment references, and
source analysis. The actual REPLTool.ts was not in the leaked source dump (Finding F9).
Only `REPLTool/constants.ts` and `REPLTool/primitiveTools.ts` exist in the leak.

### Capabilities
- **Node.js VM sandbox**: `vm.Context` with persistent state across calls
- **Registered tool handlers**: Read, Write, Edit, Glob, Grep, Bash, NotebookEdit,
  Agent — all wrapped as async functions callable from the VM
- **Custom console**: Captures stdout/stderr into buffers, not real terminal
- **Permission delegation**: Each inner tool call goes through `canUseTool` checks
- **Transparent rendering**: `isTransparentWrapper: true` — the REPL call itself is
  invisible in the UI. Inner tool calls appear as "virtual messages" that look like
  direct tool calls.
- **Persistent state**: VM context, registered tools, console survive across turns

### State Shape (from AppStateStore.ts)
```typescript
replContext?: {
  vmContext: import('vm').Context
  registeredTools: Map<string, {
    name: string
    description: string
    schema: Record<string, unknown>
    handler: (args: Record<string, unknown>) => Promise<unknown>
  }>
  console: {
    log: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    // ... + getStdout(), getStderr(), clear()
  }
}
```

### Gating
```typescript
// constants.ts — from leaked source
export function isReplModeEnabled(): boolean {
  if (isEnvDefinedFalsy(process.env.CLAUDE_CODE_REPL)) return false
  if (isEnvTruthy(process.env.CLAUDE_REPL_MODE)) return true
  return (
    process.env.USER_TYPE === 'ant' &&
    process.env.CLAUDE_CODE_ENTRYPOINT === 'cli'
  )
}
```

### Tool Filtering (from tools.ts:314-321)
When REPL mode is active, `getTools()` filters `REPL_ONLY_TOOLS` from the tool
registry. Primitives are hidden from Claude's direct use — they're only accessible
through the REPL VM context.

```typescript
// tools.ts
export const REPL_ONLY_TOOLS = new Set([
  'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'NotebookEdit', 'Agent'
])

// In getTools():
if (isReplModeEnabled()) {
  const replEnabled = allowedTools.some(tool => toolMatchesName(tool, REPL_TOOL_NAME))
  if (replEnabled) {
    allowedTools = allowedTools.filter(tool => !REPL_ONLY_TOOLS.has(tool.name))
  }
}
```

### Prompt Handling (from prompts.ts:269-285, Finding F2)
When REPL is active, `getUsingYourToolsSection()` returns a **completely different,
minimal version**. The standard "prefer dedicated tools over Bash" / "use Read instead
of cat" guidance is removed entirely. Only TaskCreate guidance survives. The REPL
tool's own `prompt()` method provides all tool usage guidance.

```typescript
// prompts.ts
if (isReplModeEnabled()) {
  const items = [
    taskToolName ? `Break down and manage your work with the ${taskToolName} tool...` : null,
  ].filter(item => item !== null)
  if (items.length === 0) return ''
  return [`# Using your tools`, ...prependBullets(items)].join(`\n`)
}
```

### Primitive Tools (from primitiveTools.ts)
`getReplPrimitiveTools()` returns the tool objects directly — not via `getAllBaseTools()`
because that excludes Glob/Grep when `hasEmbeddedSearchTools()` is true. The REPL VM
always has access to all 8 primitive tools regardless of embedded search status.

### What Made It Valuable
1. One tool call does the work of many — massive latency reduction
2. State carries across REPL calls (variables, imports, intermediate results)
3. Complex multi-step operations become single atomic units
4. Claude can write procedural code for non-trivial tasks (loops, conditionals, error handling)

### Known Limitations
- VM escapes between inner tool calls have no security classification
- Debugging is harder (opaque JS execution vs visible tool calls)
- The whole batch fails if any inner operation throws without try/catch

---

## Our Implementation: Native Tool Injection with Tool Delegation

### Why Native Injection (Not MCP)

REPL must be a first-class native tool injected into the CC binary's tool registry.
MCP is wrong for REPL because:
- MCP runs in a separate process — it cannot call CC's internal tool handlers
- MCP cannot delegate to `canUseTool` for permission checks on inner operations
- MCP cannot use the `isTransparentWrapper` pattern for rendering inner calls
- The whole point of REPL is reducing overhead; MCP adds overhead

### Architecture Decision: Tool Delegation (Option B)

**Finding F1 confirmed:** `context.options.tools` gives us callable references to every
native tool in the CC registry. Each tool object has `call()`, `checkPermissions()`,
`prompt()`, and 23 other methods — all live, callable functions.

REPL inner handlers delegate to CC's actual tools instead of reimplementing file I/O:

```javascript
// Example: read handler
async function read(path, opts) {
  const readTool = currentContext.options.tools.find(t => t.name === 'Read');
  const result = await readTool.call({ file_path: path, ...opts }, currentContext);
  return result.data.file.content;
}
```

**This gives us for free:**
- CC's permission system (`checkPermissions` on every inner call)
- File state tracking (`readFileState` updates)
- Error formatting (user-friendly messages)
- Hook integration (all tool hooks fire on inner calls)
- Abort controller propagation

**Why not Option A (direct fs/child_process):**
- Reimplements what CC already does correctly
- Loses permission system — writes happen without user approval
- Loses file tracking — CC doesn't know what REPL read/wrote
- More code, more bugs, more surface area
- No advantage — Option B is simpler AND more correct

### Tool.call() Return Shapes (Finding F10)

All tools return `{ data: <structured-object> }` on success. Errors **throw**.

| Tool | Success Shape | REPL Extraction |
|------|--------------|-----------------|
| Read | `{ data: { type: "text", file: { filePath, content, numLines, startLine, totalLines } } }` | `result.data.file.content` |
| Write | `{ data: { type: "create"\|"update", filePath, content, structuredPatch, originalFile } }` | `result.data.type` + `result.data.filePath` |
| Edit | `{ data: { filePath, oldString, newString, originalFile, structuredPatch, userModified, replaceAll } }` | `result.data.filePath` |
| Bash | `{ data: { stdout, stderr, interrupted, isImage, noOutputExpected, persistedOutputPath, ... } }` | `result.data.stdout` + `result.data.stderr` |

**Error pattern:** Tools throw `Error` instances (Read) or minified error classes
(Bash's `wV` for "Shell command failed"). All catchable with try/catch.

**Call signatures:** `(args, context, canUseTool?, parentMessage?, onProgress?)` — we
pass `(args, context)`, remaining args are optional and handled internally.

### Architecture Diagram

```
┌──────────────────────────────────────────────────────┐
│ Binary Patch (via governance patching engine)         │
│   getAllBaseTools() patched to load external tools    │
│   Auto-discovery loader: require('~/.claude-         │
│     governance/tools/index.js') scans .js files      │
├──────────────────────────────────────────────────────┤
│ REPL Tool (repl.js — on disk, hot-updatable)         │
│   call(args, context):                               │
│     ├─ Capture currentContext = context               │
│     ├─ Create/reuse persistent VM context             │
│     ├─ Bind tool handlers from context.options.tools  │
│     ├─ Execute script in VM sandbox with timeout      │
│     └─ Return result + operation log                  │
├──────────────────────────────────────────────────────┤
│ VM Sandbox (Node vm module)                           │
│   Tool Handlers (delegate to CC tools via context):   │
│   ├─ read(path, opts?)       → Read.call()            │
│   ├─ write(path, content)    → Write.call()           │
│   ├─ edit(path, old, new)    → Edit.call()            │
│   ├─ bash(cmd, opts?)        → Bash.call()            │
│   ├─ grep(pattern, path?)    → Bash.call(grep cmd)    │
│   ├─ glob(pattern, opts?)    → Bash.call(find cmd)    │
│   ├─ notebook_edit(path, ..) → NotebookEdit.call()    │
│   ├─ fetch(url, opts?)       → WebFetch.call()        │
│   ├─ agent(prompt, opts?)    → Agent.call()           │
│   State:                                              │
│   ├─ console (captured stdout/stderr)                 │
│   ├─ Safe globals (JSON, Math, Date, Buffer, etc.)    │
│   ├─ Safe require (path, url, crypto, util, os)       │
│   └─ User variables (persist across REPL calls)       │
├──────────────────────────────────────────────────────┤
│ Operation Tracking                                    │
│   Every inner tool call logged: tool, args, success,  │
│   resultSummary, duration. Included in result output. │
└──────────────────────────────────────────────────────┘
```

### Why Grep/Glob Go Through Bash

Finding F1 confirmed: when `EMBEDDED_SEARCH_TOOLS=1`, Grep and Glob are excluded from
the tool registry (Finding F7 — verified in G11). They're replaced by shadow functions
in Bash that dispatch to embedded ugrep/bfs. Our REPL's `grep()` and `glob()` construct
shell commands and delegate to Bash.call(), automatically getting the embedded tool
dispatch. In non-embedded mode, standard grep/find are used — still correct.

Note: Ant REPL's `getReplPrimitiveTools()` includes Glob and Grep directly (bypassing
the exclusion in `getAllBaseTools()`). We can't do this because those tools aren't in
our context — they've already been filtered before we see the tools array.

### Key Design Decision: Coexist by Default, Replace by Config

Ant REPL replaces all primitives — Claude can ONLY use REPL. For us:
- Removing primitives means if REPL breaks, Claude is helpless
- Users lose visibility into individual operations (permission prompts, tool UI)
- Our governance patches may not survive the REPL-only prompt rewrite

**Our REPL has two user-configurable modes:**

| Mode | Tool Registry | System Prompt | Behavior |
|------|--------------|---------------|----------|
| **coexist** (default) | REPL added alongside all primitives | Standard "Using your tools" + REPL's prompt() | Claude chooses per task |
| **replace** | REPL added, primitives filtered out | "Using your tools" replaced with REPL-only guidance | Ant REPL experience |

---

## Detailed Design

### 1. Auto-Discovery Tool Loader

**Current state:** `~/.claude-governance/tools/index.js` is a hand-written file that
exports an array of tools. Adding a new tool means editing this file.

**Target:** index.js becomes a generic auto-discovery loader. Drop a `.js` file in
the tools directory → it's loaded automatically. No editing needed.

```
~/.claude-governance/tools/
  index.js      ← auto-discovery loader (deployed by claude-governance)
  ping.js       ← Ping tool (moved from inline in index.js)
  repl.js       ← REPL tool (the main deliverable)
```

The binary patch already loads `tools/index.js` via `require()` (see
`TOOL_LOADER_CODE` in `governance.ts:536-561`). The new index.js scans its own
directory for `.js` files, requires each one, and collects exported tools. This is
a one-time change that serves all future tools (Tungsten in 2c, etc).

**Auto-discovery loader pseudocode:**
```javascript
const fs = require('fs');
const path = require('path');
const toolsDir = __dirname;
const tools = [];
for (const file of fs.readdirSync(toolsDir)) {
  if (file === 'index.js' || !file.endsWith('.js')) continue;
  try {
    const mod = require(path.join(toolsDir, file));
    const exported = Array.isArray(mod) ? mod : mod.default || mod.tools || [mod];
    tools.push(...exported.filter(t => t && t.name));
  } catch (e) { /* skip broken tool files silently */ }
}
module.exports = tools;
```

**Deployment mechanism:** `deployTools()` in `src/patches/index.ts`, following the
`deployPromptOverrides()` pattern (G5). Copies from `data/tools/` in the npm package
to `~/.claude-governance/tools/`. Only overwrites if content differs. User-added tool
files (not in `data/tools/`) are preserved.

### 2. Tool Registration

```javascript
{
  name: 'REPL',
  inputJSONSchema: {
    type: 'object',
    properties: {
      script: {
        type: 'string',
        description: 'JavaScript code to execute. Use await for async operations. ' +
          'Return a value to include it in the response.'
      },
      description: {
        type: 'string',
        description: 'Brief description of what this script does'
      }
    },
    required: ['script']
  },
  async prompt() { /* comprehensive guidance — see §8 */ },
  async description() {
    return 'Execute JavaScript with access to file and shell operations. ' +
      'Batch multiple operations in one call.';
  },
  async call(args, context) { /* see §3 */ },
}
```

### 3. Execution Flow

```
call(args, context)
  │
  ├─ Set currentContext = context (closure for handlers)
  ├─ Create VM context if first call (persist at module scope)
  ├─ Update tool handler bindings (tools array may change between calls)
  ├─ Clear console buffers and operation tracking array
  ├─ Reset abort check
  ├─ Wrap script: (async () => { ${script} })()
  ├─ Execute in VM with timeout (configurable, default 120s)
  ├─ Collect: return value, operations log, stdout, stderr, duration
  └─ Return formatted { data: string }
```

**Context lifecycle:** `context` is only available inside `call()`. The VM context
persists at module scope, but tool handler closures reference a `currentContext`
variable that gets updated on every `call()` invocation. This way:
- **Variables persist** across calls (same VM context)
- **Tool references are fresh** (context.options.tools may change mid-session)
- **Abort controller is current** (new one per API turn)

### 4. Inner Tool Handlers

Each sandbox function is a thin async wrapper that:
1. Checks `currentContext.abortController.signal.aborted` (bail if cancelled)
2. Finds the target tool by name in `currentContext.options.tools`
3. Formats args to match the tool's expected input schema
4. Calls `tool.call(formattedArgs, currentContext)` — full CC delegation
5. Extracts the useful data from the structured result
6. Logs the operation to the tracking array
7. Returns the extracted data to the script

**Handler specifications:**

| Sandbox Function | Delegates To | Input Mapping | Result Extraction |
|-----------------|-------------|---------------|-------------------|
| `read(path, opts?)` | Read | `{file_path, offset?, limit?}` | `result.data.file.content` → string |
| `write(path, content)` | Write | `{file_path, content}` | `result.data.type` + `result.data.filePath` → confirmation string |
| `edit(path, old, new, opts?)` | Edit | `{file_path, old_string, new_string, replace_all?}` | `result.data.filePath` → confirmation string |
| `bash(cmd, opts?)` | Bash | `{command, timeout?, description?}` | `result.data.stdout` → string (+ stderr if non-empty) |
| `grep(pattern, path?, opts?)` | Bash | `{command: "grep -rn '${pattern}' ${path}"}` | `result.data.stdout` → string |
| `glob(pattern, opts?)` | Bash | `{command: "find . -name '${pattern}' ..."}` | `result.data.stdout` → string |
| `notebook_edit(path, ops)` | NotebookEdit | `{notebook_path, ...}` | Confirmation string |
| `fetch(url, opts?)` | WebFetch | `{url, ...}` | Response body string |
| `agent(prompt, opts?)` | Agent | `{prompt, description?, ...}` | Agent result string |

**Grep/Glob through Bash:** When embedded search tools are active, Bash shadows
`grep` → `ugrep` and `find` → `bfs`. Our handlers construct commands that go
through Bash.call(), automatically getting the embedded dispatch. In non-embedded
mode, standard grep/find are used — still correct.

**Error handling in handlers:** Every handler wraps delegation in try/catch. On error,
the operation is logged as failed and the error is re-thrown for the script to handle
(or bubble to the REPL result). Error messages from CC tools are user-friendly.

**Defensive result extraction:** Each handler attempts the documented extraction path
first (e.g., `result.data.file.content` for Read). If the structure doesn't match
(CC update changed it), falls back to `JSON.stringify(result.data)` or `String(result)`.

### 5. VM Context & Persistence

```javascript
const vm = require('vm');

// Module-level — persists across REPL calls within the CC session
let vmContext = null;
let currentContext = null; // Updated on every call()

function getOrCreateVM() {
  if (vmContext) return vmContext;

  const sandbox = {
    // Tool handlers (bound to currentContext via closure)
    read, write, edit, bash, grep, glob, notebook_edit, fetch, agent,

    // Captured console
    console: createCapturedConsole(),

    // Safe globals
    JSON, Math, Date, RegExp, Array, Object, Map, Set, WeakMap, WeakSet,
    Promise, Symbol, Proxy, Reflect,
    Buffer, URL, URLSearchParams, TextEncoder, TextDecoder,
    setTimeout, clearTimeout, setInterval, clearInterval,
    parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent,
    encodeURI, decodeURI,

    // Safe require — allowlisted modules only
    require: createSafeRequire(),
  };

  vmContext = vm.createContext(sandbox);
  return vmContext;
}
```

**What persists across calls:**
- Variables assigned in one script carry to the next
- `const data = await read('file.txt')` in call 1 → `data` is available in call 2
- Functions defined in one call are callable in subsequent calls
- Imported safe modules remain cached

**What resets per call:**
- Console buffers (clear before each execution)
- Operation tracking array (fresh per call)
- Timeout counter
- currentContext reference (updated to latest)

**Safe require allowlist:** `path`, `url`, `querystring`, `crypto`, `util`, `os`
— pure utility modules with no I/O side effects. No `fs`, `child_process`, `net`,
`http` — all I/O goes through tool handlers for tracking and permission checks.

### 6. Console Capture

```javascript
function createCapturedConsole() {
  const stdout = [];
  const stderr = [];
  return {
    log: (...args) => stdout.push(args.map(String).join(' ')),
    warn: (...args) => stderr.push(args.map(String).join(' ')),
    error: (...args) => stderr.push(args.map(String).join(' ')),
    info: (...args) => stdout.push(args.map(String).join(' ')),
    dir: (obj) => stdout.push(JSON.stringify(obj, null, 2)),
    table: (data) => stdout.push(JSON.stringify(data, null, 2)),
    getStdout: () => stdout.join('\n'),
    getStderr: () => stderr.join('\n'),
    clear: () => { stdout.length = 0; stderr.length = 0; },
  };
}
```

### 7. Operation Tracking

Every inner tool call is logged:

```javascript
{
  tool: 'read',
  args: { file_path: '/path/to/file.txt' },
  success: true,
  resultSummary: '245 lines read',
  duration: 12,
}
```

**Tracking wrapper pattern:**
```javascript
async function tracked(toolName, args, fn) {
  const op = { tool: toolName, args: summarizeArgs(toolName, args), startTime: Date.now() };
  try {
    const result = await fn();
    op.success = true;
    op.resultSummary = summarizeResult(toolName, result);
    op.duration = Date.now() - op.startTime;
    operations.push(op);
    return result;
  } catch (err) {
    op.success = false;
    op.error = err.message;
    op.duration = Date.now() - op.startTime;
    operations.push(op);
    throw err;
  }
}
```

**Summarization:** Args are summarized (paths shown, content truncated). Results are
summarized (line counts, byte counts, not full content). The operation log gives
visibility without bloating the result.

### 8. Result Formatting

The tool returns a structured string for both Claude and the user:

**Success:**
```
=== REPL: {description} ===
Duration: 142ms | Operations: 5

--- Operations ---
1. read(/src/index.ts) → 245 lines [12ms]
2. read(/src/utils.ts) → 89 lines [8ms]
3. grep("TODO", /src/) → 12 matches [34ms]
4. edit(/src/index.ts) → replaced 1 occurrence [6ms]
5. write(/src/new-file.ts) → created [4ms]

--- Console Output ---
Found 12 TODO items across 4 files

--- Result ---
{ filesProcessed: 5, todosFound: 12 }
```

**Error:**
```
=== REPL: {description} ===
Duration: 89ms | Operations: 2 (1 failed)

--- Operations ---
1. read(/src/index.ts) → 245 lines [12ms]
2. write(/etc/passwd) → ERROR: Permission denied [3ms]

--- Error ---
TypeError: write failed on operation 2
    at Script:3:15

--- Console Output ---
(empty)
```

**No description provided:**
```
=== REPL ===
Duration: 5ms | Operations: 0

--- Result ---
2
```

**Size management:** Operation results truncated at 50KB each. Total result string
truncated at configurable `maxResultSize` (default 100KB). Truncation noted in output.

### 9. Safety Model

**Primary safety: CC's own permission system.** Since every inner operation delegates
to the actual CC tools via `tool.call(args, context)`, all permission checks are
handled natively. If the user has "ask before write" configured, Write.call() triggers
the permission prompt even inside REPL. This is the biggest advantage of tool
delegation.

**Note on `claude -p` (non-interactive mode):** Probe testing showed Write.call()
succeeded without prompting in `claude -p` mode. Non-interactive mode appears to
auto-allow operations. This is CC's own behavior, not something we override.

**Additional REPL-level safety:**

| Concern | Approach |
|---------|----------|
| Script timeout | `vm.runInContext` with configurable timeout (default 120s) |
| Infinite loops | VM timeout kills runaway scripts |
| Result size | Truncate per-operation results > 50KB, total > maxResultSize |
| AbortController | Check `context.abortController.signal.aborted` before each inner call |
| Safe require | Allowlist: `path`, `url`, `querystring`, `crypto`, `util`, `os` |
| No direct I/O | `fs`, `child_process`, `net`, `http` not in sandbox — all I/O through handlers |
| No `process` | Not in sandbox — can't exit, can't read env directly |

### 10. Configuration

**In `~/.claude-governance/config.json`:**

```json
{
  "modules": { "core": true, "env-flags": true },
  "repl": {
    "mode": "coexist",
    "timeout": 120000,
    "maxResultSize": 100000
  }
}
```

| Setting | Values | Default | Effect |
|---------|--------|---------|--------|
| `mode` | `"coexist"` / `"replace"` | `"coexist"` | Whether primitives stay or are filtered |
| `timeout` | ms | 120000 | VM execution timeout per script |
| `maxResultSize` | chars | 100000 | Max result string size |

#### Mode "coexist" (default)

REPL is added to the tool registry alongside all existing tools. The standard "Using
your tools" system prompt section stays. Claude decides when to use REPL vs individual
tools based on the task. The REPL tool's `prompt()` teaches Claude when batching is
beneficial.

#### Mode "replace"

REPL is added, primitives (Read, Write, Edit, Bash, NotebookEdit, Agent) are filtered
from the tool registry. A prompt override replaces the "Using your tools" section with
REPL-focused guidance. This replicates the Ant REPL experience.

#### How "replace" mode works mechanically

The binary-patched tool loader already runs inside `getAllBaseTools()`. We extend it
to read REPL config from `~/.claude-governance/config.json` and filter `REPL_ONLY_TOOLS`
from the base tools array (`_b`) before returning.

This is architecturally correct — it's exactly where CC itself does this filtering
(tools.ts:314-321). The loader already reads from `~/.claude-governance/` for tool
files, so adding a config read is ~10 lines of minified JS.

**Tools filtered in replace mode:**
Read, Write, Edit, Bash, NotebookEdit, Agent (same as Ant's `REPL_ONLY_TOOLS`)

**Tools preserved in replace mode:**
REPL, Ping, all MCP tools, AskUserQuestion, TaskCreate/Update, ScheduleWakeup, Skill,
Monitor, all session management tools. Claude can still interact with the user and
manage tasks — only file/shell primitives are routed through REPL.

### 11. Prompt Strategy

#### REPL Tool's `prompt()` Method

Comprehensive guidance that teaches Claude how to use the REPL sandbox. This goes
into the system prompt automatically (CC calls `prompt()` on every registered tool).

**Key sections in prompt():**
- What REPL is and when to use it (3+ operations, scan-filter-act, bulk reads/edits,
  loops/conditionals, data processing pipelines)
- Available async functions with signatures and return types
- `console.log()` for debug output (captured, included in result)
- `return` to include values in the response
- Error handling patterns (`try/catch` inside scripts)
- State persistence (variables carry across calls within a session)
- Safe `require()` for utility modules
- Examples:
  - Multi-file scan: glob → read → filter → return
  - Bulk edit: glob → read → edit loop
  - Search and summarize: grep → read relevant files → return summary
  - Data pipeline: read config → process → write output

#### "Replace" Mode Prompt Override

A new prompt override markdown file deployed to `~/.claude-governance/system-prompts/`
that replaces the "Using your tools" section. Uses the existing pieces matching →
regex replacement pipeline (same as all 8 current prompt overrides).

Content mirrors Ant REPL (prompts.ts:277-284): minimal section with only task
management guidance. The REPL tool's own `prompt()` handles all tool usage guidance.

This override is only applied when `repl.mode` is `"replace"` in config. The
deployment step checks config before copying the override file.

#### "Coexist" Mode — No Prompt Override

The REPL tool's `prompt()` is always included (it's in the registry). In coexist mode,
the standard "Using your tools" section stays, and Claude gets guidance for both
individual tools AND REPL. Claude chooses based on the task — REPL for batching,
individual tools for simple one-off operations.

### 12. Tool Deployment Mechanism

New function `deployTools()` in `src/patches/index.ts`, following the
`deployPromptOverrides()` pattern from G5.

**Package structure:**
```
claude-governance/data/tools/
  index.js      ← auto-discovery loader
  ping.js       ← Ping tool (extracted from current inline index.js)
  repl.js       ← REPL implementation
```

**Deployed to:**
```
~/.claude-governance/tools/
  index.js      ← always overwritten (ours, auto-discovery loader)
  ping.js       ← overwritten if content differs
  repl.js       ← overwritten if content differs
  my-custom.js  ← preserved (user-added, not in data/tools/)
```

The deploy step runs before `applyGovernancePatches` in the apply flow (same position
as `deployPromptOverrides`). User-added tool files are never touched — only files that
exist in `data/tools/` are candidates for overwrite.

**NPM package.json:** Add `"data/tools/*.js"` to the `files` array for distribution.

### 13. Verification

The tool injection loader code is already verified in the binary (existing
`tool-injection` verification entry checks for `__claude_governance_tools__` signature).

REPL-specific verification added to the `check` command:

1. **Tool injection patch present** — existing check (in VERIFICATION_REGISTRY)
2. **Tools directory exists** — `~/.claude-governance/tools/` present
3. **Auto-discovery loader deployed** — `index.js` exists
4. **REPL tool deployed** — `repl.js` exists

These are file-existence checks, not binary signature checks (tools are loaded at
runtime via `require()`, not embedded in the binary).

### 14. Testing Plan

All testable via `claude -p` (non-interactive tool testing):

| Test | Command | Expected |
|------|---------|----------|
| Basic execution | `claude -p "Use REPL: return 1+1"` | Result: 2 |
| File read | `claude -p "Use REPL to read /tmp/test.txt"` | File content |
| Multi-op batch | `claude -p "Use REPL: const files = await glob('*.md'); return files"` | File list |
| Write + read | `claude -p "Use REPL: write then read back"` | Round-trip verification |
| Edit | `claude -p "Use REPL: write, then edit, then read"` | Edit confirmed |
| Bash | `claude -p "Use REPL: return await bash('echo hello')"` | "hello" |
| Grep | `claude -p "Use REPL: return await grep('function', '.')"` | Grep output |
| State persistence | Interactive session, two REPL calls | Variables carry |
| Timeout | `claude -p "Use REPL: while(true){}"` | Timeout error |
| Console capture | `claude -p "Use REPL: console.log('hello'); return 'done'"` | Console + result |
| Error handling | `claude -p "Use REPL: throw new Error('test')"` | Error with stack |
| Operation tracking | Any multi-tool script | Operations list in output |
| Coexist mode | Default config, both REPL and Read available | Both in tool list |
| Replace mode | Config set to replace, only REPL visible | Primitives hidden |

### 15. Example Usage

Claude would use the REPL for batch operations like:

```javascript
// "Read all test files and find ones missing coverage for the auth module"
const testFiles = (await glob('**/*.test.{ts,js}')).split('\n').filter(Boolean);
const results = [];

for (const file of testFiles) {
  const content = await read(file);
  const hasAuthTests = /describe.*['"]auth/i.test(content);
  const hasLoginTests = /it.*['"]login/i.test(content);

  if (hasAuthTests && !hasLoginTests) {
    results.push({ file, issue: 'Has auth describe block but no login tests' });
  }
}

return results;
```

vs the non-REPL approach: Glob → read file 1 → read file 2 → ... → read file N
(N+1 tool calls vs 1).

```javascript
// "Rename all occurrences of oldFunc to newFunc across the codebase"
const files = (await grep('oldFunc', 'src/')).split('\n')
  .filter(Boolean)
  .map(line => line.split(':')[0])
  .filter((v, i, a) => a.indexOf(v) === i); // unique files

for (const file of files) {
  await edit(file, 'oldFunc', 'newFunc', { replace_all: true });
  console.log(`Updated: ${file}`);
}

return `Renamed oldFunc → newFunc in ${files.length} files`;
```

---

## Task Breakdown

### Task 1: Auto-Discovery Loader + Tool Deployment
- Create `data/tools/index.js` (auto-discovery loader)
- Extract Ping to `data/tools/ping.js`
- Add `deployTools()` to `src/patches/index.ts`
- Add `"data/tools/*.js"` to `package.json` files array
- Wire into apply flow (before patches, after prompt overrides)
- Test: `claude-governance apply` deploys tools, Ping still works via `claude -p`

### Task 2: REPL Core — VM Engine + Tool Handlers
- Create `data/tools/repl.js` with full implementation
- VM context creation with persistent state at module scope
- All 9 inner tool handlers delegating to CC tools via context
- Console capture (stdout/stderr)
- Operation tracking with per-call logging
- Result formatting (success/error/truncation)
- Timeout enforcement via `vm.runInContext` options
- AbortController integration (check between operations)
- Defensive result extraction with fallback
- Test: `claude -p` basic execution, file ops, multi-op batches, errors, timeout

### Task 3: Configuration — Modes + Loader Filtering
- Add REPL config schema to config reading in `src/patches/index.ts`
- Extend binary-patched loader code (`TOOL_LOADER_CODE`) to read config
- When `repl.mode === "replace"`: filter REPL_ONLY_TOOLS from `_b` array
- Respect config defaults (coexist if no config set)
- Test: coexist mode (default, both REPL and Read visible), replace mode (primitives hidden)

### Task 4: Prompt — Tool Prompt + Replace Override
- Write comprehensive `prompt()` for REPL tool (§8 above)
- Create prompt override markdown for "Using your tools" section (replace mode)
- Deploy override via existing prompt override pipeline (conditional on config)
- Add to VERIFICATION_REGISTRY if replace mode active
- Test: prompt appears in system prompt, replace mode simplifies tool guidance

### Task 5: Verification + Testing + Housekeeping
- Add file-existence checks for tools dir to `check` command
- Full test suite via `claude -p` (all 14 tests from §14)
- Update CONTEXT.md, STATE.md, ROADMAP.md, BOOTSTRAP.md
- Create phase tracker and handoff doc
- Commit all atomically

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| VM timeout doesn't kill async tool calls | Hung operations | AbortController propagation + timeout on Bash inner calls |
| "Replace" mode confuses Claude | REPL not used effectively | Comprehensive prompt() + tested with real tasks |
| `require()` path differs on Windows | Cross-platform failure | Use `path.join()`, test both separators |
| CC update changes tool.call() return shape | Handler breakage | Defensive extraction with fallback to raw JSON |
| CC update changes tool names | Handler can't find tools | Null check on tool lookup, meaningful error |
| Script modifies sandbox globals | State corruption | VM context isolation handles this natively |
| Large script results blow context | Token waste | maxResultSize truncation + per-op limits |

## Remaining Open Questions

1. **Permission prompts in non-interactive mode:** `claude -p` auto-allowed Write.call()
   in probing. Confirmed behavior for testing, but interactive mode may prompt for writes
   inside REPL. This is correct behavior (CC's permission system working as designed).

2. **`context.options.refreshTools` behavior:** Can we call this to dynamically update
   the tool list mid-session? May not be needed — replace mode filtering happens at
   `getAllBaseTools()` level, which runs before `getTools()`.

## Dependencies

- Tool injection mechanism (Phase 2a) — COMPLETE ✓
- Tool injection hardening (Phase 2a-gaps) — COMPLETE ✓
- Zod passthrough shim (G3+G4) — COMPLETE ✓
- Prompt override pipeline (G5) — COMPLETE ✓
- No external dependencies — `vm` is a Node.js/Bun built-in

## Findings Referenced

- **F1:** ToolUseContext exposes full tool registry — validates Option B
- **F2:** Ant REPL prompt handling — informs replace mode design
- **F7:** Glob/Grep registry exclusion — grep/glob route through Bash
- **F9:** REPLTool.ts not in leaked source — confirms clean-room approach
- **F10:** Tool.call() return shapes — defines result extraction
- **F11:** Tool call delegation pattern confirmed — validates architecture
