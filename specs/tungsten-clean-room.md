# Clean-Room Tungsten: Persistent Terminal

Version: 0.2 (design spec)
Date: 2026-04-12
Status: Draft — revised for native tool injection

## Problem Statement

The Bash tool spawns a fresh shell for every invocation. Environment variables, working
directory changes, running processes, and shell state are lost between calls. This
forces Claude into a pattern of re-establishing context on every command — slow,
token-expensive, and fundamentally limited.

Anthropic's internal TungstenTool solves this with persistent tmux sessions. The tool
and its implementation are stripped from external builds (`USER_TYPE === 'ant'` gate,
build-time DCE). We need a clean-room equivalent.

## What Ant Tungsten Does

Reconstructed from state shapes, infrastructure, and callsite analysis. The actual
TungstenTool.ts was not in the leaked source dump.

### Capabilities
- **Persistent tmux session**: Create named sessions, send commands, capture output
- **Singleton state**: One active session per agent (stored in AppState)
- **Socket isolation**: Each Claude process gets its own tmux socket (`claude-<PID>`)
  via `tmuxSocket.ts`, preventing collision with user's tmux environment
- **Live terminal panel**: `TungstenLiveMonitor` renders real-time pane content in CC UI
- **Session metadata**: Tracks active session name, socket, target pane, last command,
  last capture time, panel visibility (persisted to `~/.claude.json`)
- **Blocked for async agents**: Singleton state conflicts between concurrent agents

### State Shape (from AppStateStore.ts)
```typescript
tungstenActiveSession?: {
  sessionName: string
  socketName: string    // claude-<PID>
  target: string        // session:window.pane
}
tungstenLastCapturedTime?: number
tungstenLastCommand?: { command: string; timestamp: number }
tungstenPanelVisible?: boolean
tungstenPanelAutoHidden?: boolean
```

### What Made It Valuable
1. `npm run dev` stays running between tool calls
2. `cd` and `export` persist — no re-setup per command
3. Interactive debuggers, REPLs, test watchers survive across turns
4. Claude can check on long processes without restarting them

## Our Approach: Native Tool Injection

Tungsten must be a first-class native tool — same as Bash, Read, Edit. MCP and hooks
are second-class citizens: MCP tools have process overhead, can't integrate with CC
internals, and get lesser treatment in system prompt routing. Hook-based conventions
depend on CLAUDE.md compliance — the very thing we're fighting against.

We inject a native tool into the CC binary's tool registry. The approach:

1. **Minimal binary patch**: Modify the tool registry function to `require()` our
   external tool implementation and append it to the tool array.
2. **Tool code lives on disk**: `~/.claudemd-governance/tools/tungsten.js` — readable,
   testable, updatable without re-patching the binary.
3. **First-class integration**: Tool appears in the tools block alongside Bash/Read/Edit.
   Gets proper system prompt routing, permission handling, structured I/O.

### Why Native Over MCP/Hooks

| Concern | MCP/Hook approach | Native tool |
|---------|-------------------|-------------|
| System prompt integration | Second-class / none | First-class, same as Bash |
| Permission model | Independent / CLAUDE.md dependent | CC's canUseTool pipeline |
| Latency | +50-100ms IPC per call | Zero overhead, in-process |
| Resilience to CLAUDE.md degradation | Breaks if instructions ignored | Works regardless |
| Tool routing | Separate MCP section in tools block | Native tools section |
| UI rendering | Generic MCP output | Can match BashTool rendering |

### Dependency: Patching Engine (P4)

Native tool injection requires our tweakCC replacement to support modifying the tool
registry function in the minified JS. This is the same class of operation we already
do (string replacement in JS bundle) but targeting a different function. The tool
injection mechanism is designed as part of the P4 patching engine.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ Binary Patch (via governance patching engine)        │
│   Modifies tool registry: getAllBaseTools()          │
│   Adds: require('~/.claudemd-governance/tools/')    │
│   Minimal patch — just the registration hook        │
├─────────────────────────────────────────────────────┤
│ Tool Implementation (on disk, updatable)             │
│   ~/.claudemd-governance/tools/tungsten.js          │
│   - Exports tool object: name, schema, handler      │
│   - Handler manages tmux sessions via child_process  │
│   - Socket isolation per Claude process              │
│   - State tracking in process scope                  │
├─────────────────────────────────────────────────────┤
│ tmux (system)                                        │
│   - Persistent sessions with isolated sockets        │
│   - Real PTY, full shell, ANSI support               │
│   - Processes survive between tool calls             │
├─────────────────────────────────────────────────────┤
│ SessionStart Hook (auxiliary)                         │
│   - Pre-creates default tmux session                 │
│   - Writes initial state for statusline              │
│   - Cleanup on SessionEnd                            │
├─────────────────────────────────────────────────────┤
│ Statusline: TNG segment                              │
│   - Shows active session health                      │
│   - Window count, last command                       │
└─────────────────────────────────────────────────────┘
```

## Detailed Design

### 1. Tool Interface

Single tool with an `action` parameter, matching the ant's likely interface pattern:

```typescript
{
  name: "Tungsten",
  description: "Persistent terminal session. Use for long-running processes, " +
    "stateful shell work, and commands that must survive between tool calls. " +
    "Unlike Bash, environment variables, working directory, and running " +
    "processes persist across invocations.",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["send", "capture", "create", "list", "kill", "interrupt"],
        description: "send: execute command, capture: read terminal output, " +
          "create: new session/window, list: show sessions, kill: end session, " +
          "interrupt: send Ctrl-C"
      },
      command: {
        type: "string",
        description: "Command to send (for 'send' action)"
      },
      session: {
        type: "string",
        description: "Session name (default: 'main')"
      },
      lines: {
        type: "number",
        description: "Lines of scrollback to capture (default: 50)"
      }
    },
    required: ["action"]
  }
}
```

### 2. Handler Implementation

The handler runs inside the CC process. It has access to `child_process`, `fs`,
and the full Node/Bun runtime. tmux operations are synchronous shell commands:

```javascript
// ~/.claudemd-governance/tools/tungsten.js
const { execSync } = require('child_process');

// Socket isolation — one per CC process
const SOCKET = `claude-${process.ppid}`;

const handler = async ({ action, command, session = 'main', lines = 50 }) => {
  switch (action) {
    case 'create':
      execSync(`tmux -L ${SOCKET} new-session -d -s ${session} -x 200 -y 50`);
      return { status: 'created', session, socket: SOCKET };

    case 'send':
      ensureSession(session);
      execSync(`tmux -L ${SOCKET} send-keys -t ${session} ${shellEscape(command)} Enter`);
      // Brief delay then capture to show immediate output
      await sleep(100);
      return { status: 'sent', output: capture(session, 20) };

    case 'capture':
      return { output: capture(session, lines) };

    case 'interrupt':
      execSync(`tmux -L ${SOCKET} send-keys -t ${session} C-c`);
      await sleep(100);
      return { output: capture(session, 10) };

    case 'list':
      const out = execSync(`tmux -L ${SOCKET} list-sessions -F '#{session_name}: #{session_windows} windows'`,
        { encoding: 'utf-8' }).trim();
      return { sessions: out.split('\n') };

    case 'kill':
      execSync(`tmux -L ${SOCKET} kill-session -t ${session}`);
      return { status: 'killed', session };
  }
};
```

### 3. Auto-Initialization

The tool lazily creates the default session on first use — no SessionStart hook
needed for basic operation. The `ensureSession()` helper:

```javascript
function ensureSession(name) {
  try {
    execSync(`tmux -L ${SOCKET} has-session -t ${name} 2>/dev/null`);
  } catch (_) {
    execSync(`tmux -L ${SOCKET} new-session -d -s ${name} -x 200 -y 50`);
  }
}
```

A SessionStart hook is still useful for pre-warming (faster first call) and writing
initial state for the statusline, but the tool works without it.

### 4. Cleanup (SessionEnd/Stop hook)

```javascript
exec(`tmux -L ${SOCKET} kill-server 2>/dev/null`);
```

### 5. Statusline Integration

TNG segment in the combined statusline:
- `TNG` (green) — active session, healthy
- `TNG:2w` — active with 2 windows
- No segment if no session active

## Risk Analysis

### tmux Not Installed
- macOS: Ships with tmux pre-installed.
- Linux: Most distros include it. If missing, tool handler returns clear error.
- Windows: Not supported natively. WSL has tmux.
- **Mitigation**: Tool handler checks for tmux on first call, returns actionable error.
  Tool is still registered (removing it would require re-patching). It just fails
  gracefully with a message explaining what's needed.

### Socket Collision
- PID-based socket names prevent collision between concurrent Claude sessions.
- **Mitigation**: Cleanup hook on SessionEnd kills the socket's server.
  Stale socket detection on init (check if owning PID is still alive).

### Session State Divergence
- Claude may lose track of what's running after context compaction.
- **Mitigation**: The `send` action auto-captures output after each command.
  The `capture` action is cheap — encourage frequent use. System prompt patch
  can add "capture before sending to long-running sessions" as tool guidance.

### Binary Patch Fragility
- The tool registry function may change shape across versions.
- **Mitigation**: The patch is minimal (append to array). The pattern "function
  returns array of tools" is structurally stable — it can't change without
  breaking CC's own tool loading. Verification hook confirms tool is registered.

## Implementation Phases

### Phase 1: Tool Implementation + Injection Mechanism
- Write `~/.claudemd-governance/tools/tungsten.js` with full handler
- Build tool registry injection in the patching engine (P4 dependency)
- Basic actions: create, send, capture, kill, interrupt, list
- Socket isolation, lazy session creation
- Cleanup hook on SessionEnd

### Phase 2: System Prompt Integration
- Patch system prompt to include Tungsten usage guidance alongside Bash guidance
- "Use Tungsten for persistent processes, Bash for one-shot commands"
- Verification hook confirms tool is in registry and tmux is available

### Phase 3: Multi-Session + Advanced Features
- Named sessions for different purposes (dev-server, tests, debug)
- Window/pane management within sessions
- Scrollback search helper
- Integration with Monitor tool for event streaming from persistent processes

### Phase 4: Statusline + State Tracking
- TNG segment in combined statusline
- State file tracking active sessions, health, last commands
- Auto-capture on session resume after compaction

## Open Questions

1. **Window size**: 200x50 default. Configurable per-session? Wider = more output
   per capture, but more tokens consumed. May want adaptive sizing.

2. **Cross-session persistence**: Should tmux sessions survive CC restarts?
   Pro: don't lose running dev servers. Con: stale sessions accumulate.
   Lean toward cleanup on end, with opt-in persistence via config.

3. **Monitor integration**: Monitor tool (enabled in 2.1.101) can stream events
   from background processes. Tungsten + Monitor could be powerful: Tungsten
   runs the process, Monitor streams its output as notifications. Worth
   designing the integration point.

4. **Permission model**: Should Tungsten commands go through the same Bash
   permission checks? The tool runs shell commands internally. At minimum,
   the tool should be in the permission system so users can allow/deny it.
   Inner shell commands probably don't need individual permission prompts
   since the user already approved the Tungsten tool call.

5. **System prompt token budget**: Adding a new tool definition + guidance
   costs tokens. How much budget does Tungsten consume, and is that
   acceptable given the value it provides? Measure after implementation.
