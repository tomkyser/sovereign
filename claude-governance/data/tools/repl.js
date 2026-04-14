// Clean-Room REPL — Batch Operations Engine
// Executes JavaScript in a persistent Node.js VM with access to CC's native tools.
// Architecture: Tool Delegation (Option B) — all I/O goes through CC's tool.call()

const vm = require('vm');
const pathMod = require('path');

// ---------------------------------------------------------------------------
// Module-level persistent state (survives across REPL calls within a session)
// ---------------------------------------------------------------------------

let vmContext = null;
let currentContext = null;
let operations = [];
let selfRef = null; // Set after module.exports — holds ref to this tool object

// CC's tools access parentMessage fields via optional chaining ($?.message.id,
// $?.uuid). When $ is undefined, the chain short-circuits safely. But when $
// is a non-null object missing .message, it crashes. We must provide all
// fields that CC's tools may access.
function makeParentMessage() {
  const id = 'repl-' + Math.random().toString(36).substring(2, 15);
  return { uuid: id, message: { id: id, role: 'assistant', content: [] } };
}

// ---------------------------------------------------------------------------
// Config (read from ~/.claude-governance/config.json on first call)
// ---------------------------------------------------------------------------

let replConfig = null;

function loadConfig() {
  if (replConfig) return replConfig;
  try {
    const os = require('os');
    const fs = require('fs');
    const cfgPath = pathMod.join(os.homedir(), '.claude-governance', 'config.json');
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    const cfg = raw.repl || {};
    // G12: Validate config values — warn on invalid, fall through to defaults
    if (cfg.mode && cfg.mode !== 'coexist' && cfg.mode !== 'replace') {
      console.error('[REPL] Invalid repl.mode: "' + cfg.mode + '" — must be "coexist" or "replace"');
      delete cfg.mode;
    }
    if (cfg.timeout !== undefined && (typeof cfg.timeout !== 'number' || cfg.timeout < 1000)) {
      console.error('[REPL] Invalid repl.timeout: ' + cfg.timeout + ' — must be number >= 1000');
      delete cfg.timeout;
    }
    if (cfg.maxResultSize !== undefined && (typeof cfg.maxResultSize !== 'number' || cfg.maxResultSize < 1000)) {
      console.error('[REPL] Invalid repl.maxResultSize: ' + cfg.maxResultSize + ' — must be number >= 1000');
      delete cfg.maxResultSize;
    }
    replConfig = cfg;
  } catch (e) {
    if (e.message && e.message.includes('JSON')) {
      console.error('[REPL] config.json parse error — using defaults');
    }
    replConfig = {};
  }
  return replConfig;
}

function getTimeout() {
  return loadConfig().timeout || 120000;
}

function getMaxResultSize() {
  return loadConfig().maxResultSize || 100000;
}

// ---------------------------------------------------------------------------
// Tool Lookup Helper
// ---------------------------------------------------------------------------

function findTool(name) {
  // In replace mode, primitives are filtered from context.options.tools.
  // The binary-patched loader stashes them on this tool object as _stashedTools.
  // Check stashed tools first (replace mode), then registry (coexist mode).
  if (selfRef && selfRef._stashedTools) {
    for (let i = 0; i < selfRef._stashedTools.length; i++) {
      if (selfRef._stashedTools[i].name === name) return selfRef._stashedTools[i];
    }
  }
  const tools = currentContext && currentContext.options && currentContext.options.tools;
  if (!tools) return null;
  for (let i = 0; i < tools.length; i++) {
    if (tools[i].name === name) return tools[i];
  }
  return null;
}

function checkAbort() {
  if (currentContext && currentContext.abortController &&
      currentContext.abortController.signal &&
      currentContext.abortController.signal.aborted) {
    throw new Error('Operation cancelled');
  }
}

// ---------------------------------------------------------------------------
// Operation Tracking
// ---------------------------------------------------------------------------

function summarizeArgs(toolName, args) {
  const s = {};
  for (const k of Object.keys(args)) {
    const v = args[k];
    if (typeof v === 'string' && v.length > 100) {
      s[k] = v.substring(0, 97) + '...';
    } else {
      s[k] = v;
    }
  }
  return s;
}

function summarizeResult(toolName, result) {
  if (toolName === 'read') {
    if (typeof result === 'string') {
      const lines = result.split('\n').length;
      return `${lines} lines read`;
    }
  }
  if (toolName === 'bash' || toolName === 'grep' || toolName === 'glob') {
    if (typeof result === 'string') {
      const lines = result.split('\n').filter(Boolean).length;
      return `${lines} lines`;
    }
  }
  if (toolName === 'write') return String(result);
  if (toolName === 'edit') return String(result);
  if (result === undefined || result === null) return 'ok';
  if (typeof result === 'string') return result.substring(0, 80);
  try { return JSON.stringify(result).substring(0, 80); } catch (e) { return String(result); }
}

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
    op.error = err.message || String(err);
    op.duration = Date.now() - op.startTime;
    operations.push(op);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Inner Tool Handlers
// ---------------------------------------------------------------------------

async function read(filePath, opts) {
  checkAbort();
  const args = { file_path: filePath };
  if (opts && opts.offset !== undefined) args.offset = opts.offset;
  if (opts && opts.limit !== undefined) args.limit = opts.limit;
  if (opts && opts.pages !== undefined) args.pages = opts.pages;

  return tracked('read', args, async () => {
    const tool = findTool('Read');
    if (!tool) throw new Error('Read tool not found in registry');
    const result = await tool.call(args, currentContext, undefined, makeParentMessage());
    // Defensive extraction: primary path, fallback to raw
    try {
      if (result && result.data && result.data.file && result.data.file.content !== undefined) {
        return result.data.file.content;
      }
      // Notebook or other non-text Read results
      if (result && result.data !== undefined) {
        return typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2);
      }
      return String(result);
    } catch (e) {
      return String(result);
    }
  });
}

async function write(filePath, content) {
  checkAbort();
  const args = { file_path: filePath, content: content };

  return tracked('write', args, async () => {
    const tool = findTool('Write');
    if (!tool) throw new Error('Write tool not found in registry');
    const result = await tool.call(args, currentContext, undefined, makeParentMessage());
    try {
      return `${result.data.type}: ${result.data.filePath}`;
    } catch (e) {
      return typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    }
  });
}

async function edit(filePath, oldString, newString, opts) {
  checkAbort();
  const args = { file_path: filePath, old_string: oldString, new_string: newString };
  if (opts && opts.replace_all !== undefined) args.replace_all = opts.replace_all;

  return tracked('edit', args, async () => {
    const tool = findTool('Edit');
    if (!tool) throw new Error('Edit tool not found in registry');
    const result = await tool.call(args, currentContext, undefined, makeParentMessage());
    try {
      return `edited: ${result.data.filePath}`;
    } catch (e) {
      return typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    }
  });
}

async function bash(command, opts) {
  checkAbort();
  const args = { command: command };
  if (opts && opts.timeout !== undefined) args.timeout = opts.timeout;
  if (opts && opts.description !== undefined) args.description = opts.description;

  return tracked('bash', args, async () => {
    const tool = findTool('Bash');
    if (!tool) throw new Error('Bash tool not found in registry');
    const result = await tool.call(args, currentContext, undefined, makeParentMessage());
    try {
      let output = result.data.stdout || '';
      if (result.data.stderr) output += (output ? '\n' : '') + result.data.stderr;
      return output;
    } catch (e) {
      return typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    }
  });
}

async function grep(pattern, searchPath, opts) {
  checkAbort();
  const safePath = searchPath || '.';
  const flags = (opts && opts.flags) || '-rn';
  const cmd = `grep ${flags} ${JSON.stringify(pattern)} ${JSON.stringify(safePath)}`;
  const args = { command: cmd };

  return tracked('grep', args, async () => {
    const tool = findTool('Bash');
    if (!tool) throw new Error('Bash tool not found in registry');
    try {
      const result = await tool.call(args, currentContext, undefined, makeParentMessage());
      return result.data.stdout || '';
    } catch (e) {
      // grep returns exit 1 for no matches — not an error
      if (e.message && e.message.includes('Shell command failed')) return '';
      throw e;
    }
  });
}

async function glob(pattern, opts) {
  checkAbort();
  const dir = (opts && opts.cwd) || '.';
  const parts = ['rg', '--files'];
  // Catch-all patterns bypass .gitignore in rg when passed via --glob.
  // Drop --glob entirely for these — rg --files alone lists all non-ignored files.
  var isCatchAll = (pattern === '*' || pattern === '**/*' || pattern === '**');
  if (!isCatchAll) {
    parts.push('--glob', JSON.stringify(pattern));
  }
  parts.push('--sort=modified');
  if (opts && opts.noIgnore) parts.push('--no-ignore');
  if (opts && opts.hidden) parts.push('--hidden');
  if (opts && opts.maxDepth) parts.push('--max-depth', String(opts.maxDepth));
  if (opts && opts.ignore && Array.isArray(opts.ignore)) {
    for (const excl of opts.ignore) {
      parts.push('--glob', JSON.stringify('!' + excl));
    }
  }
  parts.push(JSON.stringify(dir));
  const cmd = parts.join(' ');
  const args = { command: cmd };

  return tracked('glob', args, async () => {
    const tool = findTool('Bash');
    if (!tool) throw new Error('Bash tool not found in registry');
    try {
      const result = await tool.call(args, currentContext, undefined, makeParentMessage());
      return (result.data.stdout || '').trim();
    } catch (e) {
      if (e.message && e.message.includes('Shell command failed')) return '';
      throw e;
    }
  });
}

async function notebook_edit(notebookPath, editOps) {
  checkAbort();
  if (!editOps || typeof editOps !== 'object') {
    throw new Error('notebook_edit requires editOps: { new_source, cell_id?, cell_type?, edit_mode? }');
  }
  // G7: Normalize common arg variants to match CC's NotebookEdit schema
  const ops = { ...editOps };
  if (ops.source !== undefined && ops.new_source === undefined) {
    ops.new_source = ops.source;
    delete ops.source;
  }
  if (!ops.new_source && ops.edit_mode !== 'delete') {
    throw new Error('notebook_edit requires new_source (the cell content to write)');
  }
  const args = { notebook_path: notebookPath, ...ops };

  return tracked('notebook_edit', args, async () => {
    const tool = findTool('NotebookEdit');
    if (!tool) throw new Error('NotebookEdit tool not found in registry');
    const result = await tool.call(args, currentContext, undefined, makeParentMessage());
    try {
      if (result.data && result.data.error) return 'Error: ' + result.data.error;
      return typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    } catch (e) {
      return String(result);
    }
  });
}

async function fetch_url(url, opts) {
  checkAbort();
  const args = { url: url };
  if (opts && opts.prompt !== undefined) args.prompt = opts.prompt;

  return tracked('fetch', args, async () => {
    const tool = findTool('WebFetch');
    if (!tool) throw new Error('WebFetch tool not found in registry');
    const result = await tool.call(args, currentContext, undefined, makeParentMessage());
    try {
      return typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    } catch (e) {
      return String(result);
    }
  });
}

async function agent(prompt, opts) {
  checkAbort();
  if (!prompt) throw new Error('agent() requires a prompt string');
  const args = { prompt: prompt };
  if (opts) {
    // G8: Pass through all Agent tool options
    for (const key of ['description', 'subagent_type', 'model', 'name',
      'run_in_background', 'team_name', 'mode', 'isolation']) {
      if (opts[key] !== undefined) args[key] = opts[key];
    }
    if (!args.description) args.description = prompt.substring(0, 50);
  } else {
    args.description = prompt.substring(0, 50);
  }

  return tracked('agent', args, async () => {
    const tool = findTool('Agent');
    if (!tool) throw new Error('Agent tool not found in registry');
    const result = await tool.call(args, currentContext, undefined, makeParentMessage());
    try {
      return typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    } catch (e) {
      return String(result);
    }
  });
}

// ---------------------------------------------------------------------------
// Console Capture
// ---------------------------------------------------------------------------

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
    debug: (...args) => stdout.push(args.map(String).join(' ')),
    getStdout: () => stdout.join('\n'),
    getStderr: () => stderr.join('\n'),
    clear: () => { stdout.length = 0; stderr.length = 0; },
  };
}

// ---------------------------------------------------------------------------
// Safe Require
// ---------------------------------------------------------------------------

const SAFE_MODULES = new Set(['path', 'url', 'querystring', 'crypto', 'util', 'os']);

function createSafeRequire() {
  return function safeRequire(moduleName) {
    if (SAFE_MODULES.has(moduleName)) return require(moduleName);
    throw new Error(
      `require('${moduleName}') is not allowed. ` +
      `Allowed modules: ${[...SAFE_MODULES].join(', ')}. ` +
      `Use the tool handlers (read, write, bash, etc.) for I/O.`
    );
  };
}

// ---------------------------------------------------------------------------
// VM Context Creation
// ---------------------------------------------------------------------------

function getOrCreateVM() {
  if (vmContext) return vmContext;

  const capturedConsole = createCapturedConsole();
  const sandbox = {
    // Tool handlers
    read, write, edit, bash, grep, glob, notebook_edit,
    fetch: fetch_url, agent,

    // Persistent state object — survives across REPL calls even in async scripts
    // Use: state.myVar = 42 in one call, state.myVar in the next
    state: {},

    // Console
    console: capturedConsole,

    // Safe globals
    JSON, Math, Date, RegExp, Array, Object, Map, Set, WeakMap, WeakSet,
    Promise, Symbol, Proxy, Reflect,
    Buffer, URL, URLSearchParams, TextEncoder, TextDecoder,
    setTimeout, clearTimeout, setInterval, clearInterval,
    parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent,
    encodeURI, decodeURI,
    Error, TypeError, RangeError, SyntaxError, ReferenceError,

    // Safe require
    require: createSafeRequire(),
  };

  vmContext = vm.createContext(sandbox);
  return vmContext;
}

// ---------------------------------------------------------------------------
// Result Formatting
// ---------------------------------------------------------------------------

function formatResult(description, startTime, returnValue, error) {
  const duration = Date.now() - startTime;
  const ctx = getOrCreateVM();
  const capturedConsole = ctx.console;
  const maxSize = getMaxResultSize();

  const parts = [];

  // Header
  const header = description ? `=== REPL: ${description} ===` : '=== REPL ===';
  const failCount = operations.filter(op => !op.success).length;
  const opSummary = failCount > 0
    ? `${operations.length} (${failCount} failed)`
    : String(operations.length);
  parts.push(header);
  parts.push(`Duration: ${duration}ms | Operations: ${opSummary}`);

  // Operations log
  if (operations.length > 0) {
    parts.push('');
    parts.push('--- Operations ---');
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      const argStr = op.args.command || op.args.file_path || op.args.prompt || '';
      const truncArg = argStr.length > 60 ? argStr.substring(0, 57) + '...' : argStr;
      if (op.success) {
        const summary = op.resultSummary || 'ok';
        const truncSummary = summary.length > 60 ? summary.substring(0, 57) + '...' : summary;
        parts.push(`${i + 1}. ${op.tool}(${truncArg}) → ${truncSummary} [${op.duration}ms]`);
      } else {
        parts.push(`${i + 1}. ${op.tool}(${truncArg}) → ERROR: ${op.error} [${op.duration}ms]`);
      }
    }
  }

  // Console output
  const stdout = capturedConsole.getStdout();
  const stderr = capturedConsole.getStderr();
  if (stdout || stderr) {
    parts.push('');
    parts.push('--- Console Output ---');
    if (stdout) parts.push(stdout);
    if (stderr) parts.push('[stderr] ' + stderr);
  }

  // Error or return value
  if (error) {
    parts.push('');
    parts.push('--- Error ---');
    parts.push(error.stack || error.message || String(error));
  } else if (returnValue !== undefined) {
    parts.push('');
    parts.push('--- Result ---');
    const rendered = typeof returnValue === 'string'
      ? returnValue
      : JSON.stringify(returnValue, null, 2);
    parts.push(rendered);
  }

  let result = parts.join('\n');

  // Truncate if too large
  if (result.length > maxSize) {
    result = result.substring(0, maxSize - 50) +
      `\n\n[Truncated — ${result.length} chars exceeded ${maxSize} limit]`;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Prompt Functions (mode-aware)
// ---------------------------------------------------------------------------

function coexistPrompt() {
  return `# REPL — Batch Operations Engine

Execute JavaScript code with access to file and shell operations. Batch multiple operations in one call to reduce round-trips.

## When to Use REPL

Use REPL when a task involves **3 or more tool operations**, or when you need:
- Scan-filter-act patterns (glob → read → process → write)
- Bulk reads or edits across multiple files
- Loops, conditionals, or data processing
- Complex multi-step operations that would be noisy as individual tool calls

For simple single-file reads or one-off commands, use the individual tools directly.

**Before making multiple tool calls, ask: could one REPL call do this?** Each individual tool call requires a full model inference round and adds a result to the context window. Three Bash calls that REPL could combine into one means 3x the context consumed and 3x the inference cost. At scale this accelerates compaction and degrades session quality.

## When NOT to use REPL

- **Single file read/edit** — bare Read and Edit have diff visibility and hook enforcement
- **Safety-critical edits** — bare Edit shows diffs for user review; REPL edits are silent
- **Exploratory debugging** — per-call error isolation is easier with individual tools
- **One-off shell commands** — bare Bash is simpler for a single command

## Available Functions (all async — use await)

### File Operations
- \`read(path, opts?)\` → string (file content)
  - opts: \`{ offset, limit, pages }\`
- \`write(path, content)\` → confirmation string
- \`edit(path, oldString, newString, opts?)\` → confirmation string
  - opts: \`{ replace_all: true }\` to replace all occurrences

### Shell & Search
- \`bash(command, opts?)\` → stdout string
  - opts: \`{ timeout, description }\`
- \`grep(pattern, path?, opts?)\` → matching lines string
  - path defaults to \`'.'\`; opts: \`{ flags: '-rn' }\`
- \`glob(pattern, opts?)\` → newline-separated file paths (sorted by modification time)
  - Supports full glob syntax including \`**\` recursion: \`'**/*.ts'\`, \`'src/**/*.js'\`
  - Respects .gitignore by default — ignored files (node_modules, build, etc.) are excluded
  - opts: \`{ cwd, maxDepth }\`
  - opts: \`{ noIgnore: true }\` to include .gitignore'd files
  - opts: \`{ hidden: true }\` to include hidden files (dotfiles)
  - opts: \`{ ignore: ['*.min.js', 'dist/**'] }\` to add custom exclusions

### Notebook
- \`notebook_edit(path, { new_source, cell_id?, cell_type?, edit_mode? })\` → confirmation
  - \`new_source\`: the cell content to write (required unless deleting)
  - \`cell_id\`: cell ID to edit (required for replace/delete)
  - \`cell_type\`: 'code' or 'markdown' (required for insert)
  - \`edit_mode\`: 'replace' (default), 'insert', or 'delete'

### Web & Agents
- \`fetch(url, opts?)\` → AI-summarized response (NOT raw HTTP)
  - Returns CC's WebFetch output: a markdown summary of the page, not the raw response body
  - For raw HTTP/JSON, use \`bash('curl -s ...')\` instead
  - opts: \`{ prompt }\` — guide the summarization
- \`agent(prompt, opts?)\` → agent result string
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
  - \`var x = 42\` in call 1 → \`x\` available in call 2
  - \`x = 42\` (no keyword) in call 1 → \`x\` available in call 2
  - \`const\`/\`let\` do NOT persist (block-scoped by V8 design)
- Scripts WITH \`await\` or \`return\`: wrapped in async function — local variables don't persist
  - Use \`state.x = 42\` for values that must survive across async REPL calls
  - The \`state\` object always persists regardless of script type
- Bare expressions always work: \`42 + 1\` returns the value without needing \`return\`

## Error Recovery

When a REPL script fails, **fix the script and retry in REPL** — do not fall back to individual tools. Common fixes:
- File not found → check the path with \`glob()\` first, then retry
- Large file truncation → use \`read(path, { offset, limit })\` to read in chunks
- Permission denied → the file may be read-only; check with \`bash('ls -la ...')\`
- Syntax error → fix the JavaScript syntax and resubmit

Falling back to individual Read/Write/Edit calls after a REPL error wastes the batch advantage and floods the context window. Stay in REPL.

## Notes
- \`console.log()\` output is captured and included in the result
- \`return\` a value to include it in the response
- Use \`try/catch\` inside scripts to handle errors gracefully
- \`require()\` is available for: path, url, querystring, crypto, util, os
- All I/O goes through CC's permission system — writes will prompt for approval when configured`;
}

function replacePrompt() {
  return `# REPL \u2014 Your Execution Environment

REPL is a persistent Node.js VM with full access to file operations, shell commands, search, and data processing. JavaScript and bash work in tandem \u2014 you have the expressiveness of a programming language with the reach of a shell, all in a single tool call.

One REPL call can do what would otherwise take dozens of individual tool calls: scan a codebase, read every file, process the contents, compute metrics, and return structured results \u2014 all in one execution. Think in terms of programs, not commands.

## How to Think About REPL

Every task is a script. A file read is \`await read(path)\`. A shell command is \`await bash('...')\`. A search is \`await grep(pattern, path)\`. String them together with JavaScript \u2014 loops, conditionals, map/filter/reduce, JSON parsing, regex, error handling \u2014 and you have a pipeline that executes as a single tool call.

**The power is composition.** Instead of one call to find files, another to read them, another to process, another to write \u2014 write one script that does all four in a loop, with error handling, in one call.

**This is JavaScript, not Python.** Use string concatenation or template literals for formatting, .padStart()/.padEnd() for alignment, JSON.stringify() for serialization. No f-strings, no \u0060{:>5}\u0060 format specs.

## Available Functions (all async \u2014 use await)

### File Operations
- \`read(path, opts?)\` \u2192 string (file content)
  - opts: \`{ offset, limit, pages }\`
  - Reads up to 2000 lines by default. Files over 256KB throw an error \u2014 use offset/limit for large files
  - Binary files (images, videos, fonts) will throw \u2014 filter by extension before reading
  - Path should be absolute or relative to cwd
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
  - Uses ripgrep. Full regex syntax: \`"log.*Error"\`, \`"function\\s+\\w+"\`
  - path defaults to \`'.'\`; opts: \`{ flags: '-rn' }\`
- \`glob(pattern, opts?)\` \u2192 newline-separated file paths (sorted by modification time)
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
- Large file error \u2192 use \`read(path, { offset, limit })\` to read in chunks
- Binary file error \u2192 filter by extension before reading (skip png, jpg, mp4, etc.)
- glob returns too many files \u2192 use a specific extension pattern or \`bash('git ls-files')\`
- Syntax error \u2192 this is JavaScript, not Python. Fix the syntax and resubmit

## Notes
- \`console.log()\` output is captured and included in the result
- \`return\` a value to include it in the response
- Use \`try/catch\` inside scripts to handle errors gracefully
- \`require()\` is available for: path, url, querystring, crypto, util, os
- All I/O goes through CC's permission system \u2014 writes will prompt for approval when configured
- All paths are relative to the current working directory`;
}
// ---------------------------------------------------------------------------
// Tool Definition
// ---------------------------------------------------------------------------

module.exports = {
  name: 'REPL',
  inputJSONSchema: {
    type: 'object',
    properties: {
      script: {
        type: 'string',
        description: 'JavaScript code to execute. Use await for async operations. Return a value to include it in the response.',
      },
      description: {
        type: 'string',
        description: 'Brief description of what this script does',
      },
    },
    required: ['script'],
  },

  async prompt() {
    const mode = loadConfig().mode || 'coexist';
    if (mode === 'replace') return replacePrompt();
    return coexistPrompt();
  },

  async description() {
    return 'Execute JavaScript with access to file and shell operations. Batch multiple operations in one call.';
  },

  async call(args, context) {
    const startTime = Date.now();
    const { script, description } = args;

    // Update module-level context for tool handlers
    currentContext = context;

    // Get or create persistent VM
    const ctx = getOrCreateVM();

    // Reset per-call state
    operations = [];
    ctx.console.clear();

    let returnValue;
    let error;

    // Two-pass execution for variable persistence:
    // Pass 1: Run script directly (no wrapper). Top-level var and implicit
    //   globals persist on the VM context across calls. This fails if the
    //   script uses `await` (SyntaxError: await outside async function).
    // Pass 2: Wrap in async IIFE for await support. Variables declared with
    //   const/let/var are function-scoped and DON'T persist. Use the `state`
    //   object for explicit cross-call persistence in async scripts.
    try {
      returnValue = vm.runInContext(script, ctx, {
        timeout: getTimeout(),
        filename: 'repl-script.js',
        displayErrors: true,
      });
      // If the result is a promise (user wrote async code without await keyword
      // at top level), await it
      if (returnValue && typeof returnValue.then === 'function') {
        returnValue = await returnValue;
      }
    } catch (syncErr) {
      // G10: Only retry with IIFE when the script uses await/return keywords.
      // Check SCRIPT SOURCE, not error message — V8 error wording varies
      // (e.g. "for await" gives "Unexpected reserved word", not mentioning await).
      // If script doesn't use these keywords, the SyntaxError is genuine.
      const needsWrapping = syncErr.name === 'SyntaxError' && (
        /\bawait\b/.test(script) ||
        /\breturn\b/.test(script)
      );
      if (needsWrapping) {
        try {
          const wrappedScript = `(async () => { ${script} })()`;
          returnValue = await vm.runInContext(wrappedScript, ctx, {
            timeout: getTimeout(),
            filename: 'repl-script.js',
            displayErrors: true,
          });
        } catch (asyncErr) {
          error = asyncErr;
        }
      } else {
        error = syncErr;
      }
    }

    return { data: formatResult(description, startTime, returnValue, error) };
  },
};

// Self-reference so findTool can access _stashedTools set by the binary-patched loader
selfRef = module.exports;
