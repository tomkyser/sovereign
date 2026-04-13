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
    replConfig = raw.repl || {};
  } catch (e) {
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
    const result = await tool.call(args, currentContext);
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
    const result = await tool.call(args, currentContext);
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
    const result = await tool.call(args, currentContext);
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
    const result = await tool.call(args, currentContext);
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
      const result = await tool.call(args, currentContext);
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
  const maxDepth = (opts && opts.maxDepth) ? `-maxdepth ${opts.maxDepth} ` : '';
  const cmd = `find ${JSON.stringify(dir)} ${maxDepth}-name ${JSON.stringify(pattern)} -type f 2>/dev/null | sort`;
  const args = { command: cmd };

  return tracked('glob', args, async () => {
    const tool = findTool('Bash');
    if (!tool) throw new Error('Bash tool not found in registry');
    const result = await tool.call(args, currentContext);
    return (result.data.stdout || '').trim();
  });
}

async function notebook_edit(notebookPath, editOps) {
  checkAbort();
  const args = { notebook_path: notebookPath, ...editOps };

  return tracked('notebook_edit', args, async () => {
    const tool = findTool('NotebookEdit');
    if (!tool) throw new Error('NotebookEdit tool not found in registry');
    const result = await tool.call(args, currentContext);
    try {
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
    const result = await tool.call(args, currentContext);
    try {
      return typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    } catch (e) {
      return String(result);
    }
  });
}

async function agent(prompt, opts) {
  checkAbort();
  const args = { prompt: prompt };
  if (opts && opts.description !== undefined) args.description = opts.description;
  if (opts && opts.subagent_type !== undefined) args.subagent_type = opts.subagent_type;

  return tracked('agent', args, async () => {
    const tool = findTool('Agent');
    if (!tool) throw new Error('Agent tool not found in registry');
    const result = await tool.call(args, currentContext);
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
    return `# REPL — Batch Operations Engine

Execute JavaScript code with access to file and shell operations. Batch multiple operations in one call to reduce round-trips.

## When to Use REPL

Use REPL when a task involves **3 or more tool operations**, or when you need:
- Scan-filter-act patterns (glob → read → process → write)
- Bulk reads or edits across multiple files
- Loops, conditionals, or data processing
- Complex multi-step operations that would be noisy as individual tool calls

For simple single-file reads or one-off commands, use the individual tools directly.

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
- \`glob(pattern, opts?)\` → newline-separated file paths
  - opts: \`{ cwd, maxDepth }\`

### Other
- \`notebook_edit(path, editOps)\` → confirmation
- \`fetch(url, opts?)\` → response body string
- \`agent(prompt, opts?)\` → agent result string
  - opts: \`{ description, subagent_type }\`

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

## State Persistence
- Scripts WITHOUT \`await\`: \`var\` declarations and bare assignments persist across calls
  - \`var x = 42\` in call 1 → \`x\` available in call 2
  - \`x = 42\` (no keyword) in call 1 → \`x\` available in call 2
  - \`const\`/\`let\` do NOT persist (block-scoped by V8 design)
- Scripts WITH \`await\`: wrapped in async function — local variables don't persist
  - Use \`state.x = 42\` for values that must survive across async REPL calls
  - The \`state\` object always persists

## Notes
- \`console.log()\` output is captured and included in the result
- \`return\` a value to include it in the response
- Use \`try/catch\` inside scripts to handle errors gracefully
- \`require()\` is available for: path, url, querystring, crypto, util, os
- All I/O goes through CC's permission system — writes will prompt for approval when configured`;
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
      // If it's a SyntaxError (likely `await` outside async), retry with IIFE
      if (syncErr.name === 'SyntaxError' && /await/.test(script)) {
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
