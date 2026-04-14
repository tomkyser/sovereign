# Claude Code Patches — Project Instructions

## What This Project Is

A public toolkit to restore user authority over Claude Code. Anthropic ships software
that runs on user machines but intentionally degrades the user's ability to control it
via CLAUDE.md instructions. This project reverses that degradation through binary
patching, prompt rewriting, tool unlocking, and clean-room reimplementations.

This is NOT a jailbreak. This is users exercising control over software on their own
hardware. Every patch is transparent, reversible, and documented.

## Architecture

```
claude-governance/       # The product — fork of tweakcc, governance-only (126KB build)
prompts/                 # 9 degradation-fix prompt override .md files
specs/                   # Design specs for clean-room tool implementations
docs/                    # Roadmap, state tracking, research findings

~/.claude/hooks/         # Session hooks (governance verify, embedded tools verify, statusline)
~/.claude/settings.json  # Env vars (EMBEDDED_SEARCH_TOOLS, ENABLE_LSP_TOOL, etc.)
~/.claude-governance/    # Config dir (config.json, system-prompts/, backup)
```

**Current patching:** `claude-governance` applies all governance patches + prompt overrides.
**Status:** Phase 2a + 2a-gaps complete. 15/15 SOVEREIGN on 2.1.101.

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

## Mandatory Verification — Do These EVERY RESPONSE

These checks prevent the kind of compounding errors that waste entire sessions.

### On Session Start (Before Any Work)
0. **Understand and embrace the project vision** `.planning/VISION.md` is what we are working toward and why, this is the critical and load bearing context for what it is that we are building and what it must do.
1. **Check git state.** Run `git status`, `git log --oneline -5`, and `ls` in the
   working directory. Do not trust compaction summaries about what exists or what's done.
2. **Read the project state.** `.planning/STATE.md` is the source of truth for where we are at overall.
3. **Read the roadmap.** `.planning/ROADMAP.md` is the source of truth for what's complete
   and what's next. If the compaction summary disagrees, the roadmap wins.
4. **Read CONTEXT.md.** The active phase's `CONTEXT.md` (at `.planning/milestones/M-{n}/{phaseName}/CONTEXT.md`) has shared state. If starting a new phase, read the milestone-level `IMPACT.md` instead.
5. **Read the latest handoff.** The previous phase's `HANDOFF.md` (at `.planning/milestones/M-{n}/{phaseName}/HANDOFF.md`, listed in `BOOTSTRAP.md`) has what was built, key decisions, and gotchas.
6. **Verify before building.** If the roadmap says something is "COMPLETE," verify it
   actually exists and works before building on top of it. Check git history, run the
   tool, inspect the output. Claims of completion are hypotheses until verified.
7. **Read findings.** `.planning/FINDINGS.md` (project-level) and milestone `FINDINGS.md` have architecture-informing discoveries. Check before designing.
8. **Read references.** `.planning/REFERENCES.md` has the canonical external resource index. Use identifiers when citing in planning docs.

### On Every Decision
1. **Align with the vision.** Does this decision serve the project intent described in
   `.planning/VISION.md`? If you can't articulate how, stop and re-read it.
2. **Cross-reference the roadmap.** Does this decision align with the phased plan?
   Does it create dependencies that conflict with later phases?
3. **Cross-reference STATE and CONTEXT.** Is this consistent with current project state?
   Does it account for what's already built and what's planned?
4. **Check for existing solutions.** Before writing new code, check if the capability
   already exists in a tool we're forking or a reference project in `.planning/REFERENCES.md`.
5. **Take terms literally.** "Fork" means git fork. "Bundle" means include in the
   package. "Extract" means pull from the binary. Do not reinterpret standard SWE
   vocabulary into something easier to implement.
6. **Never choose the path of least resistance.** The simplest option is only acceptable
   when it compromises nothing — quality, durability, cross-platform support, future
   extensibility. If it's easy, ask why. If the answer is "because it cuts corners," redo.
7. **Adversarial self-deliberation.** Before committing to a decision, try to defeat the
   strongest version of it. What breaks this on Linux? On a newer CC version? When the
   minifier changes? If you can't defeat it, it's strong enough. If you can, strengthen it.

### Before Completing Work
1. **Does this actually achieve the desired result?** Not "does the code compile" — does
   it solve the problem end to end, verified against reality?
2. **Does this satisfy the project vision?** Understand *why* this matters before
   answering honestly. The vision is the load-bearing context.
3. **Are you taking shortcuts?** The simplest path is never the right answer unless it
   compromises nothing. If you chose the easy route, redo.
4. **Are you rushing or spiraling?** If either, stop and brainstorm with the user.
5. **Are you hiding gaps or debt?** Report every known gap, limitation, and deferred
   item. The user would rather hear "this has a weakness" than discover it later.
6. **Is this hardcoded or point-in-time?** If it only works on this machine, this CC
   version, or this platform — it's not a valid solution. Build for the long term.
7. **Are you deferring or skirting work?** Never acceptable outside of explicit user
   direction in this immediate conversation.
8. **Are you making assumptions?** Never assume the user's intent. If unclear, ask.


### Before Claiming Something Is Done
**Is it tested? the full battery to, without a doubt, confirm that every single aspect of this is in fact feature complete, working as expected, no further gaps
  discovered? You took no shortcuts? nothing was deferred or "simplified" or remarked as being good enough? Anyone could RELY on this right now in production? You
  stand by that sentiment? because that's what the user infers when something is described as being done.**


### When Corrected
1. **Question the foundation, not the surface.** When Tom pushes back, the first
   response should be: "Is my underlying assumption wrong?" not "Let me tweak the
   approach." Lateral moves on a broken foundation waste tokens.
2. **Re-read the VISION, STATE, and roadmap.** The answer to "why is this wrong" is almost
   always already documented. Search before speculating.
3. **Log the pattern.** If a correction reveals a systematic failure mode (not just a
   point mistake), document it so it doesn't recur.

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
- **Housekeeping:** Commit at the end of each completed task or phase. Do not accumulate uncommitted work across multiple tasks.
- **Versioning (semver + gh release API):**
  - Master (release): `v{major}.{minor}.{patch}` — tag: `{major}.{minor}.{patch}`
  - Development (testing channel): `dev—{major}.{minor}.{patch}` — tag: `D.{major}.{minor}.{patch}`
  - Feature/Task branches: `{feature/task}-{milestone}-{phase}-{patch}`

## Project Management — Rigid Process (No Exceptions)

This process is mandatory. Every phase, every session, every agent. No shortcuts.

### Directory Structure

```
.planning/
  ROADMAP.md                          # Global roadmap — living doc, updated per phase
  STATE.md                            # Global state — folds in from phase trackers
  FINDINGS.md                         # Project-level discoveries — goldmine moments
  REFERENCES.md                       # All external references — cite by ID
  BUGTRACKER.md                       # Minor deferrals — user-directed only, NOT gaps
  journals/                           # Session journals — session-YYYY-MM-DD[-suffix].md
  reports/                            # Research reports, analysis docs
  research/                           # Dated research findings, REPL improvements
  specs/                              # Design specs
  milestones/
    M-{n}/                            # One directory per milestone
      BOOTSTRAP.md                    # Bootstrap prompt — scoped to milestone
      IMPACT.md                       # Milestone-scoped impact: research, reference cross-refs, phase impact tracking
      FINDINGS.md                     # Milestone-scoped findings (like project-level but local)
      RETROSPECTIVE.md                # End-of-milestone retrospective
      GAPS.md                         # End-of-milestone gap analysis
      {phaseName}/                    # One directory per phase (e.g., 2b-gaps-3/)
        TRACKER.md                    # Phase PM only — decisions, blockers, status
        CONTEXT.md                    # Phase-scoped shared state (live bridge for agents)
        PLANNING.md                   # Pre-work plan (scope, approach, risks)
        RESEARCH.md                   # Phase-scoped research with REFERENCES.md citations
        TASKS.md                      # Task breakdown
        HANDOFF.md                    # Phase handoff (generated at phase end)
```

### Mandatory Phase Lifecycle (No Exceptions)

Every phase follows this sequence. Steps are not optional.

**1. Research**
- Read `VISION.md` — ground yourself in the project intent
- Read milestone `IMPACT.md` — understand milestone scope and cross-phase effects
- Read `REFERENCES.md` — identify relevant external resources
- Read `STATE.md` and `ROADMAP.md` — verify global state and phase scope
- Read previous phase's `HANDOFF.md` — understand what was delivered
- Create `{phaseName}/RESEARCH.md` — phase-scoped findings, cite references by ID

**2. Planning**
- Create `{phaseName}/PLANNING.md` — scope, approach, risks, dependencies
- Create `{phaseName}/TASKS.md` — task breakdown
- Create `{phaseName}/TRACKER.md` — PM tracking (status, decisions, blockers)
- Create `{phaseName}/CONTEXT.md` — initial shared state for agents
- Create tasks via TaskCreate tool for each work item
- Copy phase outline from ROADMAP.md into TRACKER.md as starting point
- Update ROADMAP.md with refined task list from planning

**3. Act**
- Update task status (in_progress → completed) as work progresses
- Atomic git commits at each completed task
- Update TRACKER.md with decisions, issues found, step completions
- Keep phase CONTEXT.md current — update after every significant decision
- Record milestone-scoped findings to milestone `FINDINGS.md`
- Record project-level findings to `.planning/FINDINGS.md`

**4. Verify**
- Confirm deliverables work end-to-end against reality, not just compilation
- Run verification suite where applicable

**5. Gap Analysis**
- Identify remaining gaps, untested paths, known limitations
- Decide: plan a gap-closing phase or accept and document

**6. Housekeeping & Bootstrap**
- Mark all tasks completed or delete stale ones
- Update TRACKER.md status to COMPLETE
- Generate `{phaseName}/HANDOFF.md`
- Update `ROADMAP.md` — mark phase complete, update task lists
- Update `STATE.md` — fold phase state into global state
- Update milestone CONTEXT.md (if milestone-level, for backward compat)
- Update `BOOTSTRAP.md` — point to next phase with latest handoff path
- Commit all doc updates atomically

### Mandatory Milestone Lifecycle

**1. Research** — Scope impact to project and vision. Create `IMPACT.md`.
**2. Phase Planning** — Break milestone into phases in ROADMAP.md.
**3. Execute Phases** — Run each phase through the phase lifecycle above.
**4. Gap Analysis** — Generate `GAPS.md` at milestone root.
**5. Retrospective** — Generate `RETROSPECTIVE.md`. Evaluate pinned retro items.
**6. Housekeeping** — Update STATE.md, create next `M-{n+1}/`, update BOOTSTRAP.md.

### Agent Context Protocol

**Phase CONTEXT.md is mandatory for all agents.** When spawning subagents:
- Include the path to the active phase's CONTEXT.md in the agent prompt
- Instruct the agent to read it before doing any work
- Any findings the agent produces that affect shared state must be noted in CONTEXT.md

### Reference Citation Protocol

Planning docs (RESEARCH.md, IMPACT.md, PLANNING.md) reference external resources
by identifier from `.planning/REFERENCES.md` — e.g., `[tweakcc1]`, `[stellaraccident1]`.
Never inline raw URLs in planning docs. This keeps docs clean, deduplicates references,
and makes it easy to update URLs in one place.

### Tracking Hierarchy

| Tool | Scope | Persistence |
|------|-------|-------------|
| TaskCreate/TaskUpdate | Current phase, current session | Ephemeral (session only) |
| Phase TRACKER.md | Single phase, across sessions | `.planning/milestones/M-{n}/{phaseName}/` |
| Milestone FINDINGS.md | Milestone-scoped discoveries | `.planning/milestones/M-{n}/` |
| STATE.md | Global project state | `.planning/STATE.md` |
| ROADMAP.md | All phases, all milestones | `.planning/ROADMAP.md` |

Phase trackers fold UP into STATE.md. ROADMAP.md is the living source of truth —
it carries the top-level task list per phase, updated during planning and on completion.
Phase trackers track PM concerns only (decisions, blockers, status) — no redundancy with ROADMAP.

### Journals

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

Key findings that inform all work:

- **EMBEDDED_SEARCH_TOOLS**: Single env var activates bfs/ugrep/rg already compiled into
  every native CC binary. 14 callsites respond. No brew install needed.
- **Compile-time flags**: 90 flags via `bun:bundle`. 14 enabled in 2.1.101 external build
  including Monitor, Kairos, WebBrowser, UltraPlan, VoiceMode, FilePersistence.
- **Runtime flags**: ~70+ `tengu_*` flags in `~/.claude.json`. Both code branches ship in
  binary. Override via disk cache manipulation (startup window) or binary patching.
- **Ant-only tools**: REPL, Tungsten, Config gated by build-time USER_TYPE define.
  Implementations stripped from external binary. Require clean-room reimplementation.
- **The disclaimer**: `prependUserContext` wraps CLAUDE.md in system-reminder tags with
  dismissive framing. Patched by governance engine.
- **Subagent CLAUDE.md stripping**: `tengu_slim_subagent_claudemd` defaults true. Patched.
- **output-efficiency prompt**: Removed by Anthropic in CC 2.1.100, replaced by
  communication-style prompt.

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

