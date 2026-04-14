# Phase 2c-gaps-2 Research — Tungsten Adoption

## Scope

Three pillars to make Tungsten a first-class tool that Claude understands and uses correctly:
1. Instruction-level guidance injection into "Using your tools"
2. Hook enforcement at session start
3. Comprehensive tool prompt coverage in tungsten.js

## REPL Guidance Injection as Model (PATCH 8)

PATCH 8 (`writeReplToolGuidance` in governance.ts:898-960) is the reference implementation.

**How it works:**
- Targets mk5's `getUsingYourToolsSection` — the array of "Using your tools" instructions
- Detects the array closing pattern: `sequentially instead."].filter(($)=>$!==null);return["# Using your tools"`
- Injects a new string element before `"].filter(...)` — adding REPL as a peer-level recommendation
- Signature: `could one REPL call do this? REPL executes`
- Single detector, high confidence — the `return["# Using your tools"` suffix anchors uniquely

**Why "Using your tools" matters:**
The model's tool selection is dominated by this section. "Use Read instead of cat" etc. are in this array. Without explicit guidance here, the model reasons about a tool but still defaults to familiar patterns. PATCH 8 proved this — REPL adoption jumped after injection.

**Key patterns to replicate for Tungsten (PATCH 11):**
- Same detection target (array closing before `"].filter(...)`)
- New string element injected alongside REPL's element
- Guidance text must be concise — single array element, ~2 sentences
- Signature must be unique and stable (not duplicated anywhere in binary)
- `freshCheck` available if needed (introduced in 2c-gaps-1) but likely unnecessary for injection

## Current tungsten.js prompt() Coverage

The tool prompt (tungsten.js:~290-370) covers:
- When to use Tungsten vs Bash (basic dichotomy)
- 6 actions: send, capture, create, list, kill, interrupt
- 3 patterns: dev server + tests, stateful environment setup, long build monitoring
- Notes: session isolation, cleanup, tmux environment inheritance (1 sentence), tmux install error

**What's missing:**
- **FS9 environment propagation** — the Bash tool inherits TMUX env via FS9 patch → bashProvider → `env.TMUX`. This means Bash commands run inside the governance tmux socket after Tungsten is used. REPL's `bash()` also inherits. Agents spawned from the session inherit via `process.env`. This is a major capability that the prompt doesn't explain.
- **Panel interaction** — when a Tungsten session exists, the TUI renders a panel showing session name, last command, and terminal content. No mention in prompt.
- **Any-language REPL pattern** — Tungsten enables persistent Python, psql, irb, node, etc. sessions. The prompt only shows shell commands.
- **Concurrent multi-session orchestration** — creating named sessions for parallel workstreams (server, tests, db, build) with patterns for monitoring all.
- **Agent tool interaction** — subagents inherit tmux env. Agents can use Tungsten sessions. No mention.
- **Anti-patterns** — don't use for one-shot commands (waste), don't forget to kill sessions, don't create excessive sessions, don't use capture without send first.
- **Inception pattern** — Tungsten session running tmux commands to manage nested sessions or connect to external tmux.

## Hook Enforcement Patterns

**governance-verify.cjs** (SessionStart hook):
- Reads `~/.claude-governance/state.json` (written by `check`/`apply`)
- Staleness check: >4h TTL triggers live `check` re-run
- Version-change detection: compares installed binary version vs state
- Banner to stderr (user sees): SOVEREIGN/DEGRADED with check counts
- Warning to stdout (Claude sees): injected only when not SOVEREIGN
- Shim fallback detection: reads+deletes marker file if governance tool crashed

**embedded-tools-verify.cjs** (SessionStart hook):
- 8 checks: binary resolution, env var, settings.json, 3 tool dispatches, binary symbols, gate function, registry exclusion
- State written to `~/.claude-governance/embedded-tools.json`
- Critical failure: halt-and-catch-fire banner + Claude context injection
- Partial: yellow banner with warning

**For Tungsten verification hook, check:**
1. tmux availability (`which tmux`)
2. tungsten.js deployed to `~/.claude-governance/data/tools/` (or governance tool dir)
3. Tool loader discovers it (via `__claude_governance_tools__` in binary)
4. FS9 patch presence (read governance state.json, check `tungsten-fs9` entry)
5. Panel patch presence (check `tungsten-panel` entry)
6. tungsten-state.json exists if session was active (cross-session awareness)

**Key difference from existing hooks:** Tungsten verification is partially covered by governance-verify.cjs already (tungsten-fs9 and tungsten-panel are in the VERIFICATION_REGISTRY). A dedicated hook would focus on tmux availability and tool deployment — the things governance-verify doesn't check.

## What Anthropic's Internal Tungsten Likely Covers

Based on ccleaks documentation [ccLeaks1] and cc-source analysis:
- Anthropic's internal Tungsten prompt covers all 6 actions with more verbose descriptions
- Includes the "persistent state model" explanation (env vars, working dir, processes survive)
- Includes `Monitor` tool integration (ant-only tool for streaming events)
- Includes cross-tool references (Bash inherits env, agents inherit env)
- Does NOT need to explain FS9 (their implementation is native, not patched)
- Does NOT need to explain panel (their panel is the DCE'd `TungstenLiveMonitor` component)

Our prompt needs to cover what theirs covers PLUS the governance-specific details (FS9 propagation, patched panel, clean-room implementation notes).

## References

- [ccLeaks1] — Aggregated CC system prompt leaks (Tungsten prompt fragments)
- [haseebAnalysis1] — Ant vs external prompt divergence (Tungsten ant-only)
- [ccSource] — Local CC source for bashProvider/FS9 analysis
