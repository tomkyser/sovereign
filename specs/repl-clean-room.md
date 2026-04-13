# Clean-Room REPL: Batch Operations Engine

Version: 0.2 (design spec)
Date: 2026-04-12
Status: Draft — revised for native tool injection

## Problem Statement

Claude Code's tool architecture requires one API round-trip per tool call. A task that
reads 5 files, greps 3 patterns, and edits 2 files costs 10 tool calls — 10 round-trips,
10 permission checks rendered to the user, 10 entries in context consuming tokens. This
is slow, expensive, and noisy.

Anthropic's internal REPLTool solves this by wrapping all primitive tools in a Node.js
VM. Claude writes a single JavaScript script that calls multiple tools, and the whole
thing executes in one tool invocation. The REPL implementation is stripped from external
builds.

## What Ant REPL Does

Reconstructed from state shapes, tool registry, constants, and comment references.
The actual REPLTool.ts was not in the leaked source dump.

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
// constants.ts
function isReplModeEnabled(): boolean {
  if (isEnvDefinedFalsy(process.env.CLAUDE_CODE_REPL)) return false
  if (isEnvTruthy(process.env.CLAUDE_REPL_MODE)) return true
  return process.env.USER_TYPE === 'ant' && 
         process.env.CLAUDE_CODE_ENTRYPOINT === 'cli'
}
```

When active, ALL primitive tools are removed from the tool registry:
```typescript
const REPL_ONLY_TOOLS = new Set([
  'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'NotebookEdit', 'Agent'
])
// Tools are filtered out, only REPLTool remains
```

### What Made It Valuable
1. One tool call does the work of many — massive latency reduction
2. State carries across REPL calls (variables, imports, intermediate results)
3. Complex multi-step operations become single atomic units
4. Claude can write procedural code for non-trivial tasks (loops, conditionals, error handling)

### Known Limitations
- VM escapes between inner tool calls have no security classification
- Debugging is harder (opaque JS execution vs visible tool calls)
- The whole batch fails if any inner operation throws without try/catch

## Our Approach: Native Tool Injection

Like Tungsten, REPL must be a first-class native tool injected into the CC binary's
tool registry. MCP is particularly wrong for REPL because:
- MCP runs in a separate process — it cannot call CC's internal tool handlers
- MCP cannot delegate to `canUseTool` for permission checks on inner operations
- MCP cannot use the `isTransparentWrapper` pattern for rendering inner calls
- The whole point of REPL is reducing overhead; MCP adds overhead

Native injection gives us:
- In-process execution — the VM runs inside the CC process
- Access to the actual tool handler functions for inner operations
- Potential to use `canUseTool` for permission delegation
- Zero IPC overhead on the batch call itself

### Architecture

```
┌─────────────────────────────────────────────────────┐
│ Binary Patch (via governance patching engine)        │
│   Modifies tool registry: getAllBaseTools()          │
│   Adds REPL tool from external require()            │
├─────────────────────────────────────────────────────┤
│ Tool Implementation (on disk, updatable)             │
│   ~/.claudemd-governance/tools/repl.js              │
│   - Exports tool object: name, schema, handler      │
│   - Handler creates/reuses Node VM context           │
│   - Registers tool handler wrappers in VM sandbox    │
│   - Executes Claude's script, returns results        │
├─────────────────────────────────────────────────────┤
│ VM Sandbox (Node vm module)                          │
│   - Persistent context across calls                  │
│   - Tool handlers: read, write, edit, grep, bash...  │
│   - Custom console (captured stdout/stderr)          │
│   - Safe globals (JSON, Math, Date, Buffer, etc.)    │
│   - Operation tracking for audit trail               │
├─────────────────────────────────────────────────────┤
│ Inner Tool Dispatch                                  │
│   Option A: Direct fs/child_process (simpler)        │
│   Option B: Call CC's actual tool handlers (deeper)   │
│   Decision deferred to implementation — depends on   │
│   what's accessible from the injected tool's scope   │
└─────────────────────────────────────────────────────┘
```

### Key Design Decision: We Do NOT Hide Primitive Tools

Ant REPL replaces all primitives — Claude can ONLY use REPL. This is fine for ants
who want to train the model on batch patterns, but for us:
- Removing primitives means if REPL breaks, Claude is helpless
- Users lose visibility into individual operations (permission prompts, tool UI)
- Our governance patches may not survive the REPL-only prompt rewrite

Our REPL coexists with all existing tools. Claude chooses REPL when batching is
beneficial, uses individual tools when clarity matters. Best of both worlds.

### Inner Tool Dispatch: The Key Technical Question

When Claude's REPL script calls `await read('/path/to/file')`, what actually happens?

**Option A — Direct implementation (simpler, self-contained):**
The `read()` handler in the VM directly calls `fs.readFileSync()`. The `bash()`
handler calls `child_process.execSync()`. Each handler is a standalone implementation
that doesn't touch CC internals. This is what the MCP approach would have done, but
without the IPC overhead.

**Option B — CC tool handler delegation (deeper integration):**
The `read()` handler in the VM calls the actual ReadTool's handler function from the
CC binary. This gets us permission checks, proper error formatting, and consistent
behavior with the native tools. But it requires us to locate and reference the
minified tool handler functions from our injected code.

**Recommended approach:** Start with Option A. It works regardless of internal API
changes. Upgrade to Option B if we find specific integration points that justify the
coupling. The ant REPL uses Option B (tool wrappers via `primitiveTools.ts`), but
they control the source — we're working with minified code.

## Detailed Design

### 1. Tool Registration

Injected into the tool registry alongside Tungsten via the patching engine:

```javascript
// ~/.claudemd-governance/tools/index.js
module.exports = [
  require('./tungsten'),
  require('./repl'),
];
```

### 2. Tool Schema

```typescript
{
  name: "REPL",
  description: "Execute a JavaScript script with access to file and shell operations. " +
    "Use for batch operations that would otherwise require multiple sequential tool " +
    "calls. Available async functions: read(path), write(path, content), " +
    "edit(path, old, new), grep(pattern, path, opts?), glob(pattern, opts?), " +
    "bash(command, opts?). Variables and state persist across REPL calls.",
  inputSchema: {
    type: "object",
    properties: {
      script: {
        type: "string",
        description: "JavaScript code to execute. Use await for async operations. " +
          "Return a value to include it in the response."
      },
      description: {
        type: "string",
        description: "Brief description of what this script does"
      }
    },
    required: ["script"]
  }
}
```

### 3. VM Environment

```javascript
const vm = require('vm');

// Create sandbox with tool handlers + safe globals
const sandbox = {
  // Tool handlers (async, returning structured results)
  read: async (path) => { /* fs.readFile with path resolution */ },
  write: async (path, content) => { /* fs.writeFile with safety checks */ },
  edit: async (path, oldStr, newStr) => { /* string replacement */ },
  grep: async (pattern, path, opts) => { /* ripgrep or ugrep wrapper */ },
  glob: async (pattern, opts) => { /* glob with ignore patterns */ },
  bash: async (cmd, opts) => { /* child_process.exec with timeout */ },
  fetch: async (url, opts) => { /* HTTP client */ },

  // Safe globals
  console: capturedConsole,
  JSON, Math, Date, RegExp, Array, Object, Map, Set, Promise,
  Buffer, URL, URLSearchParams,
  setTimeout, clearTimeout,

  // Results accumulator
  __results: [],
  __errors: [],
};

// Persist context across calls
const context = vm.createContext(sandbox);
```

### 4. Execution Flow

```javascript
async function executeScript(script, description) {
  const startTime = Date.now();
  const operations = []; // Track what happened

  // Wrap tool handlers to log operations
  const trackedSandbox = wrapWithTracking(sandbox, operations);

  try {
    // Execute with timeout
    const result = await vm.runInContext(
      `(async () => { ${script} })()`,
      context,
      { timeout: REPL_MAX_EXEC_TIME }
    );

    return {
      success: true,
      result: serialize(result),
      operations: operations.map(summarize),
      stdout: capturedConsole.getStdout(),
      stderr: capturedConsole.getStderr(),
      duration: Date.now() - startTime,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      stack: err.stack,
      operations: operations.map(summarize), // Show what succeeded before failure
      stdout: capturedConsole.getStdout(),
      stderr: capturedConsole.getStderr(),
      duration: Date.now() - startTime,
    };
  }
}
```

### 5. Operation Tracking

Every tool handler call is logged with input/output summary:

```javascript
function wrapWithTracking(sandbox, operations) {
  return new Proxy(sandbox, {
    get(target, prop) {
      const fn = target[prop];
      if (typeof fn !== 'function' || prop.startsWith('__')) return fn;

      return async (...args) => {
        const op = { tool: prop, args: summarizeArgs(args), startTime: Date.now() };
        try {
          const result = await fn(...args);
          op.success = true;
          op.resultSummary = summarizeResult(prop, result);
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
      };
    }
  });
}
```

This gives Claude and the user a clear audit trail: "Script ran: read 3 files (ok),
grep 2 patterns (ok), edit 1 file (ok), write 1 file (failed: permission denied)."

### 6. Safety Model

As a native tool running in-process, we have two options for safety:

**Option A (initial):** Self-contained safety checks in the handler:

| Concern | Approach |
|---------|----------|
| File writes | Respect .gitignore, block .env/.ssh/.git writes |
| Path traversal | Resolve all paths relative to CWD, block escape |
| Command injection | bash() uses execFile not exec, no shell interpolation |
| Resource limits | Timeout per script, max result size, max file size |
| Secrets | Never read .env, credentials, keys |
| Network | fetch() limited to GET by default, allowlist for POST |

**Option B (future):** Delegate to CC's `canUseTool` for inner operations. Since we
run in-process, we can potentially reference the permission checking infrastructure.
This would give users proper permission prompts for operations inside REPL scripts
and respect their allow/deny rules from settings.json.

Start with A, investigate B once we understand what's accessible from injected scope.

### 7. Example Usage

Claude would use the REPL for batch operations like:

```javascript
// "Read all test files and find ones missing coverage for the auth module"
const testFiles = await glob('**/*.test.{ts,js}');
const results = [];

for (const file of testFiles) {
  const content = await read(file);
  const hasAuthTests = /describe.*['\"]auth/i.test(content);
  const hasLoginTests = /it.*['\"]login/i.test(content);

  if (hasAuthTests && !hasLoginTests) {
    results.push({ file, issue: 'Has auth describe block but no login tests' });
  }
}

return results;
```

vs the non-REPL approach: Glob tool → read file 1 → read file 2 → ... → read file N
(N+1 tool calls vs 1).

## Implementation Phases

### Phase 1: Core VM Engine + Injection
- Write `~/.claudemd-governance/tools/repl.js` with full handler
- Integrate with patching engine tool registry injection (shared with Tungsten)
- Basic tool handlers: read, write, edit, grep, glob, bash (Option A: direct impl)
- VM context with persistence across calls
- Operation tracking and result formatting
- Safety checks (path resolution, blocked paths, timeouts)

### Phase 2: System Prompt Integration
- Patch system prompt to include REPL usage guidance
- "Use REPL for batch operations involving 3+ file/search operations"
- Teach batch patterns: scan-filter-act, multi-file read, bulk edit
- Verification hook confirms tool is in registry

### Phase 3: Advanced Features
- `fetch()` handler for HTTP operations
- `diff()` handler for unified diff generation
- Script validation before execution (syntax check)
- Result size management (truncation, pagination)
- Named script templates for common batch patterns

### Phase 4: Deep Integration (Option B investigation)
- Investigate calling CC's actual tool handlers from injected scope
- If feasible: delegate to `canUseTool` for permission checks
- If feasible: explore `isTransparentWrapper` for rendering inner calls
- Benchmark against Option A to quantify integration value

## Comparison: Our REPL vs Ant REPL

| Aspect | Ant REPL | Our REPL |
|--------|----------|----------|
| Integration | Native tool, replaces primitives | Native tool, coexists with primitives |
| Permission model | Delegates to canUseTool | Self-contained (Phase 1), canUseTool (Phase 4) |
| Rendering | Transparent (inner calls shown as direct) | Aggregated result with operation log |
| State | AppState-backed VM context | Process-scope VM context (functionally equivalent) |
| Failure mode | If REPL breaks, no tools available | If REPL breaks, use individual tools |
| Security review | VM escapes unclassified | All operations logged and bounded |
| Inner dispatch | Wraps actual tool handlers | Direct fs/child_process (Phase 1) |

## Open Questions

1. **System prompt budget**: Adding REPL guidance to the system prompt costs tokens.
   The ant version dramatically simplifies the "Using your tools" section when REPL
   is active (removes all "prefer dedicated tools" guidance). We're NOT doing that
   (we keep primitives), so we need to add guidance without bloating the prompt.
   Measure token cost after implementation.

2. **Context persistence**: Should the VM context survive CC restarts? Start with
   per-session (process-scope). Serialize to disk only if there's a clear use case.

3. **Permission visibility**: Users won't see individual write prompts for
   operations inside REPL. Options:
   a) Log all operations after the fact (Phase 1 design)
   b) Pre-declare intent ("this script will write to: a.js, b.js, c.js")
   c) Delegate to canUseTool if we achieve Phase 4 integration
   Start with (a), iterate based on user feedback.

4. **Model prompting**: Claude is trained to use individual tools. System prompt
   patches should include clear guidance on when REPL is the right choice
   (3+ operations, scan-filter-act patterns, bulk reads) vs when individual
   tools are better (single file edit, one grep, clarity-critical operations).

5. **Embedded tools interaction**: When EMBEDDED_SEARCH_TOOLS is active, REPL's
   grep() should use ugrep (via argv0 dispatch on the claude binary) for
   consistency with the Bash tool's shadow functions. glob() should use bfs.

6. **Injected scope access**: What variables/modules are accessible from code
   loaded via `require()` from the tool registry? This determines whether
   Option B (CC tool handler delegation) is feasible. Investigate during
   patching engine development (P4).

## Dependencies

- **Patching engine (P4)**: Tool registry injection mechanism (shared with Tungsten)
- **Node/Bun vm module**: Available in both runtimes, no external dependency
- **Embedded tools activation**: For grep/glob handlers using ugrep/bfs
- No MCP SDK dependency
- No separate process dependency
