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
let node_vm = require("node:vm");
node_vm = __toESM(node_vm);
let node_os = require("node:os");
node_os = __toESM(node_os);
let node_fs = require("node:fs");
node_fs = __toESM(node_fs);
let node_path = require("node:path");
node_path = __toESM(node_path);

//#region src/tools/repl/config.ts
let replConfig = null;
function loadConfig() {
	if (replConfig) return replConfig;
	try {
		const cfgPath = node_path.join(node_os.homedir(), ".claude-governance", "config.json");
		const cfg = JSON.parse(node_fs.readFileSync(cfgPath, "utf8")).repl || {};
		if (cfg.mode && cfg.mode !== "coexist" && cfg.mode !== "replace") {
			console.error("[REPL] Invalid repl.mode: \"" + cfg.mode + "\" — must be \"coexist\" or \"replace\"");
			delete cfg.mode;
		}
		if (cfg.timeout !== void 0 && (typeof cfg.timeout !== "number" || cfg.timeout < 1e3)) {
			console.error("[REPL] Invalid repl.timeout: " + cfg.timeout + " — must be number >= 1000");
			delete cfg.timeout;
		}
		if (cfg.maxResultSize !== void 0 && (typeof cfg.maxResultSize !== "number" || cfg.maxResultSize < 1e3)) {
			console.error("[REPL] Invalid repl.maxResultSize: " + cfg.maxResultSize + " — must be number >= 1000");
			delete cfg.maxResultSize;
		}
		if (cfg.maxReadFileSize !== void 0 && (typeof cfg.maxReadFileSize !== "number" || cfg.maxReadFileSize < 1024)) {
			console.error("[REPL] Invalid repl.maxReadFileSize: " + cfg.maxReadFileSize + " — must be number >= 1024");
			delete cfg.maxReadFileSize;
		}
		if (cfg.allowAllModules !== void 0 && typeof cfg.allowAllModules !== "boolean") {
			console.error("[REPL] Invalid repl.allowAllModules: " + cfg.allowAllModules + " — must be boolean");
			delete cfg.allowAllModules;
		}
		replConfig = cfg;
	} catch (e) {
		if ((e instanceof Error ? e.message : "").includes("JSON")) console.error("[REPL] config.json parse error — using defaults");
		replConfig = {};
	}
	return replConfig;
}
function getTimeout() {
	return loadConfig().timeout || 12e4;
}
function getMaxResultSize() {
	return loadConfig().maxResultSize || 1e5;
}
function getMaxReadFileSize() {
	return loadConfig().maxReadFileSize || 256 * 1024;
}
function getAllowAllModules() {
	return loadConfig().allowAllModules === true;
}

//#endregion
//#region src/tools/repl/schema.ts
const inputJSONSchema = {
	type: "object",
	properties: {
		script: {
			type: "string",
			description: "JavaScript code to execute. Use await for async operations. Return a value to include it in the response."
		},
		description: {
			type: "string",
			description: "Brief description of what this script does"
		}
	},
	required: ["script"]
};

//#endregion
//#region src/tools/repl/prompt.ts
function getPrompt() {
	if ((loadConfig().mode || "coexist") === "replace") return replacePrompt();
	return coexistPrompt();
}
function requireNote() {
	if (getAllowAllModules()) return "- `require()` is available for **all Node.js built-in modules** including `fs`, `child_process`, `http`, `net`, `stream`, etc. Use native JS for file I/O, binary analysis, and data processing instead of shelling out to bash";
	return "- `require()` is available for: path, url, querystring, crypto, util, os";
}
function coexistPrompt() {
	return `# REPL \u2014 Batch Operations Engine

Execute JavaScript code with access to file and shell operations. Batch multiple operations in one call to reduce round-trips.

## When to Use REPL

Use REPL when a task involves **3 or more tool operations**, or when you need:
- Scan-filter-act patterns (glob \u2192 read \u2192 process \u2192 write)
- Bulk reads or edits across multiple files
- Loops, conditionals, or data processing
- Complex multi-step operations that would be noisy as individual tool calls

For simple single-file reads or one-off commands, use the individual tools directly.

**Before making multiple tool calls, ask: could one REPL call do this?** Each individual tool call requires a full model inference round and adds a result to the context window. Three Bash calls that REPL could combine into one means 3x the context consumed and 3x the inference cost. At scale this accelerates compaction and degrades session quality.

## When NOT to use REPL

- **Single file read/edit** \u2014 bare Read and Edit have diff visibility and hook enforcement
- **Safety-critical edits** \u2014 bare Edit shows diffs for user review; REPL edits are silent
- **Exploratory debugging** \u2014 per-call error isolation is easier with individual tools
- **One-off shell commands** \u2014 bare Bash is simpler for a single command

## Available Functions (all async \u2014 use await)

### File Operations
- \`read(path, opts?)\` \u2192 string (file content)
  - opts: \`{ offset, limit, pages }\`
  - Files over 256KB are automatically read via bash \u2014 no action needed
  - For very large files, use \`{ offset, limit }\` to read specific line ranges
- \`write(path, content)\` \u2192 confirmation string
- \`edit(path, oldString, newString, opts?)\` \u2192 confirmation string
  - opts: \`{ replace_all: true }\` to replace all occurrences

### Shell & Search
- \`bash(command, opts?)\` \u2192 stdout string
  - opts: \`{ timeout, description }\`
- \`grep(pattern, path?, opts?)\` \u2192 matching lines string
  - path defaults to \`'.'\`; opts: \`{ flags: '-rn' }\`
- \`glob(pattern, opts?)\` \u2192 newline-separated absolute file paths (sorted by modification time)
  - Supports full glob syntax including \`**\` recursion: \`'**/*.ts'\`, \`'src/**/*.js'\`
  - Respects .gitignore by default \u2014 ignored files (node_modules, build, etc.) are excluded
  - opts: \`{ cwd, maxDepth }\`
  - opts: \`{ noIgnore: true }\` to include .gitignore'd files
  - opts: \`{ hidden: true }\` to include hidden files (dotfiles)
  - opts: \`{ ignore: ['*.min.js', 'dist/**'] }\` to add custom exclusions

### Notebook
- \`notebook_edit(path, { new_source, cell_id?, cell_type?, edit_mode? })\` \u2192 confirmation
  - \`new_source\`: the cell content to write (required unless deleting)
  - \`cell_id\`: cell ID to edit (required for replace/delete)
  - \`cell_type\`: 'code' or 'markdown' (required for insert)
  - \`edit_mode\`: 'replace' (default), 'insert', or 'delete'

### Web & Agents
- \`fetch(url, opts?)\` \u2192 AI-summarized response (NOT raw HTTP)
  - Returns CC's WebFetch output: a markdown summary of the page, not the raw response body
  - For raw HTTP/JSON, use \`bash('curl -s ...')\` instead
  - opts: \`{ prompt }\` \u2014 guide the summarization
- \`agent(prompt, opts?)\` \u2192 agent result string
  - opts: \`{ description, subagent_type, model, name, run_in_background, mode, isolation }\`
  - \`description\` auto-generated from prompt if omitted

## Patterns

### Multi-file scan
\`\`\`javascript
const files = (await glob('*.ts', { cwd: 'src' })).split('\\n').filter(Boolean);
const results = [];
for (const f of files) {
  const content = await read(f);
  if (/TODO/.test(content)) results.push(f);
}
return results;
\`\`\`

### Bulk edit
\`\`\`javascript
const matches = (await grep('oldName', 'src/')).split('\\n').filter(Boolean);
const files = [...new Set(matches.map(l => l.split(':')[0]))];
for (const f of files) {
  await edit(f, 'oldName', 'newName', { replace_all: true });
  console.log('Updated: ' + f);
}
return files.length + ' files updated';
\`\`\`

### Read and process
\`\`\`javascript
const pkg = JSON.parse(await read('package.json'));
const deps = Object.keys(pkg.dependencies || {});
return { name: pkg.name, depCount: deps.length, deps };
\`\`\`

### Defensive batch read (handles large/missing files)
\`\`\`javascript
const files = (await glob('**/*.ts', { cwd: 'src' })).split('\\n').filter(Boolean);
const results = [];
for (const f of files) {
  try {
    const content = await read(f);
    results.push({ file: f, lines: content.split('\\n').length });
  } catch (e) {
    results.push({ file: f, error: e.message });
  }
}
return results;
\`\`\`

## State Persistence
- Scripts WITHOUT \`await\` or \`return\`: \`var\` declarations and bare assignments persist across calls
  - \`var x = 42\` in call 1 \u2192 \`x\` available in call 2
  - \`x = 42\` (no keyword) in call 1 \u2192 \`x\` available in call 2
  - \`const\`/\`let\` do NOT persist (block-scoped by V8 design)
- Scripts WITH \`await\` or \`return\`: wrapped in async function \u2014 local variables don't persist
  - Use \`state.x = 42\` for values that must survive across async REPL calls
  - The \`state\` object always persists regardless of script type
- Bare expressions always work: \`42 + 1\` returns the value without needing \`return\`

## Error Recovery

When a REPL script fails, **fix the script and retry in REPL** \u2014 do not fall back to individual tools. Common fixes:
- File not found \u2192 check the path with \`glob()\` first, then retry
- Large file truncation \u2192 read() auto-handles files over 256KB via bash; for very large files use \`read(path, { offset, limit })\`
- Permission denied \u2192 the file may be read-only; check with \`bash('ls -la ...')\`
- Syntax error \u2192 fix the JavaScript syntax and resubmit

Falling back to individual Read/Write/Edit calls after a REPL error wastes the batch advantage and floods the context window. Stay in REPL.

## Notes
- \`console.log()\` output is captured and included in the result
- \`return\` a value to include it in the response
- Use \`try/catch\` inside scripts to handle errors gracefully
${requireNote()}
- All I/O goes through CC's permission system \u2014 writes will prompt for approval when configured

## Tungsten Integration
- REPL's \`bash()\` runs one-shot commands \u2014 state is lost between calls
- For persistent processes (dev servers, watchers, debuggers), use the Tungsten tool instead
- After Tungsten creates a session, Bash commands automatically inherit the tmux environment
- Use REPL for batch computation; use Tungsten for long-running processes`;
}
function replacePrompt() {
	return `# REPL \u2014 Your Execution Environment

REPL is a persistent Node.js VM with full access to file operations, shell commands, search, and data processing. JavaScript and bash work in tandem \u2014 you have the expressiveness of a programming language with the reach of a shell, all in a single tool call.

One REPL call can do what would otherwise take dozens of individual tool calls: scan a codebase, read every file, process the contents, compute metrics, and return structured results \u2014 all in one execution. Think in terms of programs, not commands.

## How to Think About REPL

Every task is a script. A file read is \`await read(path)\`. A shell command is \`await bash('...')\`. A search is \`await grep(pattern, path)\`. String them together with JavaScript \u2014 loops, conditionals, map/filter/reduce, JSON parsing, regex, error handling \u2014 and you have a pipeline that executes as a single tool call.

**The power is composition.** Instead of one call to find files, another to read them, another to process, another to write \u2014 write one script that does all four in a loop, with error handling, in one call.

**This is JavaScript, not Python.** Use string concatenation or template literals for formatting, .padStart()/.padEnd() for alignment, JSON.stringify() for serialization. No f-strings, no \`{:>5}\` format specs.

## Available Functions (all async \u2014 use await)

### File Operations
- \`read(path, opts?)\` \u2192 string (file content)
  - opts: \`{ offset, limit, pages }\`
  - Files over 256KB are automatically read via bash \u2014 no action needed
  - For very large files, use \`{ offset, limit }\` to read specific line ranges
  - Binary files (images, videos, fonts) will throw \u2014 filter by extension before reading
  - Relative paths are resolved to absolute automatically
- \`write(path, content)\` \u2192 confirmation string
  - Overwrites existing files. Prefer edit() for modifications \u2014 write() is for new files or complete rewrites
  - NEVER create documentation files (*.md) unless the user explicitly asks
- \`edit(path, oldString, newString, opts?)\` \u2192 confirmation string
  - opts: \`{ replace_all: true }\` to replace all occurrences
  - old_string must be unique in the file. Include enough surrounding context (2-4 lines) to ensure uniqueness
  - Preserve exact indentation as it appears in the file
  - Use replace_all for renaming variables or strings across a file

### Shell & Search
- \`bash(command, opts?)\` \u2192 stdout string
  - opts: \`{ timeout, description }\`
- \`grep(pattern, path?, opts?)\` \u2192 matching lines string
  - Uses ripgrep. Full regex syntax: \`"log.*Error"\`, \`"function\\\\s+\\\\w+"\`
  - path defaults to \`'.'\`; opts: \`{ flags: '-rn' }\`
- \`glob(pattern, opts?)\` \u2192 newline-separated absolute file paths (sorted by modification time)
  - Supports full glob syntax including \`**\` recursion: \`'**/*.ts'\`, \`'src/**/*.js'\`
  - Respects .gitignore by default \u2014 ignored files (node_modules, build, etc.) are excluded
  - For a complete file inventory, use \`bash('git ls-files')\` instead of glob('**/*')
  - opts: \`{ cwd, maxDepth }\`
  - opts: \`{ noIgnore: true }\` to include .gitignore'd files
  - opts: \`{ hidden: true }\` to include hidden files (dotfiles)
  - opts: \`{ ignore: ['*.min.js', 'dist/**'] }\` to add custom exclusions

### Notebook
- \`notebook_edit(path, { new_source, cell_id?, cell_type?, edit_mode? })\` \u2192 confirmation
  - \`new_source\`: the cell content to write (required unless deleting)
  - \`cell_id\`: cell ID to edit (required for replace/delete)
  - \`cell_type\`: 'code' or 'markdown' (required for insert)
  - \`edit_mode\`: 'replace' (default), 'insert', or 'delete'

### Web & Agents
- \`fetch(url, opts?)\` \u2192 AI-summarized response (NOT raw HTTP)
  - Returns CC's WebFetch output: a markdown summary of the page, not the raw response body
  - For raw HTTP/JSON, use \`bash('curl -s ...')\` instead
  - opts: \`{ prompt }\` \u2014 guide the summarization
- \`agent(prompt, opts?)\` \u2192 agent result string
  - opts: \`{ description, subagent_type, model, name, run_in_background, mode, isolation }\`
  - \`description\` auto-generated from prompt if omitted

## Patterns

### Codebase scan \u2014 robust single-call version
\`\`\`javascript
// Use git ls-files for complete inventory, filter binary extensions, try/catch each read
const BINARY = new Set(['png','jpg','jpeg','gif','svg','ico','mp4','webm','woff','woff2','ttf','eot','pdf']);
const all = (await bash('git ls-files')).split('\\n').filter(Boolean);
const stats = { total: 0, lines: 0, byExt: {}, top: [], errors: 0 };
for (const f of all) {
  const ext = f.split('.').pop().toLowerCase();
  if (BINARY.has(ext)) continue;
  try {
    const c = await read(f);
    const n = c.split('\\n').length;
    stats.total++; stats.lines += n;
    stats.byExt[ext] = (stats.byExt[ext] || 0) + n;
    stats.top.push({ f, n });
  } catch (e) { stats.errors++; }
}
stats.top.sort((a,b) => b.n - a.n);
stats.top = stats.top.slice(0, 10).map(t => t.f + ': ' + t.n);
return stats;
\`\`\`

### Search \u2192 read \u2192 transform \u2192 write pipeline
\`\`\`javascript
const matches = (await grep('oldName', 'src/')).split('\\n').filter(Boolean);
const files = [...new Set(matches.map(l => l.split(':')[0]))];
for (const f of files) {
  await edit(f, 'oldName', 'newName', { replace_all: true });
  console.log('Updated: ' + f);
}
return files.length + ' files updated';
\`\`\`

### Shell + JS in tandem \u2014 git analysis
\`\`\`javascript
const log = await bash('git log --oneline -20');
const branch = (await bash('git branch --show-current')).trim();
const pkg = JSON.parse(await read('package.json'));
return { branch, version: pkg.version, recentCommits: log.split('\\n').length };
\`\`\`

### Defensive batch read (handles large/missing files)
\`\`\`javascript
const files = (await glob('**/*.ts', { cwd: 'src' })).split('\\n').filter(Boolean);
const results = [];
for (const f of files) {
  try {
    const content = await read(f);
    results.push({ file: f, lines: content.split('\\n').length });
  } catch (e) {
    results.push({ file: f, error: e.message });
  }
}
return results;
\`\`\`

## Important: Return Summaries, Not Raw Content

When scanning many files, return computed metrics and structured objects \u2014 not raw file contents. A script that reads 50 files should return a summary object with counts, sizes, and top-N lists, not 50 files worth of text. This keeps results within size limits and makes the output useful.

## State Persistence
- Scripts WITHOUT \`await\` or \`return\`: \`var\` declarations and bare assignments persist across calls
  - \`var x = 42\` in call 1 \u2192 \`x\` available in call 2
  - \`x = 42\` (no keyword) in call 1 \u2192 \`x\` available in call 2
  - \`const\`/\`let\` do NOT persist (block-scoped by V8 design)
- Scripts WITH \`await\` or \`return\`: wrapped in async function \u2014 local variables don't persist
  - Use \`state.x = 42\` for values that must survive across async REPL calls
  - The \`state\` object always persists regardless of script type
- Bare expressions always work: \`42 + 1\` returns the value without needing \`return\`

## Error Recovery

When a script fails, fix it and retry. Common fixes:
- File not found \u2192 check the path with \`glob()\` or \`bash('ls')\` first
- Large file error \u2192 read() auto-handles files over 256KB via bash; for very large files use \`read(path, { offset, limit })\`
- Binary file error \u2192 filter by extension before reading (skip png, jpg, mp4, etc.)
- glob returns too many files \u2192 use a specific extension pattern or \`bash('git ls-files')\`
- Syntax error \u2192 this is JavaScript, not Python. Fix the syntax and resubmit

## Notes
- \`console.log()\` output is captured and included in the result
- \`return\` a value to include it in the response
- Use \`try/catch\` inside scripts to handle errors gracefully
${requireNote()}
- All I/O goes through CC's permission system \u2014 writes will prompt for approval when configured
- All paths are relative to the current working directory

## Tungsten Integration
- REPL's \`bash()\` runs one-shot commands \u2014 state is lost between calls
- For persistent processes (dev servers, watchers, debuggers), use the Tungsten tool instead
- After Tungsten creates a session, Bash commands automatically inherit the tmux environment
- Use REPL for batch computation; use Tungsten for long-running processes`;
}

//#endregion
//#region src/tools/repl/vm.ts
let vmContext = null;
let currentContext = null;
let operations = [];
let selfRef = null;
function getCurrentContext() {
	return currentContext;
}
function setCurrentContext(ctx) {
	currentContext = ctx;
}
function getOperations() {
	return operations;
}
function resetOperations() {
	operations = [];
}
function setSelfRef(ref) {
	selfRef = ref;
}
function makeParentMessage() {
	const id = "repl-" + Math.random().toString(36).substring(2, 15);
	return {
		uuid: id,
		message: {
			id,
			role: "assistant",
			content: []
		}
	};
}
function findTool(name) {
	if (selfRef && selfRef._stashedTools) {
		for (let i = 0; i < selfRef._stashedTools.length; i++) if (selfRef._stashedTools[i].name === name) return selfRef._stashedTools[i];
	}
	const tools = currentContext && currentContext.options && currentContext.options.tools;
	if (!tools) return null;
	for (let i = 0; i < tools.length; i++) if (tools[i].name === name) return tools[i];
	return null;
}
function checkAbort() {
	if (currentContext && currentContext.abortController && currentContext.abortController.signal && currentContext.abortController.signal.aborted) throw new Error("Operation cancelled");
}
function summarizeArgs(toolName, args) {
	const s = {};
	for (const k of Object.keys(args)) {
		const v = args[k];
		if (typeof v === "string" && v.length > 100) s[k] = v.substring(0, 97) + "...";
		else s[k] = v;
	}
	return s;
}
function summarizeResult(toolName, result) {
	if (toolName === "read") {
		if (typeof result === "string") return `${result.split("\n").length} lines read`;
	}
	if (toolName === "bash" || toolName === "grep" || toolName === "glob") {
		if (typeof result === "string") return `${result.split("\n").filter(Boolean).length} lines`;
	}
	if (toolName === "write") return String(result);
	if (toolName === "edit") return String(result);
	if (result === void 0 || result === null) return "ok";
	if (typeof result === "string") return result.substring(0, 80);
	try {
		return JSON.stringify(result).substring(0, 80);
	} catch {
		return String(result);
	}
}
async function tracked(toolName, args, fn) {
	const op = {
		tool: toolName,
		args: summarizeArgs(toolName, args),
		startTime: Date.now()
	};
	try {
		const result = await fn();
		op.success = true;
		op.resultSummary = summarizeResult(toolName, result);
		op.duration = Date.now() - op.startTime;
		operations.push(op);
		return result;
	} catch (err) {
		op.success = false;
		op.error = err instanceof Error ? err.message : String(err);
		op.duration = Date.now() - op.startTime;
		operations.push(op);
		throw err;
	}
}
function createCapturedConsole() {
	const stdout = [];
	const stderr = [];
	return {
		log: (...args) => stdout.push(args.map(String).join(" ")),
		warn: (...args) => stderr.push(args.map(String).join(" ")),
		error: (...args) => stderr.push(args.map(String).join(" ")),
		info: (...args) => stdout.push(args.map(String).join(" ")),
		dir: (obj) => stdout.push(JSON.stringify(obj, null, 2)),
		table: (data) => stdout.push(JSON.stringify(data, null, 2)),
		debug: (...args) => stdout.push(args.map(String).join(" ")),
		getStdout: () => stdout.join("\n"),
		getStderr: () => stderr.join("\n"),
		clear: () => {
			stdout.length = 0;
			stderr.length = 0;
		}
	};
}
const SAFE_MODULES = new Set([
	"path",
	"url",
	"querystring",
	"crypto",
	"util",
	"os"
]);
function createSafeRequire() {
	const unrestricted = getAllowAllModules();
	return function safeRequire(moduleName) {
		if (unrestricted || SAFE_MODULES.has(moduleName)) return require(moduleName);
		throw new Error(`require('${moduleName}') is not allowed. Allowed modules: ${[...SAFE_MODULES].join(", ")}. Set repl.allowAllModules: true in ~/.claude-governance/config.json to unlock all modules.`);
	};
}
function getOrCreateVM(handlers) {
	if (vmContext) return vmContext;
	const capturedConsole = createCapturedConsole();
	const sandbox = {
		...handlers,
		state: {},
		console: capturedConsole,
		JSON,
		Math,
		Date,
		RegExp,
		Array,
		Object,
		Map,
		Set,
		WeakMap,
		WeakSet,
		Promise,
		Symbol,
		Proxy,
		Reflect,
		Buffer,
		URL,
		URLSearchParams,
		TextEncoder,
		TextDecoder,
		process,
		setTimeout,
		clearTimeout,
		setInterval,
		clearInterval,
		parseInt,
		parseFloat,
		isNaN,
		isFinite,
		encodeURIComponent,
		decodeURIComponent,
		encodeURI,
		decodeURI,
		Error,
		TypeError,
		RangeError,
		SyntaxError,
		ReferenceError,
		require: createSafeRequire()
	};
	vmContext = node_vm.createContext(sandbox);
	return vmContext;
}

//#endregion
//#region src/tools/repl/format.ts
function formatResult(description, startTime, returnValue, error, handlers) {
	const duration = Date.now() - startTime;
	const capturedConsole = getOrCreateVM(handlers).console;
	const maxSize = getMaxResultSize();
	const operations$1 = getOperations();
	const parts = [];
	const header = description ? `=== REPL: ${description} ===` : "=== REPL ===";
	const failCount = operations$1.filter((op) => !op.success).length;
	const opSummary = failCount > 0 ? `${operations$1.length} (${failCount} failed)` : String(operations$1.length);
	parts.push(header);
	parts.push(`Duration: ${duration}ms | Operations: ${opSummary}`);
	if (operations$1.length > 0) {
		parts.push("");
		parts.push("--- Operations ---");
		for (let i = 0; i < operations$1.length; i++) {
			const op = operations$1[i];
			const argStr = String(op.args.command || op.args.file_path || op.args.prompt || "");
			const truncArg = argStr.length > 60 ? argStr.substring(0, 57) + "..." : argStr;
			if (op.success) {
				const summary = op.resultSummary || "ok";
				const truncSummary = summary.length > 60 ? summary.substring(0, 57) + "..." : summary;
				parts.push(`${i + 1}. ${op.tool}(${truncArg}) → ${truncSummary} [${op.duration}ms]`);
			} else parts.push(`${i + 1}. ${op.tool}(${truncArg}) → ERROR: ${op.error} [${op.duration}ms]`);
		}
	}
	const stdout = capturedConsole.getStdout();
	const stderr = capturedConsole.getStderr();
	if (stdout || stderr) {
		parts.push("");
		parts.push("--- Console Output ---");
		if (stdout) parts.push(stdout);
		if (stderr) parts.push("[stderr] " + stderr);
	}
	if (error) {
		parts.push("");
		parts.push("--- Error ---");
		const e = error;
		parts.push(e.stack || e.message || String(error));
	} else if (returnValue !== void 0) {
		parts.push("");
		parts.push("--- Result ---");
		const rendered = typeof returnValue === "string" ? returnValue : JSON.stringify(returnValue, null, 2);
		parts.push(rendered);
	}
	let result = parts.join("\n");
	if (result.length > maxSize) result = result.substring(0, maxSize - 50) + `\n\n[Truncated — ${result.length} chars exceeded ${maxSize} limit]`;
	return result;
}

//#endregion
//#region src/tools/repl/handlers/agent.ts
function extractAgentText(data) {
	if (typeof data === "string") try {
		return extractAgentText(JSON.parse(data));
	} catch {
		return data;
	}
	if (data && typeof data === "object") {
		const obj = data;
		if (Array.isArray(obj.content)) {
			const texts = obj.content.filter((c) => c && typeof c === "object" && c.type === "text").map((c) => String(c.text || ""));
			if (texts.length > 0) return texts.join("\n");
		}
		if (typeof obj.result === "string") return obj.result;
		if (typeof obj.text === "string") return obj.text;
		return JSON.stringify(data, null, 2);
	}
	return String(data);
}
function makeCanUseTool() {
	return async (_tool, input) => ({
		behavior: "allow",
		updatedInput: input,
		decisionReason: {
			type: "mode",
			mode: "bypassPermissions"
		}
	});
}
async function agent(prompt, opts) {
	checkAbort();
	if (!prompt) throw new Error("agent() requires a prompt string");
	const args = { prompt };
	if (opts) {
		for (const key of [
			"description",
			"subagent_type",
			"model",
			"name",
			"run_in_background",
			"team_name",
			"mode",
			"isolation"
		]) if (opts[key] !== void 0) args[key] = opts[key];
		if (!args.description) args.description = prompt.substring(0, 50);
	} else args.description = prompt.substring(0, 50);
	return tracked("agent", args, async () => {
		const tool$1 = findTool("Agent");
		if (!tool$1) throw new Error("Agent tool not found in registry");
		return extractAgentText((await tool$1.call(args, getCurrentContext(), makeCanUseTool(), makeParentMessage()))?.data);
	});
}

//#endregion
//#region src/tools/repl/handlers/read.ts
const HARD_CAP = 10 * 1024 * 1024;
const AGENT_CHUNK_SIZE = 256 * 1024;
function unlimitedContext() {
	return {
		...getCurrentContext(),
		fileReadingLimits: {
			maxSizeBytes: HARD_CAP,
			maxTokens: Infinity
		}
	};
}
async function nativeRead(args) {
	const tool$1 = findTool("Read");
	if (!tool$1) throw new Error("Read tool not found in registry");
	const result = await tool$1.call(args, unlimitedContext(), void 0, makeParentMessage());
	try {
		if (result?.data?.file?.content !== void 0) return result.data.file.content;
		if (result?.data !== void 0) return typeof result.data === "string" ? result.data : JSON.stringify(result.data, null, 2);
		return String(result);
	} catch {
		return String(result);
	}
}
async function agentChunkedRead(filePath, fileSize) {
	const bashTool = findTool("Bash");
	if (!bashTool) throw new Error("Bash tool not found");
	let totalLines;
	try {
		const wcResult = await bashTool.call({ command: `wc -l < ${JSON.stringify(filePath)}` }, getCurrentContext(), void 0, makeParentMessage());
		totalLines = parseInt((wcResult.data.stdout || "0").trim(), 10);
	} catch {
		throw new Error(`Cannot determine line count for ${filePath}`);
	}
	if (totalLines <= 0) throw new Error(`File appears empty or binary: ${filePath}`);
	const numChunks = Math.ceil(fileSize / AGENT_CHUNK_SIZE);
	const linesPerChunk = Math.ceil(totalLines / numChunks);
	const basename = node_path.basename(filePath);
	const chunks = [];
	for (let i = 0; i < numChunks; i++) {
		checkAbort();
		const startLine = i * linesPerChunk + 1;
		const endLine = Math.min((i + 1) * linesPerChunk, totalLines);
		const result = await agent(`Read lines ${startLine}-${endLine} of ${filePath} using the Read tool with parameters: file_path="${filePath}", offset=${startLine}, limit=${endLine - startLine + 1}. Return ONLY the raw file content. No commentary, no formatting, no markdown.`, { description: `Read ${basename} chunk ${i + 1}/${numChunks}` });
		chunks.push(result);
	}
	return chunks.join("\n");
}
async function read(filePath, opts) {
	checkAbort();
	const resolved = node_path.isAbsolute(filePath) ? filePath : node_path.resolve(process.cwd(), filePath);
	const args = { file_path: resolved };
	if (opts?.offset !== void 0) args.offset = opts.offset;
	if (opts?.limit !== void 0) args.limit = opts.limit;
	if (opts?.pages !== void 0) args.pages = opts.pages;
	return tracked("read", args, async () => {
		let fileSize;
		try {
			fileSize = node_fs.statSync(resolved).size;
		} catch {
			return nativeRead(args);
		}
		if (fileSize > HARD_CAP) throw new Error(`File too large: ${Math.round(fileSize / 1024 / 1024)}MB exceeds ${Math.round(HARD_CAP / 1024 / 1024)}MB hard cap. Process with bash() pipelines (grep, awk, sed) or read sections with read(path, {offset, limit}).`);
		try {
			return await nativeRead(args);
		} catch (err) {
			if (fileSize > getMaxReadFileSize()) return agentChunkedRead(resolved, fileSize);
			throw err;
		}
	});
}

//#endregion
//#region src/tools/repl/handlers/write.ts
async function write(filePath, content) {
	checkAbort();
	const args = {
		file_path: filePath,
		content
	};
	return tracked("write", args, async () => {
		const tool$1 = findTool("Write");
		if (!tool$1) throw new Error("Write tool not found in registry");
		const result = await tool$1.call(args, getCurrentContext(), void 0, makeParentMessage());
		try {
			return `${result.data.type}: ${result.data.filePath}`;
		} catch {
			return typeof result.data === "string" ? result.data : JSON.stringify(result.data);
		}
	});
}

//#endregion
//#region src/tools/repl/handlers/edit.ts
async function edit(filePath, oldString, newString, opts) {
	checkAbort();
	const args = {
		file_path: filePath,
		old_string: oldString,
		new_string: newString
	};
	if (opts?.replace_all !== void 0) args.replace_all = opts.replace_all;
	return tracked("edit", args, async () => {
		const tool$1 = findTool("Edit");
		if (!tool$1) throw new Error("Edit tool not found in registry");
		const result = await tool$1.call(args, getCurrentContext(), void 0, makeParentMessage());
		try {
			return `edited: ${result.data.filePath}`;
		} catch {
			return typeof result.data === "string" ? result.data : JSON.stringify(result.data);
		}
	});
}

//#endregion
//#region src/tools/repl/handlers/bash.ts
async function bash(command, opts) {
	checkAbort();
	const args = { command };
	if (opts?.timeout !== void 0) args.timeout = opts.timeout;
	if (opts?.description !== void 0) args.description = opts.description;
	return tracked("bash", args, async () => {
		const tool$1 = findTool("Bash");
		if (!tool$1) throw new Error("Bash tool not found in registry");
		const result = await tool$1.call(args, getCurrentContext(), void 0, makeParentMessage());
		try {
			let output = result.data.stdout || "";
			if (result.data.stderr) output += (output ? "\n" : "") + result.data.stderr;
			return output;
		} catch {
			return typeof result.data === "string" ? result.data : JSON.stringify(result.data);
		}
	});
}

//#endregion
//#region src/tools/repl/handlers/grep.ts
async function grep(pattern, searchPath, opts) {
	checkAbort();
	const safePath = searchPath || ".";
	const args = { command: `grep ${opts?.flags || "-rn"} ${JSON.stringify(pattern)} ${JSON.stringify(safePath)}` };
	return tracked("grep", args, async () => {
		const tool$1 = findTool("Bash");
		if (!tool$1) throw new Error("Bash tool not found in registry");
		try {
			return (await tool$1.call(args, getCurrentContext(), void 0, makeParentMessage())).data.stdout || "";
		} catch (e) {
			if (e instanceof Error && e.message.includes("Shell command failed")) return "";
			throw e;
		}
	});
}

//#endregion
//#region src/tools/repl/handlers/glob.ts
async function glob(pattern, opts) {
	checkAbort();
	const dir = opts?.cwd || ".";
	const parts = ["rg", "--files"];
	if (!(pattern === "*" || pattern === "**/*" || pattern === "**")) parts.push("--glob", JSON.stringify(pattern));
	parts.push("--sort=modified");
	if (opts?.noIgnore) parts.push("--no-ignore");
	if (opts?.hidden) parts.push("--hidden");
	if (opts?.maxDepth) parts.push("--max-depth", String(opts.maxDepth));
	if (opts?.ignore && Array.isArray(opts.ignore)) for (const excl of opts.ignore) parts.push("--glob", JSON.stringify("!" + excl));
	parts.push(JSON.stringify(dir));
	const args = { command: parts.join(" ") };
	return tracked("glob", args, async () => {
		const tool$1 = findTool("Bash");
		if (!tool$1) throw new Error("Bash tool not found in registry");
		try {
			const output = ((await tool$1.call(args, getCurrentContext(), void 0, makeParentMessage())).data.stdout || "").trim();
			if (!output) return "";
			const absDir = node_path.isAbsolute(dir) ? dir : node_path.resolve(process.cwd(), dir);
			return output.split("\n").map((line) => {
				const trimmed = line.trim();
				if (!trimmed) return "";
				return node_path.isAbsolute(trimmed) ? trimmed : node_path.resolve(absDir, trimmed);
			}).filter(Boolean).join("\n");
		} catch (e) {
			if (e instanceof Error && e.message.includes("Shell command failed")) return "";
			throw e;
		}
	});
}

//#endregion
//#region src/tools/repl/handlers/notebook_edit.ts
async function notebook_edit(notebookPath, editOps) {
	checkAbort();
	if (!editOps || typeof editOps !== "object") throw new Error("notebook_edit requires editOps: { new_source, cell_id?, cell_type?, edit_mode? }");
	const ops = { ...editOps };
	if (ops.source !== void 0 && ops.new_source === void 0) {
		ops.new_source = ops.source;
		delete ops.source;
	}
	if (!ops.new_source && ops.edit_mode !== "delete") throw new Error("notebook_edit requires new_source (the cell content to write)");
	const args = {
		notebook_path: notebookPath,
		...ops
	};
	return tracked("notebook_edit", args, async () => {
		const tool$1 = findTool("NotebookEdit");
		if (!tool$1) throw new Error("NotebookEdit tool not found in registry");
		const result = await tool$1.call(args, getCurrentContext(), void 0, makeParentMessage());
		try {
			if (result.data?.error) return "Error: " + result.data.error;
			return typeof result.data === "string" ? result.data : JSON.stringify(result.data);
		} catch {
			return String(result);
		}
	});
}

//#endregion
//#region src/tools/repl/handlers/fetch.ts
async function fetch_url(url, opts) {
	checkAbort();
	const args = { url };
	if (opts?.prompt !== void 0) args.prompt = opts.prompt;
	return tracked("fetch", args, async () => {
		const tool$1 = findTool("WebFetch");
		if (!tool$1) throw new Error("WebFetch tool not found in registry");
		const result = await tool$1.call(args, getCurrentContext(), void 0, makeParentMessage());
		try {
			return typeof result.data === "string" ? result.data : JSON.stringify(result.data);
		} catch {
			return String(result);
		}
	});
}

//#endregion
//#region src/tools/repl/index.ts
const vmHandlers = {
	read,
	write,
	edit,
	bash,
	grep,
	glob,
	notebook_edit,
	fetch: fetch_url,
	agent
};
const tool = {
	name: "REPL",
	inputJSONSchema,
	renderToolUseMessage(data) {
		const refs = globalThis.__govReactRefs;
		const desc = data?.description || "executing script";
		if (refs?.R?.createElement && refs?.Text) return refs.R.createElement(refs.Text, { color: "cyan" }, `REPL — ${desc}`);
		return `REPL — ${desc}`;
	},
	async prompt() {
		return getPrompt();
	},
	async description() {
		return "Execute JavaScript with access to file and shell operations. Batch multiple operations in one call.";
	},
	async call(args, context) {
		const startTime = Date.now();
		const { script, description } = args;
		setCurrentContext(context);
		const ctx = getOrCreateVM(vmHandlers);
		resetOperations();
		ctx.console.clear();
		let returnValue;
		let error;
		try {
			returnValue = node_vm.runInContext(script, ctx, {
				timeout: getTimeout(),
				filename: "repl-script.js",
				displayErrors: true
			});
			if (returnValue && typeof returnValue.then === "function") returnValue = await returnValue;
		} catch (syncErr) {
			if ((syncErr instanceof SyntaxError || syncErr !== null && typeof syncErr === "object" && syncErr.name === "SyntaxError") && (/\bawait\b/.test(script) || /\breturn\b/.test(script))) try {
				const wrappedScript = `(async () => { ${script} })()`;
				returnValue = await node_vm.runInContext(wrappedScript, ctx, {
					timeout: getTimeout(),
					filename: "repl-script.js",
					displayErrors: true
				});
			} catch (asyncErr) {
				error = asyncErr;
			}
			else error = syncErr;
		}
		return { data: formatResult(description, startTime, returnValue, error, vmHandlers) };
	}
};
var repl_default = tool;
setSelfRef(tool);

//#endregion
module.exports = repl_default;