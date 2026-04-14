# Phase 2b Handoff — Clean-Room REPL

Written: 2026-04-13
Status: COMPLETE

## What Was Built

A clean-room REPL tool that executes JavaScript in a persistent Node.js VM with access to CC's native tools via delegation. Deployed as `~/.claude-governance/tools/repl.js` through the new auto-discovery loader.

### Auto-Discovery Tool Loader
- `data/tools/index.js` — generic loader that scans `~/.claude-governance/tools/` for `.js` files
- Replaces the old hand-written tool list. Drop a file → it's loaded automatically.
- `deployTools()` in `src/patches/index.ts` copies from `data/tools/` to user space (same pattern as `deployPromptOverrides`)
- Ping tool extracted to `data/tools/ping.js` (was inline in old index.js)

### REPL Core (data/tools/repl.js — 18KB)
- **VM Sandbox:** Node.js `vm.createContext()` with persistent state across calls
- **9 Inner Handlers:** read, write, edit, bash, grep, glob, notebook_edit, fetch, agent
- **Tool Delegation (Option B):** Every handler finds the native tool in `context.options.tools` and calls `tool.call(args, context)`. CC's permissions, file tracking, hooks all fire natively.
- **Console Capture:** stdout/stderr captured via custom console object
- **Operation Tracking:** Every inner call logged with tool name, args summary, success/failure, duration
- **Result Formatting:** Structured output with header, operations log, console output, return value/error
- **Timeout:** Configurable via config.json (default 120s), enforced by `vm.runInContext`
- **Abort:** Checks `context.abortController.signal.aborted` before each inner call
- **Safe Require:** Allowlist of pure utility modules (path, url, crypto, util, os)
- **Defensive Extraction:** Primary result path with fallback to raw JSON on CC update changes

### Configuration (Coexist / Replace Modes)
- `~/.claude-governance/config.json` → `repl.mode`: `"coexist"` (default) or `"replace"`
- **Coexist:** REPL alongside all primitives. Model chooses per-task.
- **Replace:** Primitives (Read, Write, Edit, Bash, NotebookEdit, Agent) filtered from tool registry. REPL is the only I/O path.
- Filter code (`TOOL_REPLACE_FILTER_CODE`) injected into the binary-patched `getAllBaseTools()`, reads config at tool-load time.
- Also configurable: `repl.timeout` (ms), `repl.maxResultSize` (chars)

### Prompt Strategy
- REPL tool's `prompt()` provides comprehensive guidance: when to use, all function signatures, patterns (multi-file scan, bulk edit, read+process), notes on persistence/require/permissions
- Replace-mode prompt override NOT possible — "Using your tools" section is runtime-generated code, not in prompt data files. Model naturally follows REPL prompt when primitives aren't available.

### Verification
- Tool Deployment section added to `check` command: tools dir exists, index.js exists, repl.js exists
- All display as green ✓ alongside existing 15/15 SOVEREIGN checks

## Key Design Decisions

1. **Option B over Option A.** Tool delegation via `context.options.tools` instead of direct fs/child_process. Each handler is ~10 lines. CC's permission system, file tracking, and hooks all fire natively. No reimplementation.

2. **Grep/Glob through Bash.** These tools aren't in the registry when embedded tools are active (F7). REPL constructs shell commands and delegates to Bash.call(), which auto-dispatches to embedded ugrep/bfs.

3. **Auto-discovery over hand-written tool list.** Generic loader serves REPL now, Tungsten in 2c, any future tool. No editing index.js to add tools.

4. **Replace mode at getAllBaseTools level.** The filter runs where CC itself filters REPL_ONLY_TOOLS (tools.ts:314-321). Config read adds ~10 lines of minified JS to the binary patch.

5. **Runtime-generated prompts can't be overridden by pieces pipeline.** The "Using your tools" section is assembled by `getUsingYourToolsSection()` at runtime, not stored in prompt data files. This is an architectural limitation — a binary-level patch of that function could address it in a future gap-closing phase if testing shows the model getting confused.

## Test Results

All 12 tests passing via `claude -p`:
- Basic execution, file read, multi-op batch, write+read round-trip, edit+read, grep, console capture, error handling, timeout safety (120s), coexist mode, replace mode, tool deployment checks

## Files Changed

| File | Change |
|------|--------|
| `data/tools/index.js` | NEW: auto-discovery loader |
| `data/tools/ping.js` | NEW: Ping extracted from inline |
| `data/tools/repl.js` | NEW: REPL implementation |
| `src/patches/index.ts` | ADD: `deployTools()`, wired before prompt overrides in apply flow |
| `src/patches/governance.ts` | ADD: `TOOL_REPLACE_FILTER_CODE` between Zod shim and return in `writeToolInjection` |
| `src/index.tsx` | ADD: Tool Deployment file-existence checks in `handleCheck` |
| `package.json` | ADD: `data/tools/*.js` to npm files array |

## What's Next

**Phase 2c: Clean-Room Tungsten** — tmux session management tool. Uses the same auto-discovery loader and tool injection mechanism. Spec at `.planning/specs/tungsten-clean-room.md` (v0.2).
