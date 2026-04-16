# REPL Tool — Improvement Observations

Living document. Every session and agent MUST log observations here per the
CLAUDE.md directive. No filtering — raw feedback, ideas, friction points, and
enhancement opportunities. User will deliberate on these independently.

## Format

Each entry: date, context (what you were doing), observation. One line or a short
paragraph. Tag with a category if obvious.

### Categories
- **friction** — something that slowed you down or required workarounds
- **missing** — capability you wished existed
- **prompt** — improvement to REPL's prompt text or guidance
- **error** — error handling or recovery that could be better
- **pattern** — a usage pattern that should be documented or made easier
- **perf** — performance observation
- **ux** — output formatting, result presentation, developer experience
- **delegation** — issues with how REPL delegates to native tools
- **idea** — general enhancement idea

---

## Observations

**2026-04-13 | Binary analysis — grep on 12MB file** | friction, perf
grep -o with broad context patterns (.\{0,80\}) on the 12MB JS file takes 12-96 seconds per call. Byte-offset approach (grep -ob + dd) is instant. REPL could benefit from a documented pattern or helper for large-file binary analysis — "use grep -ob for offset, dd for extraction."

**2026-04-13 | Agent delegation absent in replace mode** | prompt, pattern
Full session of research/planning work — zero agent() calls despite CLAUDE.md directive to use sub-agents for >5 independent files. Replace mode filters Agent from direct tool visibility. REPL prompt mentions agent() in the Available Functions list but doesn't frame it as a parallelization strategy the way the native system prompt's "Sub-Agent Swarming" section does. The replace prompt may be suppressing agent delegation behavior by not promoting it.

**2026-04-13 | REPL as sole interface for all operations** | ux, pattern
In replace mode, REPL handles everything — file reads, searches, shell commands, analysis. This is powerful but creates a pattern where all operations are scripted JavaScript. Some tasks (like "read this one file") have unnecessary ceremony. The model writes `await read(path)` instead of just using Read. Trade-off is intentional but worth noting: replace mode optimizes for batch efficiency at the cost of single-operation simplicity.

**2026-04-13 | fetch() in REPL returns AI-summarized content** | ux, delegation
Used fetch() to grab the Haseeb gist. Got a useful AI summary. But if you need exact quotes or specific sections, the summarization lossy-compresses them. The prompt documents this and suggests bash('curl -s ...') for raw HTTP, but in practice the summarized version was sufficient. The fetch/curl distinction is well-documented but could be more prominent in the replace prompt.



**2026-04-14 | REPL agent() → subagent bash() fails with "O is not a function"** | bug, agent-spawning
Testing Tungsten tmux environment propagation through various tool/agent paths. REPL's own bash() works fine. Top-level Agent tool spawning subagents that call bash() works fine. But REPL's agent() function spawning a subagent that then calls bash() hits a runtime error: "O is not a function" — likely a minification artifact where a dependency isn't properly resolved in the subagent's tool runtime when spawned through REPL's agent() path. The subagent ran (3 tool calls, ~49K tokens) but couldn't execute any bash commands. The REPL-to-agent-to-bash path has a tool runtime initialization issue that doesn't exist in the top-level Agent-to-bash path.

## 2026-04-14 — GP3 Research Session

### REPL read() 512KB limit hit
- Context: Attempted to read /tmp/cc-extracted.js (12.8M chars) via REPL's read()
- The file is ~512KB which exceeds REPL's 256KB limit
- Had to fall back to grep via Bash for binary analysis
- Observation: For large file analysis, REPL should either support chunked reads or the limit should be documented in the prompt

### REPL glob() returns relative paths
- Context: Used glob() to find files in cc-source directory
- The paths returned were relative to cwd, but read() needs absolute paths
- The srcBase prefix wasn't being properly joined because glob returns paths differently than expected
- Observation: glob() path resolution behavior should be clearer — does it return paths relative to cwd or to the provided cwd option?
- **FIXED:** glob handler now resolves all paths to absolute via nodePath.resolve (commit 1366176)

## 2026-04-15 — REPL Fixes Session

### CC tool output limits discovered empirically
- Context: investigating why read() and bash() both returned only 30K chars for a 500K file
- Discovery: `maxResultSizeChars` per tool — Bash=30,000, Read=Infinity, Agent=100,000
- Found in leaked source: `BashTool.tsx:424`, `FileReadTool.ts:342`, `AgentTool.tsx:229`
- Observation: the 30K limit is exclusively Bash, not Read. Read's gates are fileReadingLimits (separate mechanism)

### fileReadingLimits override unblocks arbitrarily large reads
- Context: trying to read 289KB-3.4MB files through REPL read()
- Discovery: `fileReadingLimits` (maxSizeBytes=256KB, maxTokens=25K) comes from context object, fully overridable
- Fix: clone context, set `{maxSizeBytes: 10MB, maxTokens: Infinity}`, pass to tool.call()
- Observation: this is the cleanest fix — no bash fallback, no chunking, no agents needed for the read itself

### Agent canUseTool was undefined — "O is not a function"
- Context: testing agent() from REPL to delegate large file reads
- Root cause: handler passed `undefined` as 3rd arg to Agent.call(). Subagent toolExecution calls canUseTool() unconditionally
- Fix: pass `async (_tool, input) => ({behavior:'allow', updatedInput: input, ...})`
- Observation: every injected tool that calls other tools via tool.call() should pass a proper canUseTool, not undefined

### Agent result was JSON metadata, not text
- Context: agent() returning `{status, content, totalTokens}` JSON string instead of the agent's actual text response
- Root cause: handler did `typeof result.data === 'string' ? result.data : JSON.stringify(result.data)` — result.data IS a string (JSON), so it returned raw JSON
- Fix: extractAgentText() parses JSON, walks content[0].text
- Observation: all tool result extraction should handle CC's nested JSON envelope pattern

### MaxFileReadTokenExceededError fires on total file size, not slice
- Context: tried read(path, {offset:1, limit:100}) on a 618KB file — threw even though slice is tiny
- Root cause: leaked source limits.ts line 9: "Known mismatch: maxSizeBytes gates on total file size, not the slice"
- Observation: this is a CC bug they know about (ticket #21841). Our context override bypasses it entirely

### claude -p test reliability
- Context: running functional probes via `claude -p "Use REPL: ..."` 
- The model paraphrases results instead of returning raw output. Hard to distinguish "model summarized 30,000" from "REPL returned 30,000"
- Observation: need a more deterministic probe mechanism — maybe a dedicated test harness that inspects REPL tool result directly

### Observation: grep -oE with extended context on single-line files times out (2026-04-15)
**Context:** Searching 12.8MB single-line minified JS for patterns with surrounding context.
**What happened:** `grep -oE ".{0,100}pattern.{0,100}"` on the binary JS consistently times out
at 30 seconds. The -oP (Perl regex) variant also fails. The file being a single line means
regex engines backtrack catastrophically on lookaround-style context extraction.
**What works:** `grep -ob "pattern"` returns byte offsets in <1 second. Then `dd bs=1 skip=N count=M`
extracts context at specific offsets. This two-step approach (offset + dd) is 100x faster than
trying to do context extraction in grep.
**Improvement idea:** REPL could provide a `binarySearch(file, pattern, contextBytes)` helper
that automatically uses the offset+dd pattern for large single-line files. Detection: check if
file has <10 newlines and is >1MB.


## 2026-04-16 Session (3.5c Governance Integration)

### write() silently fails when hook guard blocks overwrite
Context: Tried to overwrite channel-dialog-bypass.ts via REPL write(). Reported "update" but read() showed old content.

### REPL read() CWD shifts after Tungsten cd
Context: After Tungsten session did cd, REPL paths resolved from new CWD. Required absolute paths.
