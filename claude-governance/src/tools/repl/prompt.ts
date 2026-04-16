import { loadConfig, getAllowAllModules } from './config';

export function getPrompt(): string {
  const mode = loadConfig().mode || 'coexist';
  if (mode === 'replace') return replacePrompt();
  return coexistPrompt();
}

function requireNote(): string {
  if (getAllowAllModules()) {
    return '- `require()` is available for **all Node.js built-in modules** including `fs`, `child_process`, `http`, `net`, `stream`, etc. Use native JS for file I/O, binary analysis, and data processing instead of shelling out to bash';
  }
  return '- `require()` is available for: path, url, querystring, crypto, util, os';
}

function coexistPrompt(): string {
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

function replacePrompt(): string {
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
