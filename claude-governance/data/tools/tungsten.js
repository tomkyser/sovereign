// Clean-Room Tungsten — Persistent Execution Context
// Manages isolated tmux sessions for stateful shell work. Environment variables,
// working directory, and running processes survive between tool calls.
// Architecture: PID-based socket isolation, lazy session creation, auto-capture.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ======================================================================
// Socket Isolation — one tmux server per CC process
// ======================================================================

const SOCKET_NAME = `claude-${process.pid}`;
let socketPath = null;
let serverPid = null;
let initialized = false;
let tmuxChecked = false;
let tmuxAvailable = false;
let currentContext = null;

// Communication channel for FS9 binary patch — the patch reads this env var
// to return socket info to bashProvider's getEnvironmentOverrides().
// process.env is synchronous, global, and race-free within a single process.
const TMUX_ENV_KEY = '__CLAUDE_GOVERNANCE_TMUX_ENV';

function getConfigDir() {
  return process.env.CLAUDE_GOVERNANCE_CONFIG_DIR ||
    path.join(os.homedir(), '.claude-governance');
}

// ======================================================================
// tmux Availability Check
// ======================================================================

function checkTmux() {
  if (tmuxChecked) return tmuxAvailable;
  tmuxChecked = true;
  try {
    execFileSync('which', ['tmux'], { stdio: 'pipe' });
    tmuxAvailable = true;
  } catch (_) {
    tmuxAvailable = false;
  }
  return tmuxAvailable;
}

// ======================================================================
// tmux Command Helpers
// ======================================================================

function tmuxCmd(args, opts) {
  // Use execFileSync to avoid shell quoting issues with tmux format strings
  return execFileSync('tmux', ['-L', SOCKET_NAME, ...args], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 10000,
    ...opts,
  });
}

function tmuxCmdSafe(args) {
  try {
    return { ok: true, stdout: tmuxCmd(args).trim() };
  } catch (e) {
    return { ok: false, stderr: (e.stderr || e.message || '').trim() };
  }
}

// ======================================================================
// Session Lifecycle
// ======================================================================

function validateSessionName(name) {
  if (!name || !name.trim()) {
    throw new Error('Session name cannot be empty.');
  }
  if (/[.:]/.test(name)) {
    throw new Error(
      `Invalid session name "${name}". Names cannot contain "." or ":" (tmux reserved characters).`
    );
  }
  if (name !== name.trim()) {
    throw new Error(
      `Invalid session name "${name}". Names cannot have leading/trailing whitespace.`
    );
  }
}

function ensureSession(name) {
  validateSessionName(name);
  if (!initialized) initSocket();
  const result = tmuxCmdSafe(['has-session', '-t', name]);
  if (!result.ok) createSession(name);
}

function createSession(name) {
  if (!initialized) initSocket();
  tmuxCmd(['new-session', '-d', '-s', name, '-x', '200', '-y', '50']);
  discoverSocketInfo();
  writeAppState(name);
  writeStateFile(name);
}

function initSocket() {
  if (initialized) return;
  if (!checkTmux()) {
    throw new Error(
      'tmux is not installed. Tungsten requires tmux for persistent sessions.\n' +
      'Install: brew install tmux (macOS) | apt install tmux (Debian/Ubuntu)'
    );
  }
  initialized = true;
  registerCleanup();
}

function discoverSocketInfo() {
  try {
    const info = tmuxCmd(
      ['display-message', '-p', '#{socket_path},#{pid}'],
      { timeout: 5000 }
    ).trim();
    const [sp, pidStr] = info.split(',');
    if (sp && pidStr) {
      socketPath = sp;
      serverPid = parseInt(pidStr, 10);
      process.env[TMUX_ENV_KEY] = `${socketPath},${serverPid},0`;
    }
  } catch (_) {
    const uid = process.getuid?.() ?? 0;
    const tmpDir = process.env.TMPDIR || '/tmp';
    socketPath = path.join(tmpDir, `tmux-${uid}`, SOCKET_NAME);
  }
}

// ======================================================================
// Capture — read terminal content from a pane
// ======================================================================

function capture(session, lines) {
  try {
    const output = tmuxCmd(
      ['capture-pane', '-t', session, '-p', '-S', `-${lines}`]
    );
    return output.replace(/\n+$/, '');
  } catch (e) {
    return `[capture failed: ${(e.message || '').split('\n')[0]}]`;
  }
}

// ======================================================================
// AppState Communication — tool writes, UI panel reads
// ======================================================================

function writeAppState(sessionName) {
  if (!currentContext) return;
  try {
    if (typeof currentContext.setAppState === 'function') {
      currentContext.setAppState(function(prev) {
        return Object.assign({}, prev, {
          tungstenActiveSession: {
            sessionName: sessionName,
            socketName: SOCKET_NAME,
            target: `${sessionName}:0.0`,
          },
          tungstenPanelVisible: true,
        });
      });
    }
  } catch (_) {
    // AppState write is best-effort — tool works without it
  }
}

function writeLastCommand(command) {
  if (!currentContext) return;
  try {
    if (typeof currentContext.setAppState === 'function') {
      currentContext.setAppState(function(prev) {
        return Object.assign({}, prev, {
          tungstenLastCommand: { command: command, timestamp: Date.now() },
          tungstenLastCapturedTime: Date.now(),
        });
      });
    }
  } catch (_) {}
}

// ======================================================================
// State File — for statusline and session hooks to read
// ======================================================================

function writeStateFile(sessionName) {
  try {
    const stateDir = getConfigDir();
    const statePath = path.join(stateDir, 'tungsten-state.json');
    const state = {
      socket: SOCKET_NAME,
      socketPath: socketPath,
      serverPid: serverPid,
      activeSession: sessionName,
      pid: process.pid,
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch (_) {
    // State file is best-effort
  }
}

function clearStateFile() {
  try {
    const statePath = path.join(getConfigDir(), 'tungsten-state.json');
    if (fs.existsSync(statePath)) fs.unlinkSync(statePath);
  } catch (_) {}
}

// ======================================================================
// Cleanup — kill tmux server on process exit
// ======================================================================

let cleanupRegistered = false;

function registerCleanup() {
  if (cleanupRegistered) return;
  cleanupRegistered = true;

  const cleanup = () => {
    try {
      execFileSync('tmux', ['-L', SOCKET_NAME, 'kill-server'], {
        stdio: 'pipe',
        timeout: 5000,
      });
    } catch (_) {}
    delete process.env[TMUX_ENV_KEY];
    clearStateFile();
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.on('SIGTERM', () => { cleanup(); process.exit(143); });
}

// ======================================================================
// Sleep helper
// ======================================================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ======================================================================
// Action Handlers
// ======================================================================

async function handleCreate(args) {
  const session = args.session || 'main';
  validateSessionName(session);
  if (initialized) {
    const exists = tmuxCmdSafe(['has-session', '-t', session]);
    if (exists.ok) {
      return {
        data: `Session "${session}" already exists on socket ${SOCKET_NAME}.`,
      };
    }
  }
  createSession(session);
  return {
    data: `Session "${session}" created on socket ${SOCKET_NAME}.\n` +
      'Environment variables, working directory, and processes will persist across tool calls.',
  };
}

async function handleSend(args) {
  const session = args.session || 'main';
  const command = args.command;
  if (!command) {
    throw new Error('The "command" parameter is required for the "send" action.');
  }
  ensureSession(session);

  // Send command as literal text (-l prevents key name interpretation),
  // then send Enter separately as a key name
  tmuxCmd(['send-keys', '-t', session, '-l', command]);
  tmuxCmd(['send-keys', '-t', session, 'Enter']);

  writeLastCommand(command);

  // Brief delay then capture output so the model sees immediate results
  await sleep(150);
  const output = capture(session, args.lines || 30);

  return {
    data: `$ ${command}\n${output}`,
  };
}

async function handleCapture(args) {
  const session = args.session || 'main';
  const lines = args.lines || 50;
  ensureSession(session);

  const output = capture(session, lines);

  if (currentContext && typeof currentContext.setAppState === 'function') {
    try {
      currentContext.setAppState(function(prev) {
        return Object.assign({}, prev, { tungstenLastCapturedTime: Date.now() });
      });
    } catch (_) {}
  }

  return {
    data: output || '(empty — no output in terminal)',
  };
}

async function handleList() {
  if (!initialized || !checkTmux()) {
    return { data: 'No active Tungsten sessions.' };
  }
  const result = tmuxCmdSafe([
    'list-sessions', '-F',
    '#{session_name}: #{session_windows} window(s)',
  ]);
  if (!result.ok) {
    return { data: 'No active Tungsten sessions.' };
  }
  return { data: `Active sessions (socket: ${SOCKET_NAME}):\n${result.stdout}` };
}

async function handleKill(args) {
  const session = args.session || 'main';
  validateSessionName(session);
  const result = tmuxCmdSafe(['kill-session', '-t', session]);
  if (!result.ok) {
    return { data: `Session "${session}" not found or already killed.` };
  }

  const listResult = tmuxCmdSafe(['list-sessions', '-F', '#{session_name}']);
  if (!listResult.ok || !listResult.stdout.trim()) {
    delete process.env[TMUX_ENV_KEY];
    clearStateFile();
    if (currentContext && typeof currentContext.setAppState === 'function') {
      try {
        currentContext.setAppState(function(prev) {
          return Object.assign({}, prev, {
            tungstenActiveSession: undefined,
            tungstenPanelVisible: false,
          });
        });
      } catch (_) {}
    }
    return { data: `Session "${session}" killed. No sessions remaining.` };
  }

  const remaining = listResult.stdout.trim().split('\n').filter(Boolean);
  const nextSession = remaining[0];
  writeAppState(nextSession);
  writeStateFile(nextSession);

  return {
    data: `Session "${session}" killed. Active session: "${nextSession}".`,
  };
}

async function handleInterrupt(args) {
  const session = args.session || 'main';
  ensureSession(session);

  tmuxCmd(['send-keys', '-t', session, 'C-c'], { timeout: 5000 });

  await sleep(150);
  const output = capture(session, 10);

  return {
    data: `Interrupt (Ctrl-C) sent to "${session}".\n${output}`,
  };
}

// ======================================================================
// Tool Export
// ======================================================================

module.exports = {
  name: 'Tungsten',

  inputJSONSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['send', 'capture', 'create', 'list', 'kill', 'interrupt'],
        description:
          'send: execute a command in the session. ' +
          'capture: read current terminal output. ' +
          'create: create a new named session. ' +
          'list: show all active sessions. ' +
          'kill: end a session. ' +
          'interrupt: send Ctrl-C to the session.',
      },
      command: {
        type: 'string',
        description: 'Command to execute (required for "send" action)',
      },
      session: {
        type: 'string',
        description: 'Session name (default: "main")',
      },
      lines: {
        type: 'number',
        description: 'Lines of terminal output to capture (default: 50 for capture, 30 for send)',
      },
    },
    required: ['action'],
  },

  async prompt() {
    return `# Tungsten — Persistent Execution Context

Tungsten provides persistent terminal sessions via tmux. A session is established at the start of every work session — create one as your first action. Once active, all Bash and REPL commands automatically inherit the persistent environment via FS9. Environment variables, working directory, and running processes survive between tool calls.

## Tungsten send vs Bash

Both execute shell commands within the persistent environment. The difference is state modification vs read operations:

**Use Tungsten send to:**
- Modify session state (cd, export, source, nvm use)
- Start long-running processes (dev servers, file watchers, test runners)
- Run interactive REPLs (python3, psql, node, irb, sqlite3)
- Manage concurrent workstreams in named sessions
- Check on background processes (capture)

**Use Bash for:**
- Commands where you need the exit code
- Quick read-only operations (ls, git status, grep)
- Simple file operations that don't modify session state

Both benefit from the persistent context — Bash inherits the working directory, env vars, and TMUX environment set via Tungsten.

## Session Lifecycle

1. **Start of session:** \`Tungsten({action: "create"})\` — establish persistent context as your first action
2. **During work:** Use Tungsten send for state changes and long-running processes, Bash for reads and exit codes
3. **End of session:** \`Tungsten({action: "kill"})\` — clean up resources when done

Sessions are also cleaned up automatically when Claude exits.

## Actions

### send — Execute a command
Sends a command to the session and captures immediate output.
- Creates session automatically if it doesn't exist
- \`command\` is required
- Returns the command output after a brief delay

### capture — Read terminal output
Reads the current visible content of the terminal pane.
- Use to check on long-running processes
- \`lines\` controls scrollback depth (default: 50)
- Cheap operation — use frequently to stay informed

### create — Create a named session
Explicitly creates a new session. Useful for multiple concurrent workstreams.
- Session name defaults to "main"
- Example: create a "tests" session and a "server" session

### list — Show all active sessions
Lists all sessions on this socket with window count.

### kill — End a session
Terminates a session and all its processes.

### interrupt — Send Ctrl-C
Sends an interrupt signal to stop the current command.
- Useful for stopping runaway processes
- Captures output after the interrupt

## Patterns

### Dev server + tests
\`\`\`
Tungsten({action: "send", command: "npm run dev", session: "server"})
Tungsten({action: "send", command: "npm test -- --watch", session: "tests"})
// Later: check on server
Tungsten({action: "capture", session: "server"})
\`\`\`

### Stateful environment setup
\`\`\`
Tungsten({action: "send", command: "cd /path/to/project && source .env"})
Tungsten({action: "send", command: "echo $DATABASE_URL"})  // persisted!
\`\`\`

### Long build with monitoring
\`\`\`
Tungsten({action: "send", command: "make -j8 all"})
// ... do other work ...
Tungsten({action: "capture", lines: 100})  // check progress
\`\`\`

### Any-language REPL
\`\`\`
Tungsten({action: "send", command: "python3", session: "py"})
Tungsten({action: "send", command: "import pandas as pd; df = pd.read_csv('data.csv')", session: "py"})
Tungsten({action: "send", command: "df.describe()", session: "py"})
// Also works with: psql, node, irb, sqlite3, lua, etc.
\`\`\`

### Multi-session orchestration
\`\`\`
Tungsten({action: "send", command: "npm run dev", session: "server"})
Tungsten({action: "send", command: "npm run worker", session: "worker"})
Tungsten({action: "send", command: "npm test -- --watch", session: "tests"})
// Monitor all:
Tungsten({action: "capture", session: "server"})
Tungsten({action: "capture", session: "worker"})
Tungsten({action: "capture", session: "tests"})
\`\`\`

## Environment Propagation (FS9)
Once any Tungsten session is created, the tmux socket info is written to \`process.env\`. The FS9 binary patch reads this and passes it to bashProvider, which sets \`TMUX\` in the environment for all child processes. This means:
- Bash tool commands inherit the tmux environment automatically
- REPL's \`bash()\` function inherits via the same path
- Spawned agents inherit via \`process.env\`
- State set in Tungsten (env vars, running servers, working directory) is visible to all subsequent tool calls

## Anti-Patterns
- **Don't accumulate sessions.** Kill sessions when done. Each session holds a tmux pane and process tree.
- **Don't capture before sending.** A new session's terminal is empty — capture immediately after create returns nothing useful.
- **Don't use Tungsten send when you need exit codes.** Tungsten captures output text, not exit status. Use Bash when the exit code matters.
- **Don't skip session creation.** Bash inherits the persistent environment only after a Tungsten session exists. Create one first.

## Notes
- Sessions are isolated per Claude process — they don't interfere with your tmux sessions
- Sessions are cleaned up automatically when Claude exits
- After Tungsten is used, Bash commands also inherit the tmux environment
- If tmux is not installed, the tool returns an actionable error message
- When a session is active, a panel appears in the TUI showing session state
- Agents spawned during a Tungsten session inherit the tmux environment via process.env`;
  },

  async description() {
    return 'Persistent terminal session — environment, working directory, and processes survive between calls';
  },

  async call(args, context) {
    currentContext = context;

    switch (args.action) {
      case 'create':    return handleCreate(args);
      case 'send':      return handleSend(args);
      case 'capture':   return handleCapture(args);
      case 'list':      return handleList(args);
      case 'kill':      return handleKill(args);
      case 'interrupt': return handleInterrupt(args);
      default:
        throw new Error(
          `Unknown action "${args.action}". ` +
          'Valid actions: send, capture, create, list, kill, interrupt'
        );
    }
  },
};
