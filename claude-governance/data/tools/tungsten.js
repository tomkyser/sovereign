//#region rolldown:runtime
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
	if (from && typeof from === "object" || typeof from === "function") {
		for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
			key = keys[i];
			if (!__hasOwnProp.call(to, key) && key !== except) {
				__defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
		}
	}
	return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
	value: mod,
	enumerable: true
}) : target, mod));

//#endregion
let node_fs = require("node:fs");
node_fs = __toESM(node_fs);
let node_path = require("node:path");
node_path = __toESM(node_path);
let node_os = require("node:os");
node_os = __toESM(node_os);
let node_child_process = require("node:child_process");

//#region src/tools/tungsten/schema.ts
const inputJSONSchema = {
	type: "object",
	properties: {
		action: {
			type: "string",
			enum: [
				"send",
				"capture",
				"create",
				"list",
				"kill",
				"interrupt"
			],
			description: "send: execute a command in the session. capture: read current terminal output. create: create a new named session. list: show all active sessions. kill: end a session. interrupt: send Ctrl-C to the session."
		},
		command: {
			type: "string",
			description: "Command to execute (required for \"send\" action)"
		},
		session: {
			type: "string",
			description: "Session name (default: \"main\")"
		},
		lines: {
			type: "number",
			description: "Lines of terminal output to capture (default: 50 for capture, 30 for send)"
		}
	},
	required: ["action"]
};

//#endregion
//#region src/tools/tungsten/prompt.ts
function getPrompt() {
	return `# Tungsten \u2014 Persistent Execution Context

Tungsten provides persistent terminal sessions via tmux. A session is established at the start of every work session \u2014 create one as your first action. Once active, all Bash and REPL commands automatically inherit the persistent environment via FS9. Environment variables, working directory, and running processes survive between tool calls.

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

Both benefit from the persistent context \u2014 Bash inherits the working directory, env vars, and TMUX environment set via Tungsten.

## Session Lifecycle

1. **Start of session:** \`Tungsten({action: "create"})\` \u2014 establish persistent context as your first action
2. **During work:** Use Tungsten send for state changes and long-running processes, Bash for reads and exit codes
3. **End of session:** \`Tungsten({action: "kill"})\` \u2014 clean up resources when done

Sessions are also cleaned up automatically when Claude exits.

## Actions

### send \u2014 Execute a command
Sends a command to the session and captures immediate output.
- Creates session automatically if it doesn't exist
- \`command\` is required
- Returns the command output after a brief delay

### capture \u2014 Read terminal output
Reads the current visible content of the terminal pane.
- Use to check on long-running processes
- \`lines\` controls scrollback depth (default: 50)
- Cheap operation \u2014 use frequently to stay informed

### create \u2014 Create a named session
Explicitly creates a new session. Useful for multiple concurrent workstreams.
- Session name defaults to "main"
- Example: create a "tests" session and a "server" session

### list \u2014 Show all active sessions
Lists all sessions on this socket with window count.

### kill \u2014 End a session
Terminates a session and all its processes.

### interrupt \u2014 Send Ctrl-C
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
- **Don't capture before sending.** A new session's terminal is empty \u2014 capture immediately after create returns nothing useful.
- **Don't use Tungsten send when you need exit codes.** Tungsten captures output text, not exit status. Use Bash when the exit code matters.
- **Don't skip session creation.** Bash inherits the persistent environment only after a Tungsten session exists. Create one first.

## Notes
- Sessions are isolated per Claude process \u2014 they don't interfere with your tmux sessions
- Sessions are cleaned up automatically when Claude exits
- After Tungsten is used, Bash commands also inherit the tmux environment
- If tmux is not installed, the tool returns an actionable error message
- When a session is active, a panel appears in the TUI showing session state
- Agents spawned during a Tungsten session inherit the tmux environment via process.env`;
}

//#endregion
//#region src/tools/tungsten/tmux.ts
const SOCKET_NAME = `claude-${process.pid}`;
const TMUX_ENV_KEY = "__CLAUDE_GOVERNANCE_TMUX_ENV";
let socketPath = null;
let serverPid = null;
let initialized = false;
let tmuxChecked = false;
let tmuxAvailable = false;
let cleanupRegistered = false;
function getSocketPath() {
	return socketPath;
}
function getServerPid() {
	return serverPid;
}
function isInitialized() {
	return initialized;
}
function checkTmux() {
	if (tmuxChecked) return tmuxAvailable;
	tmuxChecked = true;
	try {
		(0, node_child_process.execFileSync)("which", ["tmux"], { stdio: "pipe" });
		tmuxAvailable = true;
	} catch {
		tmuxAvailable = false;
	}
	return tmuxAvailable;
}
function tmuxCmd(args, opts) {
	return (0, node_child_process.execFileSync)("tmux", [
		"-L",
		SOCKET_NAME,
		...args
	], {
		encoding: "utf-8",
		stdio: [
			"pipe",
			"pipe",
			"pipe"
		],
		timeout: 1e4,
		...opts
	});
}
function tmuxCmdSafe(args) {
	try {
		return {
			ok: true,
			stdout: tmuxCmd(args).trim()
		};
	} catch (e) {
		const err = e;
		return {
			ok: false,
			stderr: (err.stderr || err.message || "").trim()
		};
	}
}
function initSocket() {
	if (initialized) return;
	if (!checkTmux()) throw new Error("tmux is not installed. Tungsten requires tmux for persistent sessions.\nInstall: brew install tmux (macOS) | apt install tmux (Debian/Ubuntu)");
	initialized = true;
	registerCleanup();
}
function discoverSocketInfo() {
	try {
		const [sp, pidStr] = tmuxCmd([
			"display-message",
			"-p",
			"#{socket_path},#{pid}"
		], { timeout: 5e3 }).trim().split(",");
		if (sp && pidStr) {
			socketPath = sp;
			serverPid = parseInt(pidStr, 10);
			process.env[TMUX_ENV_KEY] = `${socketPath},${serverPid},0`;
		}
	} catch {
		const uid = process.getuid?.() ?? 0;
		const tmpDir = process.env.TMPDIR || "/tmp";
		socketPath = node_path.join(tmpDir, `tmux-${uid}`, SOCKET_NAME);
	}
}
function capture(session, lines) {
	try {
		return tmuxCmd([
			"capture-pane",
			"-t",
			session,
			"-p",
			"-S",
			`-${lines}`
		]).replace(/\n+$/, "");
	} catch (e) {
		return `[capture failed: ${(e instanceof Error ? e.message : "").split("\n")[0]}]`;
	}
}
function registerCleanup() {
	if (cleanupRegistered) return;
	cleanupRegistered = true;
	const cleanup = () => {
		try {
			(0, node_child_process.execFileSync)("tmux", [
				"-L",
				SOCKET_NAME,
				"kill-server"
			], {
				stdio: "pipe",
				timeout: 5e3
			});
		} catch {}
		delete process.env[TMUX_ENV_KEY];
	};
	process.on("exit", cleanup);
	process.on("SIGINT", () => {
		cleanup();
		process.exit(130);
	});
	process.on("SIGTERM", () => {
		cleanup();
		process.exit(143);
	});
}
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

//#endregion
//#region src/tools/tungsten/state.ts
let currentContext = null;
function getCurrentContext() {
	return currentContext;
}
function setCurrentContext(ctx) {
	currentContext = ctx;
}
function getConfigDir() {
	return process.env["CLAUDE_GOVERNANCE_CONFIG_DIR"] || node_path.join(node_os.homedir(), ".claude-governance");
}
function writeAppState(sessionName) {
	if (!currentContext) return;
	try {
		if (typeof currentContext.setAppState === "function") currentContext.setAppState(function(prev) {
			return Object.assign({}, prev, {
				tungstenActiveSession: {
					sessionName,
					socketName: SOCKET_NAME,
					target: `${sessionName}:0.0`
				},
				tungstenPanelVisible: true
			});
		});
	} catch {}
}
function writeLastCommand(command) {
	if (!currentContext) return;
	try {
		if (typeof currentContext.setAppState === "function") currentContext.setAppState(function(prev) {
			return Object.assign({}, prev, {
				tungstenLastCommand: {
					command,
					timestamp: Date.now()
				},
				tungstenLastCapturedTime: Date.now()
			});
		});
	} catch {}
}
function writeStateFile(sessionName) {
	try {
		const stateDir = getConfigDir();
		const statePath = node_path.join(stateDir, "tungsten-state.json");
		const state = {
			socket: SOCKET_NAME,
			socketPath: getSocketPath(),
			serverPid: getServerPid(),
			activeSession: sessionName,
			pid: process.pid,
			timestamp: (/* @__PURE__ */ new Date()).toISOString()
		};
		node_fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
	} catch {}
}
function clearStateFile() {
	try {
		const statePath = node_path.join(getConfigDir(), "tungsten-state.json");
		if (node_fs.existsSync(statePath)) node_fs.unlinkSync(statePath);
	} catch {}
}

//#endregion
//#region src/tools/tungsten/validate.ts
function validateSessionName(name) {
	if (!name || !name.trim()) throw new Error("Session name cannot be empty.");
	if (/[.:]/.test(name)) throw new Error(`Invalid session name "${name}". Names cannot contain "." or ":" (tmux reserved characters).`);
	if (name !== name.trim()) throw new Error(`Invalid session name "${name}". Names cannot have leading/trailing whitespace.`);
}
function ensureSession(name) {
	validateSessionName(name);
	if (!isInitialized()) initSocket();
	if (!tmuxCmdSafe([
		"has-session",
		"-t",
		name
	]).ok) createSession(name);
}
function createSession(name) {
	if (!isInitialized()) initSocket();
	tmuxCmd([
		"new-session",
		"-d",
		"-s",
		name,
		"-x",
		"200",
		"-y",
		"50"
	]);
	discoverSocketInfo();
	writeAppState(name);
	writeStateFile(name);
}

//#endregion
//#region src/tools/tungsten/actions/create.ts
async function handleCreate(args) {
	const session = args.session || "main";
	validateSessionName(session);
	if (isInitialized()) {
		if (tmuxCmdSafe([
			"has-session",
			"-t",
			session
		]).ok) return { data: `Session "${session}" already exists on socket ${SOCKET_NAME}.` };
	}
	createSession(session);
	return { data: `Session "${session}" created on socket ${SOCKET_NAME}.\nEnvironment variables, working directory, and processes will persist across tool calls.` };
}

//#endregion
//#region src/tools/tungsten/actions/send.ts
async function handleSend(args) {
	const session = args.session || "main";
	const command = args.command;
	if (!command) throw new Error("The \"command\" parameter is required for the \"send\" action.");
	ensureSession(session);
	tmuxCmd([
		"send-keys",
		"-t",
		session,
		"-l",
		command
	]);
	tmuxCmd([
		"send-keys",
		"-t",
		session,
		"Enter"
	]);
	writeLastCommand(command);
	await sleep(150);
	return { data: `$ ${command}\n${capture(session, args.lines || 30)}` };
}

//#endregion
//#region src/tools/tungsten/actions/capture.ts
async function handleCapture(args) {
	const session = args.session || "main";
	const lines = args.lines || 50;
	ensureSession(session);
	const output = capture(session, lines);
	const ctx = getCurrentContext();
	if (ctx && typeof ctx.setAppState === "function") try {
		ctx.setAppState(function(prev) {
			return Object.assign({}, prev, { tungstenLastCapturedTime: Date.now() });
		});
	} catch {}
	return { data: output || "(empty — no output in terminal)" };
}

//#endregion
//#region src/tools/tungsten/actions/list.ts
async function handleList() {
	if (!isInitialized() || !checkTmux()) return { data: "No active Tungsten sessions." };
	const result = tmuxCmdSafe([
		"list-sessions",
		"-F",
		"#{session_name}: #{session_windows} window(s)"
	]);
	if (!result.ok) return { data: "No active Tungsten sessions." };
	return { data: `Active sessions (socket: ${SOCKET_NAME}):\n${result.stdout}` };
}

//#endregion
//#region src/tools/tungsten/actions/kill.ts
async function handleKill(args) {
	const session = args.session || "main";
	validateSessionName(session);
	if (!tmuxCmdSafe([
		"kill-session",
		"-t",
		session
	]).ok) return { data: `Session "${session}" not found or already killed.` };
	const listResult = tmuxCmdSafe([
		"list-sessions",
		"-F",
		"#{session_name}"
	]);
	if (!listResult.ok || !listResult.stdout?.trim()) {
		delete process.env[TMUX_ENV_KEY];
		clearStateFile();
		const ctx = getCurrentContext();
		if (ctx && typeof ctx.setAppState === "function") try {
			ctx.setAppState(function(prev) {
				return Object.assign({}, prev, {
					tungstenActiveSession: void 0,
					tungstenPanelVisible: false
				});
			});
		} catch {}
		return { data: `Session "${session}" killed. No sessions remaining.` };
	}
	const nextSession = listResult.stdout.trim().split("\n").filter(Boolean)[0];
	writeAppState(nextSession);
	writeStateFile(nextSession);
	return { data: `Session "${session}" killed. Active session: "${nextSession}".` };
}

//#endregion
//#region src/tools/tungsten/actions/interrupt.ts
async function handleInterrupt(args) {
	const session = args.session || "main";
	ensureSession(session);
	tmuxCmd([
		"send-keys",
		"-t",
		session,
		"C-c"
	], { timeout: 5e3 });
	await sleep(150);
	return { data: `Interrupt (Ctrl-C) sent to "${session}".\n${capture(session, 10)}` };
}

//#endregion
//#region src/tools/tungsten/index.ts
var tungsten_default = {
	name: "Tungsten",
	inputJSONSchema,
	renderToolUseMessage(data) {
		const refs = globalThis.__govReactRefs;
		const label = `Tungsten ${data?.action || "unknown"} [${data?.session || "main"}]${data?.command ? `: ${data.command.substring(0, 60)}` : ""}`;
		if (refs?.R?.createElement && refs?.Text) return refs.R.createElement(refs.Text, { color: "yellow" }, label);
		return label;
	},
	async prompt() {
		return getPrompt();
	},
	async description() {
		return "Persistent terminal session — environment, working directory, and processes survive between calls";
	},
	async call(args, context) {
		setCurrentContext(context);
		switch (args.action) {
			case "create": return handleCreate(args);
			case "send": return handleSend(args);
			case "capture": return handleCapture(args);
			case "list": return handleList();
			case "kill": return handleKill(args);
			case "interrupt": return handleInterrupt(args);
			default: throw new Error(`Unknown action "${args.action}". Valid actions: send, capture, create, list, kill, interrupt`);
		}
	}
};

//#endregion
module.exports = tungsten_default;