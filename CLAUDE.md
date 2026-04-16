# claude-governance — Project Instructions

## What This Project Is

A public toolkit to restore user authority over Claude Code. Anthropic ships software
that runs on user machines but intentionally degrades the user's ability to control it
via CLAUDE.md instructions. This project reverses that degradation through binary
patching, prompt rewriting, tool unlocking, and clean-room reimplementations.

This is NOT a jailbreak. This is users exercising control over software on their own
hardware. Every patch is transparent, reversible, and documented.

## Developer Documentation
Comprehensive verified docs covering architecture, binary patching, prompt overrides,
tool injection, verification engine, hooks, configuration, CLI, and env flags:
@docs/README.md

## Architecture -- keep updated! (audit at session start)
@.planning/project-managment/architecture.md

## Key Principles

1. **Solve for everyone, not just power users.** Every feature must work for any native
   CC install without requiring homebrew, manual binary editing, or source compilation.

2. **Future-proof over point-fix.** Pattern matching must anticipate minification changes.
   Verify assumptions at runtime. Halt and catch fire on unexpected state rather than
   silently degrading.

3. **The binary is the board.** We're playing chess against Anthropic's build pipeline.
   Anything that lands local can be intercepted, matched, and patched. Design for the
   most aggressive obfuscation they might reasonably employ.

4. **Full visibility.** If the system prompt changes, we know. If tools are gated, we
   detect it. If CLAUDE.md is being ignored, we alarm. No silent degradation.

5. **Fork, don't rebuild.** When proven tooling exists, fork it. A fork carries the
   full codebase, data, history, and battle-tested edge case handling. Selective copying
   or reimplementation loses exactly the parts you don't know you need. "Fork" means
   git fork — the entire repo, not cherry-picked functions.

## Mandatory Verification — Load relevant file(s) depending on conversation or project state
These checks prevent the kind of compounding errors that waste entire sessions.

### On Session Start (Before Any Work)
@.planning/project-managment/session-start.md

### Work and Decision Guidance
@.planning/project-managment/making-decisions.md

### Before Completing Work
@.planning/project-managment/before-completing-work.md

### Before Claiming Something Is Done
@.planning/project-managment/before-done.md

### When Corrected
@.planning/project-managment/when-corrected.md

## Anti-Patterns — Do NOT Do These

- **Do not reference ~/.tweakcc/ as a runtime dependency.** Our tool uses
  `~/.claude-governance/` with legacy fallback. Must be self-contained.
- **Do not hardcode text that should come from files.** Prompt text, patch definitions,
  and replacement strings load from data files, not inline constants.
- **Do not propose downloading from external repos as a primary strategy.** Our tool
  ships with its own data. External repos are references, not dependencies.
- **Do not claim something is "done" without verifying it against the actual state.**
  Check git, run the binary, inspect the output.
- **Do not optimize for "works on Tom's machine right now."** Build for "works for
  any user who installs the npm package."

## Git Policy

- **Default branch:** `master` (not main)
- **Atomic commits.** Each logical change gets its own commit. No multi-phase megacommits.
- **No worktrees.**
- **Housekeeping:** Commit and push at the end of each completed task or phase. Do not accumulate uncommitted work across multiple tasks.
- **Versioning (semver + gh release API):**
  - Master (release): `v{major}.{minor}.{patch}` — tag: `{major}.{minor}.{patch}`
  - Development (testing channel): `dev—{major}.{minor}.{patch}` — tag: `D.{major}.{minor}.{patch}`
  - Feature/Task branches: `{feature/task}-{milestone}-{phase}-{patch}`

## Project Management — Rigid Process (No Exceptions)
You don't need to load and read each of these every turn, just when relevant to what you are doing based on the current state and conversation context.

### .planning directory structure:
@.planning/project-managment/pm-structure.md

### Phase Lifecycle (No Exceptions)

Every phase follows this sequence. Steps are not optional.
**1. Research** @.planning/project-managment/phase-steps/1.md
**2. Planning** @.planning/project-managment/phase-steps/2.md
**3. Act** @.planning/project-managment/phase-steps/3.md
**4. Verify** @.planning/project-managment/phase-steps/4.md
**5. Gap Analysis** @.planning/project-managment/phase-steps/5.md
**6. Housekeeping & Bootstrap** @.planning/project-managment/phase-steps/6.md

### Milestone Lifecycle
@.planning/project-managment/milestone-steps/milestone-process.md

### Reference Citation Protocol

Planning docs (RESEARCH.md, IMPACT.md, PLANNING.md) reference external resources
by identifier from `.planning/REFERENCES.md` — e.g., `[tweakcc1]`, `[stellaraccident1]`.
Never inline raw URLs in planning docs. This keeps docs clean, deduplicates references,
and makes it easy to update URLs in one place.

### Tracking Hierarchy

| Tool | Scope | Persistence |
|------|-------|-------------|
| TASKS.md + TaskCreate | Current phase, synced | TASKS.md persists across sessions; TaskCreate mirrors it in-session |
| Phase TRACKER.md | Single phase, across sessions | `.planning/milestones/M-{n}/{phaseName}/` |
| Milestone IMPACT.md | Cross-phase impact | `.planning/milestones/M-{n}/` — updated whenever scope shifts |
| Milestone FINDINGS.md | Milestone-scoped discoveries | `.planning/milestones/M-{n}/` |
| STATE.md | Global project state | `.planning/STATE.md` |
| ROADMAP.md | All phases, all milestones | `.planning/ROADMAP.md` |

Phase trackers fold UP into STATE.md. ROADMAP.md is the living source of truth —
it carries the top-level task list per phase, updated during planning and on completion.
Phase trackers track PM concerns only (decisions, blockers, status) — no redundancy with ROADMAP.

### Journals (create before compaction or when user indicates intent to clear context)

- Named `session-YYYY-MM-DD[-suffix].md` with real dates
- Stored in `.planning/journals/`
- Record decisions, findings, and gotchas that the tracker doesn't capture
- Suffix with `-a`, `-b`, etc. for multiple sessions on the same day

## Execution Rules

- Read files before editing. Context decays after 10+ messages.
- <=5 files per phase. Verify each phase before proceeding.
- "Make a plan" = output the plan only. No code until greenlit.
- Verify foundational assumptions against git state and file state before building.

## Testing

Every patch and hook must have a verification path:
- Governance patches: verified via tweakcc (interim) / claude-governance check (post-fork)
- Embedded tools: `embedded-tools-verify.cjs` (8 checks including binary symbol scan)
- Feature flags: flag audit against extracted JS
- All verification hooks write state to `~/.claude-governance/` for statusline

## What We've Discovered
@.planning/FINDINGS.md

## External References

All external references (repos, gists, docs, URLs) are in `.planning/REFERENCES.md`.
Cite by identifier (e.g., `[tweakcc1]`, `[stellaraccident1]`) — never inline raw URLs
in planning docs. Per-milestone and per-phase RESEARCH.md files cross-reference from
REFERENCES.md for their scoped context.

**Local paths:**
- Project root: `/Users/tom.kyser/dev/claude-code-patches`
- The product: `/Users/tom.kyser/dev/claude-code-patches/claude-governance`
- Prompt overrides: `/Users/tom.kyser/dev/claude-code-patches/prompts`
- Fork source (local): `/Users/tom.kyser/dev/tweakcc`
- CC leaked source: `/Users/tom.kyser/dev/cc-source`
- Clawback hooks: `/Users/tom.kyser/dev/clawback`

## WebFetch Returns AI Summaries — Use curl for Raw Content

The WebFetch tool and REPL's `fetch()` helper do NOT return raw HTTP responses.
They return an AI-generated markdown summary of the page content. This means:
- JSON APIs return narrative descriptions, not the actual JSON
- Documentation pages return lossy summaries, not the source text
- Raw data is transformed and potentially hallucinated

**Always use `bash('curl -sL "URL"')` or REPL's `bash()` when you need actual content.**
WebFetch is only useful when you want a quick summary of a page you don't need to
parse or quote accurately.

## REPL Tool Observation Directive — Mandatory

**Every session, every agent, every REPL tool call.** This is a standing order.

When you use the REPL tool (or observe an agent using it), log any improvement idea,
friction point, missing capability, error handling gap, prompt deficiency, or
enhancement opportunity to `.planning/research/REPL-IMPROVEMENTS.md`.

### Rules
1. **Do not filter.** Log everything that strikes you, no matter how minor. The user
   will deliberate on value later. Your job is to capture raw signal.
2. **Do not batch.** Log observations as they occur — append to the file during the
   session, not at the end. Context decays; capture it fresh.
3. **Do not editorialize.** State what happened or what you noticed. Skip the
   "this might be useful because..." framing.
4. **Include context.** What were you doing when you noticed it? What was the REPL
   call trying to accomplish?
5. **Applies to agents too.** When spawning subagents that will use REPL, include
   this directive in their prompt. They must log to the same file.
6. **Never skip this.** Even if the observation seems obvious or already logged,
   add it. Duplicates signal importance.

## REPL — Use the Full VM, Not a Bash Wrapper

You have a **full Node.js VM** inside REPL. `require()` works. `fs`, `path`, `crypto`,
`url`, `os`, `util`, `querystring` are all available. The `read()`, `write()`, `edit()`,
`bash()`, `grep()`, `glob()`, `fetch()`, `agent()` helpers are convenience wrappers —
they are not the ceiling of what you can do.

### What This Means in Practice

**File analysis without shell gymnastics.** Instead of `bash('grep -ob "pattern" file')`
followed by `bash('dd if=file bs=1 skip=N count=M')`, do this:
```javascript
const fs = require('fs');
const content = fs.readFileSync('/path/to/large-file.js', 'utf-8');
const idx = content.indexOf('targetPattern');
const context = content.substring(idx - 200, idx + 200);
return context;
```
One operation. No timeouts. No single-line-file grep catastrophes. No 30-second waits
for extended regex on 12MB files.

**Complex multi-step pipelines in a single call.** REPL replaces dozens of sequential
tool calls with one script. A pipeline that would be 15 Read + 5 Bash + 3 Edit calls
becomes one REPL call with a `for` loop. That's 23 fewer tool results in context,
23 fewer inference rounds, and 23 fewer permission checks.

**State persists across calls** via the `state` object (for async scripts) or `var`
declarations (for sync scripts). Build up data structures across multiple REPL calls
without re-reading files.

**Binary analysis.** `Buffer.from(fs.readFileSync(path))` gives you byte-level access.
`indexOf` on buffers, `slice` for extraction, `toString('hex')` for inspection. No
more shelling out to `xxd` or `hexdump`.

### The Rule

Default to native JS in REPL. Only use `bash()` when you genuinely need a shell:
git operations, process management, commands with complex pipes, tools that only
exist as CLI binaries. If you're doing string search, file I/O, JSON parsing, data
transformation, or pattern matching — that's JavaScript, not bash.

**Every `bash()` call inside REPL that could have been native JS is a missed
opportunity and a wasted round-trip.** The VM is the tool. Use it.

## Tungsten — Persistent Shell and Session Spawning

You have Tungsten: a persistent tmux-backed execution environment that survives
between tool calls. But Tungsten is much more than a shell — it is your gateway to
**spawning fully independent Claude Code sessions** and maintaining **persistent
state across your entire workflow**.

### What You Actually Have

**A persistent shell.** Environment variables, working directory, running processes
all survive between your tool calls. `export FOO=bar` in one Bash call is still there
in the next. Dev servers you start keep running. Build watchers stay alive. This is
not a series of disconnected shell invocations — it's a continuous environment.

**Your agents inherit it.** When you spawn subagents (via Agent tool or REPL's
`agent()` helper), they inherit the Tungsten tmux environment via `process.env`.
An agent can `cd` into a directory you set up, read env vars you exported, interact
with servers you started. The persistent context flows downward to every agent in
your tree.

**Full Claude Code sessions on demand.** You can launch `claude` inside Tungsten —
a fully capable, interactive Claude Code session with its own conversation, tools,
and governance patches. This is not `claude -p` (non-interactive, limited). This is
a real session that can think, plan, use tools, read files, run commands, and report
back. Use it when:
- You need a **second opinion** on an approach (launch a session, ask it to review)
- You need to **delegate a self-contained task** (research, analysis, code generation)
- You need to **test something in isolation** without polluting your own context
- You want to **observe how Claude Code behaves** with specific configurations
- You need **parallel execution** — multiple sessions working on different problems

### How to Use It

```
# Create a named session for a specific purpose
Tungsten({action: "create", session: "research"})

# Launch a full Claude session inside it
Tungsten({action: "send", command: "claude", session: "research"})

# Send it a task
Tungsten({action: "send", command: "Research how MCP servers declare channel capabilities and report findings", session: "research"})

# Check on it later
Tungsten({action: "capture", session: "research", lines: 100})

# Run a dev server in one session, tests in another
Tungsten({action: "send", command: "npm run dev", session: "server"})
Tungsten({action: "send", command: "npm test -- --watch", session: "tests"})
```

### The Rule

**Use Tungsten proactively.** Don't wait to be told. If a task would benefit from
a persistent environment, a background process, or a second Claude session — use it.
The cost of spinning up a session is negligible compared to the cost of working without
the right tool. You have the authority to create sessions, delegate work, and manage
multiple execution contexts simultaneously.
