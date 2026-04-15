# Tool Injection

claude-governance injects three tools into CC's runtime: **Ping**, **REPL**, and **Tungsten**.
These are clean-room implementations of tools Anthropic builds for internal use but strips
from the external binary via dead-code elimination (DCE).

## How Tool Injection Works

### The Loader Chain

1. **Binary patch** (`src/patches/governance/tool-injection.ts`) modifies `getAllBaseTools()`:
   - Finds the function's return array via structural pattern matching
   - Appends `.concat(require('~/.claude-governance/tools/index.js'))`
   - In replace mode: also filters out primitive tools and stashes them

2. **Auto-discovery loader** (`data/tools/index.js`) runs at CC startup:
   - Scans `~/.claude-governance/tools/` for `.js` files (excluding itself and package.json)
   - `require()`s each file
   - Returns array of tool objects for CC's registry

3. **Tool registration** — CC's `assembleToolPool()` receives the concatenated array and
   registers each tool with its `inputJSONSchema` (bypasses Zod entirely)

### Tool Contract

Each tool must export an object matching CC's tool interface:

```javascript
module.exports = {
  name: 'ToolName',
  description: 'What the tool does',
  inputJSONSchema: { /* JSON Schema for args */ },
  isReadOnly: () => false,
  isTerminal: () => false,
  userFacingName: () => 'ToolName',
  call: async (args, context) => { /* implementation */ },
  prompt: () => 'Model-facing usage instructions',
};
```

The loader fills missing methods from CC's `TOOL_DEFAULTS`:
- `isReadOnly`, `isTerminal` — default to `() => false`
- `needsPermissions` — default to `() => true`
- `userFacingName` — default to `() => tool.name`

Key: tools use `inputJSONSchema` (not `inputSchema`). CC's `toolToAPISchema()` checks
`inputJSONSchema` first (MCP/external tool path), then `inputSchema` (Zod path). Our tools
use the MCP path to avoid Zod dependency.

## Ping Tool

**File:** `src/tools/ping/index.ts` → `data/tools/ping.js`

A diagnostic tool that echoes a message back. Used for:
- Verifying tool injection is working
- Runtime probe in `apply` and `setup` flows (via `claude -p "ping: test"`)
- Shape validation in `check` command

```javascript
// Simplified
call: async (args, context) => ({
  data: { message: args.message, pong: true }
})
```

## REPL Tool

**Source:** `src/tools/repl/` (16 modules) → `data/tools/repl.js` (33KB)

A JavaScript execution environment with access to CC's native tools via delegation.
Clean-room implementation — Anthropic's REPLTool.ts is DCE'd from the external binary
and not present in the leaked source.

### Architecture

```
Model sends script
      │
      ▼
REPL.call(args, context)
      │
      ├── Config loading (repl.mode, timeout, maxResultSize)
      │
      ├── VM execution (vm.ts)
      │     ├── Try direct execution (var/implicit globals persist)
      │     ├── On SyntaxError with await/return → IIFE wrapper fallback
      │     └── state object always persists on VM context
      │
      ├── Inner tool handlers resolve within script:
      │     read()  → CC's Read tool via context.options.tools
      │     write() → CC's Write tool
      │     edit()  → CC's Edit tool
      │     bash()  → CC's Bash tool
      │     grep()  → Constructs grep command → Bash tool
      │     glob()  → Constructs find command → Bash tool
      │     fetch() → CC's WebFetch tool (returns AI summary, not raw HTTP)
      │     agent() → CC's Agent tool
      │     notebook_edit() → CC's NotebookEdit tool
      │
      └── Result formatting (format.ts)
            ├── console.log output captured
            ├── Return value included
            └── Truncated at maxResultSize (default 100KB)
```

### Tool Delegation Pattern

Each handler finds its target tool and delegates:

```javascript
// Simplified read() handler
async function read(path, opts) {
  const readTool = findTool('Read');  // checks stashed tools first, then context.options.tools
  const result = await readTool.call(
    { file_path: path, ...opts },
    context,
    undefined,     // canUseTool
    parentMessage  // REQUIRED — must include { uuid, message: { id, role, content } }
  );
  return result.data.file.content;
}
```

**Critical:** The `parentMessage` (4th argument) must include `{ uuid, message: { id, role, content } }`.
CC's `FilePersistence` feature accesses `parentMessage.message.id`. Passing undefined is safe
(optional chaining short-circuits), but passing an incomplete object crashes. See Finding F17.

### Variable Persistence

| Script type | `var x = 1` | `const/let x = 1` | `x = 1` (bare) | `state.x = 1` |
|-------------|-------------|-------------------|-----------------|---------------|
| No `await`, no `return` | Persists | Block-scoped, lost | Persists | Persists |
| Has `await` or `return` (IIFE) | Function-scoped, lost | Function-scoped, lost | Persists (implicit global) | Persists |

The `state` object always persists because it's on the VM context, not in any function scope.

### Configuration

In `config.json`:
```json
{
  "repl": {
    "mode": "coexist",     // "coexist" (default) or "replace"
    "timeout": 120000,     // VM execution timeout in ms
    "maxResultSize": 100000 // Max result chars before truncation
  }
}
```

## Tungsten Tool

**Source:** `src/tools/tungsten/` (12 modules) → `data/tools/tungsten.js` (17KB)

Persistent terminal sessions via tmux. Clean-room implementation of Anthropic's
TungstenTool (DCE'd from external binary).

### Architecture

```
Model sends action
      │
      ▼
Tungsten.call(args, context)
      │
      ├── Validation (validate.ts)
      │
      ├── Action dispatch:
      │     create  → tmux new-session with PID-scoped socket
      │     send    → tmux send-keys + capture-pane
      │     capture → tmux capture-pane (read terminal state)
      │     list    → tmux list-sessions
      │     kill    → tmux kill-session + cleanup state
      │     interrupt → tmux send-keys C-c
      │
      ├── State management (state.ts)
      │     └── ~/.claude-governance/tungsten-state.json
      │
      └── FS9 chain — propagates tmux socket to all Bash commands
```

### FS9 Environment Propagation

The FS9 patch is critical to Tungsten's value. Without it, only `Tungsten send` has
tmux context. With it, **all** Bash commands (including REPL's `bash()`) inherit the
tmux environment.

How it works:

1. Tungsten tool creates a tmux session with a PID-scoped socket
2. Tungsten writes socket info to `process.env.__CLAUDE_GOVERNANCE_TMUX_ENV`
3. FS9 (patched in binary) reads that env var and returns the tmux socket path
4. CC's bashProvider calls FS9 unconditionally: `let z = FS9(); if (z) w.TMUX = z;`
5. Every Bash command now inherits the tmux environment

### Session Isolation

Sessions use PID-scoped sockets: `claude-{pid}.sock`

This means:
- Multiple CC instances don't conflict
- Socket files cleaned up on kill
- Stale PID detection in statusline

### State File

`~/.claude-governance/tungsten-state.json`:
```json
{
  "activeSession": "main",
  "sessions": ["main"],
  "pid": 12345,
  "socket": "/tmp/tmux-501/claude-12345.sock"
}
```

### Live Panel

The Tungsten live panel (`data/ui/tungsten-panel.js`) renders in CC's TUI:
- Injected at the DCE'd `TungstenLiveMonitor` site in the React render tree
- Uses CC's React (`createElement`), Ink (`Box`, `Text`), and `useAppState` hook
- Reads state via AppState (Zustand-like store, triggers re-renders)
- 2-second polling interval
- Shows: active session name, last command, session list

## Tool Verification

Tools are verified at three levels:

1. **Signature check** (`check` command) — `__claude_governance_tools__` present in binary
2. **Module validation** (`check` command) — `require()` each tool, verify `name`, `call`, `prompt`, `description`, `inputJSONSchema` present
3. **Runtime probe** (`apply`/`setup` flows) — `claude -p "ping: test"` actually invokes Ping tool and checks response

The `check` output shows:
```
Tool Injection:
  ✓ Tool Injection — external tool loader active
  ✓ Tungsten: bashProvider tmux Activation — FS9() reads Tungsten socket info
  ✓ Tungsten: Live Panel Injection — present (requires live session to verify rendering)
```
