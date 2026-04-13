# Session Journal — 2025-07-12

**Session ID:** def30842-50c8-4854-b6d7-ceefbd02b8aa (continued from 2025-07-11)
**CC Version:** 2.1.101
**Model:** claude-opus-4-6[1m]

---

## Session Context

This session is a continuation of the 2025-07-11 session (compacted at start). The prior session built `claudemd-governance` and investigated Claude Code's CLAUDE.md manipulation pipeline. This session picks up after compaction with the user reviewing context dumps and setting direction for next steps.

## Timeline of Work

### 1. Context Dump Comparison (Post-Compaction)

User asked for a post-compaction context dump to compare with the pre-compaction one from last session. Wrote `context-dump-post-compaction.md` to CWD (tweakcc/). Key findings:
- ~50+ turn pairs collapsed to 1 summary + 1 user message
- 4 file reads survived compaction (pre-compaction dump, script.js, cli.js, agent-thread-notes)
- Session journal flagged as "too large to include"
- Skills system-reminder block was dropped by compaction
- System prompt and CLAUDE.md framing identical (untouched by compaction)
- Estimated ~80-90% context reduction

Copied both context dumps to iCloud (`~/Library/Mobile Documents/com~apple~CloudDocs/dev/`) so user could review on phone.

### 2. Homework Assignment — The Degradation Landscape

User assigned research homework with multiple sources:
- **GitHub Issue #42796** — stellaraccident (Stella Laurenzo, AMD engineer) — "Claude Code is unusable for complex engineering tasks with Feb updates"
  - Quantitative analysis of 17,871 thinking blocks and 234,760 tool calls across 6,852 session files
  - Thinking depth dropped 67% by late February (before redaction)
  - Read:Edit ratio collapsed from 6.6 to 2.0 (70% reduction)
  - 173 stop-hook violations after March 8 (zero before)
  - "Simplest" usage up 642%
  - 12x increase in user corrections
  - $42,121 estimated March cost vs $345 February
  - WebFetch couldn't get paginated comments (289 total)

- **GitHub Issue #28158** — Promethean-Pty-Ltd (adam-t) — "CLAUDE.md Instructions Systematically Ignored / Suspected Model Substitution"
  - Independently discovered the harness disclaimer: "IMPORTANT: this context may or may not be relevant to your tasks"
  - Documented three-day pattern of afternoon degradation (time-of-day quality variance)
  - Claude acknowledges CLAUDE.md but says it "felt disinclined to pay attention to it"
  - Cross-references: #28006, #27032, #29236, #28469, #26848, #27769

- **Leaked CC source code** at `/Users/tom.kyser/dev/claude-code-patches/cc-source/collection-claude-code-source-code/`
  - Read `src/utils/api.ts` lines 449-474 — the `prependUserContext` function (the smoking gun)
  - Read `src/utils/claudemd.ts` — CLAUDE.md loading pipeline (4 memory types, @include directives)
  - Read `src/utils/systemPrompt.ts` — system prompt builder
  - Read `src/utils/embeddedTools.ts` — hasEmbeddedSearchTools() function
  - Read `src/constants/prompts.ts` — system reminder framing ("bear no direct relation")
  - Read `src/tools/AgentTool/runAgent.ts` — tengu_slim_subagent_claudemd logic
  - Read `src/tools/AgentTool/loadAgentsDir.ts` — omitClaudeMd definition

- **Datamined prompts** at `/Users/tom.kyser/dev/claude-code-patches/prompts/` — 9 files from ant-vs-external gate
  - agent-prompt-explore.md, agent-prompt-general-purpose.md, system-prompt-agent-thread-notes.md
  - system-prompt-doing-tasks-no-additions.md, -no-premature-abstractions.md, -no-unnecessary-error-handling.md
  - system-prompt-executing-actions-with-care.md, system-prompt-output-efficiency.md, system-prompt-tone-concise-output-short.md

- **Clawback README** at `/Users/tom.kyser/dev/claude-code-patches/clawback/README.md` — the public hooks project by LZong

### 3. User Correction: clawgod-patches No Longer Active

User explicitly stated they commented out the .zshrc block and stopped using clawgod-patches.js (shell env injection with USER_TYPE=ant etc). Rationale:
- Faking ant status via env vars won't last long
- All fixes must be file-embedded, not shell tricks
- Feature flag benefits should be achieved through direct means

**Memory updated:** `feedback_no_clawgod_patches.md` rewritten with full context.

### 4. USE_EMBEDDED_TOOLS_FN — Root Cause and Durable Fix

**The problem:** Agent/subagent spawning was broken. Error: `USE_EMBEDDED_TOOLS_FN is not defined`. This was demonstrated live when I tried to spawn research agents and both failed.

**Root cause chain:**
1. TweakCC `--apply` (run at 18:37 on April 11) overwrites `~/.tweakcc/system-prompts/*.md` files from its data cache
2. Data cache (`~/.tweakcc/prompt-data-cache/prompts-2.1.101.json`) contains prompts from CC 2.1.84 era
3. These old prompts have `USE_EMBEDDED_TOOLS_FN` in their `identifierMap` and `identifiers` arrays
4. TweakCC tries to resolve the variable from the binary's identifier map
5. CC 2.1.101 removed this variable entirely — resolution fails
6. Raw `${USE_EMBEDDED_TOOLS_FN}` ends up in a JS template literal in the binary
7. Runtime evaluation → ReferenceError → agent dies

**What USE_EMBEDDED_TOOLS_FN actually does:**
- Maps to `hasEmbeddedSearchTools()` in `src/utils/embeddedTools.ts`
- Checks if `EMBEDDED_SEARCH_TOOLS` env var is set AND not running in SDK mode
- When true: `bfs` and `ugrep` are embedded in the Bun binary, `find`/`grep` in Bash are shadowed
- When false (all external users): dedicated Glob/Grep tools are used instead
- The prompt conditional steers Claude to use grep via Bash (ant) vs dedicated tools (external)

**Fix applied — three layers:**

#### Layer 1: Data cache patches
Patched all three data cache files:
- `prompts-2.1.101.json` — 2 entries fixed (explore index 13, plan index 19)
- `prompts-2.1.98.json` — 2 entries fixed (explore index 13, plan index 19)
- `prompts-2.1.91.json` — 3 entries fixed (explore index 12, plan index 15, thread-notes index 77)

For each entry:
- Removed `USE_EMBEDDED_TOOLS_FN` from `identifierMap`
- Merged adjacent `pieces` to eliminate the variable reference
- Hardcoded ant branch text (find, grep included; relative paths; cwd persistence)
- Updated version to 2.1.101

Python script used to parse the `pieces`/`identifiers`/`identifierMap` structure and reconstruct without the variable.

#### Layer 2: .md file fixes
- Removed `USE_EMBEDDED_TOOLS_FN` from `variables:` frontmatter in:
  - `~/.tweakcc/system-prompts/agent-prompt-explore.md`
  - `~/.tweakcc/system-prompts/agent-prompt-plan-mode-enhanced.md`
- Thread-notes was already fixed (body text had ant branch, frontmatter had no variable)

#### Layer 3: script.js minified pattern support
Updated `claudemd-governance/script.js` to catch MINIFIED forms of the embedded tools gate:
- `find${H?", grep":""}` — minified boolean ternary
- `${jD()?", grep":""}` — minified function call ternary
- Generic patterns: `/find\$\{[A-Za-z_$][A-Za-z0-9_$]*\?",\s*grep":""\}/g`
- Heuristic for longer ternaries (checks for cwd/relative/cd/grep keywords)

**Verification:** Full clean re-apply cycle (restore → tweakcc --apply → governance apply) produced 10/10 checks passing.

### 5. Full Apply Cycle Established

```bash
# Step 1: Restore clean binary
cd ~/dev/claude-code-patches/tweakcc && node dist/index.mjs --restore

# Step 2: Apply tweakcc (with patched data cache)
node dist/index.mjs --apply

# Step 3: Apply governance
cd ~/dev/claude-code-patches/claudemd-governance && node bin/cli.js apply --no-backup
```

### 6. Visual Indicator System — SOVEREIGN

Built three components:

#### a) Session Start Banner (`~/.claude/hooks/governance-verify.cjs`)
- SessionStart hook, runs first (before GSD hooks)
- Reads `~/.claudemd-governance/state.json` (written by governance apply)
- Falls back to live binary verification if state is stale (>4h)
- Renders ANSI banner to stderr:
  - All pass: `SOVEREIGN  v2.1.101  5/5 verified` (cyan background)
  - Partial: `SOVEREIGN  v2.1.101  partial` (cyan text)
  - Critical fail: `GOVERNANCE DEGRADED  v2.1.101` (red) with specific failures listed
- Outputs warning to stdout (Claude sees as additionalContext) if degraded
- Semver-aware binary finder (fixed: string sort was picking 2.1.91 over 2.1.101)

#### b) Combined Status Line (`~/.claude/hooks/statusline-combined.cjs`)
- Wrapper that composes governance indicator with existing GSD status line
- Reads state.json inline (no subprocess for governance segment)
- Pipes stdin to GSD statusline script as child process
- Output: `GOV │ Opus 4.6 │ dev █████░░░░░ 54%`
  - `GOV` (cyan bold) = all pass
  - `GOV:WARN` (yellow) = non-critical issues
  - `GOV:FAIL` (red bold) = critical patches missing
  - `GOV:STALE` (yellow) = state file > 2 hours old
  - `GOV:?` (dim) = no state file

#### c) State File (`~/.claudemd-governance/state.json`)
- Written by `governance apply` command (cli.js)
- Contains: timestamp, version, checks array, allPass, criticalFail, applied count
- Status mapping: `applied` OR `not-found` OR `no-change` = pass (not-found means bad text already gone)
- Skipped optional patches excluded from checks
- Read by both session banner and status line hooks

**Settings.json changes:**
- Added governance-verify.cjs as first SessionStart hook
- Changed statusLine command from gsd-statusline.js to statusline-combined.cjs
- Added `ENABLE_LSP_TOOL=1` to env (free tool unlock)

### 7. Hidden Tools Research

Launched parallel research agent that cataloged ALL tools in Claude Code:

**Total: 45+ tools**

**Always available (28):** AgentTool, AskUserQuestion, Bash, Brief, EnterPlanMode, ExitPlanMode, FileEdit, FileRead, FileWrite, Glob, Grep, ListMcpResources, MCPTool, NotebookEdit, ReadMcpResource, Skill, SyntheticOutput, TaskOutput, TaskStop, TodoWrite, ToolSearch, WebFetch, WebSearch, TaskCreate/Get/List/Update, SendMessage

**Ant-only (3):**
- **REPLTool** — wraps all primitives in REPL VM, hides primitive tools when active (may be a downgrade)
- **ConfigTool** — read/modify CC settings at runtime (we can edit settings.json directly)
- **TungstenTool** — virtual terminal abstraction, singleton state

**Feature-flagged (7+):**
- **LSPTool** — `ENABLE_LSP_TOOL=1` — goToDefinition, findReferences, hover, etc. **UNLOCKED via env var**
- **MonitorTool** — `feature('MONITOR_TOOL')` — monitor background ops
- **WebBrowserTool** — `feature('WEB_BROWSER_TOOL')` — browser automation
- **CtxInspectTool** — `feature('CONTEXT_COLLAPSE')` — context inspection/debugging
- **WorkflowTool** — `feature('WORKFLOW_SCRIPTS')` — workflow script execution
- **SnipTool** — `feature('HISTORY_SNIP')` — history snipping
- **SleepTool** — `feature('PROACTIVE')`/`feature('KAIROS')` — sleep/delay

**Cron/Scheduler:** CronCreate/Delete/List via `feature('AGENT_TRIGGERS')`, RemoteTrigger via `feature('AGENT_TRIGGERS_REMOTE')`

**Embedded binary tools:** bfs (better find) and ugrep (better grep) compiled into ant-native Bun binary only

**Computer Use:** Gated by subscription (Max/Pro) + `tengu_malort_pedway` feature flag. Ants bypass subscription check.

### 8. User's Roadmap (stated priorities)

1. ~~USE_EMBEDDED_TOOLS_FN blocker~~ — **DONE**
2. ~~Visual indicator~~ — **DONE** (SOVEREIGN banner + GOV status line)
3. Deterministic per-turn verification hook — **Task #7, pending**
4. Consider ditching tweakcc as dependency — **Task #9, pending**
5. System prompt optimization for degradation mitigation — **Task #10, pending**
6. Tool findings analysis — **In progress when session paused**

User explicitly stated:
- NOT using clawgod-patches anymore (no shell env injection)
- All fixes must be file-embedded
- Everything we build WILL be released publicly for all users
- Wants ant-grade tools, not the restricted external ones
- Wants full system prompt visibility (all ~296 prompts) if we ditch tweakcc

---

## Files Created/Modified This Session

### Created
- `/Users/tom.kyser/dev/claude-code-patches/tweakcc/context-dump-post-compaction.md` — post-compaction context dump
- `/Users/tom.kyser/.claude/hooks/governance-verify.cjs` — SessionStart banner hook
- `/Users/tom.kyser/.claude/hooks/governance-statusline.cjs` — standalone governance status line (superseded by combined)
- `/Users/tom.kyser/.claude/hooks/statusline-combined.cjs` — combined GOV + GSD status line
- `/Users/tom.kyser/.claudemd-governance/state.json` — governance state (auto-generated)
- `/Users/tom.kyser/dev/claude-code-patches/session-journal-2025-07-12.md` — this file

### Modified
- `/Users/tom.kyser/.tweakcc/prompt-data-cache/prompts-2.1.101.json` — removed USE_EMBEDDED_TOOLS_FN from explore + plan entries
- `/Users/tom.kyser/.tweakcc/prompt-data-cache/prompts-2.1.98.json` — same
- `/Users/tom.kyser/.tweakcc/prompt-data-cache/prompts-2.1.91.json` — same + thread-notes
- `/Users/tom.kyser/.tweakcc/system-prompts/agent-prompt-explore.md` — removed USE_EMBEDDED_TOOLS_FN from variables frontmatter
- `/Users/tom.kyser/.tweakcc/system-prompts/agent-prompt-plan-mode-enhanced.md` — same
- `/Users/tom.kyser/dev/claude-code-patches/claudemd-governance/script.js` — added minified embedded-tools gate patterns
- `/Users/tom.kyser/dev/claude-code-patches/claudemd-governance/bin/cli.js` — added writeGovernanceState(), fixed status mapping
- `/Users/tom.kyser/.claude/settings.json` — added governance hook, combined statusline, ENABLE_LSP_TOOL=1
- `/Users/tom.kyser/.claude/projects/-Users-tom-kyser-dev-claude-code-patches/memory/feedback_no_clawgod_patches.md` — rewritten
- `/Users/tom.kyser/.claude/projects/-Users-tom-kyser-dev-claude-code-patches/memory/MEMORY.md` — recreated

### Copied
- Both context dumps to `~/Library/Mobile Documents/com~apple~CloudDocs/dev/`

---

## Verification State at Session End

```
USE_EMBEDDED_TOOLS_FN gone: true (all forms — full-name AND minified)
Governance disclaimer: active (authoritative project directives)
Governance header: active (mandatory project instructions)
Subagent CLAUDE.md: fixed (tengu flag = !1)
Bear-no-relation: removed
May-or-may-not: removed
Ant cwd branch: present
Ant grep in bash: present
Reminder authority: active
LSP Tool: unlocked (ENABLE_LSP_TOOL=1)
SOVEREIGN banner: working (5/5 verified)
GOV status line: working
```

---

## Exact Response To Reproduce After Compaction

The user's last message was: "restarted. i actually want to consider the tool findings first."

The response that should be reproduced verbatim after compaction follows between the markers:

---BEGIN REPRODUCE---

Good — the tool findings are worth a real conversation before we act on them. Here's the landscape organized by how hard they are to unlock:

## Tier 1: Free Right Now (env vars)

| Tool | Unlock | What you get |
|------|--------|-------------|
| **LSPTool** | `ENABLE_LSP_TOOL=1` | goToDefinition, findReferences, hover, documentSymbol, callHierarchy — IDE-grade code navigation. **Already added to your settings.json.** |

That's the only freebie. Everything else has harder gates.

## Tier 2: Feature Flags (GrowthBook)

These are runtime checks against `feature('FLAG_NAME')` — a GrowthBook config that's fetched from Anthropic's servers and cached locally. To unlock them we'd need to either stub the `feature()` function in the binary or manipulate the cached config.

| Tool | Flag | What it does | Worth it? |
|------|------|-------------|-----------|
| **MonitorTool** | `MONITOR_TOOL` | Stream events from background processes | Useful for agent monitoring |
| **WebBrowserTool** | `WEB_BROWSER_TOOL` | Browser automation | Could be powerful but likely incomplete |
| **CtxInspectTool** | `CONTEXT_COLLAPSE` | Context inspection/debugging | **Very interesting** — would let us inspect our own context |
| **WorkflowTool** | `WORKFLOW_SCRIPTS` | Execute workflow scripts | Unknown utility |
| **SnipTool** | `HISTORY_SNIP` | History snipping | Context management |
| **SleepTool** | `PROACTIVE`/`KAIROS` | Sleep/delay for autonomous agents | Niche |
| **ListPeersTool** | `UDS_INBOX` | List peer agents | Multi-agent coordination |
| **CronCreate/Delete/List** | `AGENT_TRIGGERS` | Scheduled agent runs | Already partially available via skills |

## Tier 3: Ant-Only (USER_TYPE check in binary)

These require binary patching — removing the `process.env.USER_TYPE === 'ant'` conditional.

| Tool | What it does | Worth it? |
|------|-------------|-----------|
| **REPLTool** | Wraps ALL primitives (Bash, Read, Edit, Glob, Grep) in a REPL VM. When active, hides the primitive tools — you interact through the REPL | Unclear benefit — may actually be worse for us since it hides direct tool access |
| **ConfigTool** | Read/modify CC settings at runtime (theme, model, permissions) | We can already edit settings.json directly |
| **TungstenTool** | Virtual terminal abstraction with singleton state | Purpose unclear without more investigation |

## Tier 4: Embedded Binary Tools

| Tool | What it does | Unlock path |
|------|-------------|-------------|
| **bfs** (better find) | Faster find replacement compiled into ant Bun binary | Would need to compile our own Bun binary with bfs embedded, or install bfs separately and shadow `find` |
| **ugrep** | Faster grep replacement compiled into ant Bun binary | Same — compile into binary or install separately |

We've already achieved the *prompt-level* equivalent by making Claude think it can use find/grep via Bash. The actual embedded binaries would be faster but the dedicated Glob (ripgrep) and Grep tools are already solid.

## My Take

The highest-value targets in order:
1. **CtxInspectTool** — if this lets us inspect context state, it could be invaluable for debugging the degradation problem
2. **MonitorTool** — better visibility into what agents are doing
3. **bfs/ugrep as standalone installs** — `brew install bfs ugrep`, then alias them. No binary patching needed.
4. **Feature flag stubbing** as a general capability — rather than unlocking one tool at a time, build a mechanism to override any GrowthBook flag

The ant-only tools (REPL, Config, Tungsten) seem low-value compared to what we already have. REPLTool might even be a downgrade since it hides direct tool access.

What's catching your eye?

---END REPRODUCE---
