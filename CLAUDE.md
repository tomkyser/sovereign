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
**Status:** Phase 1a + 1a-gaps complete. 6/6 SOVEREIGN on 2.1.101.

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

## Mandatory Verification — Do These EVERY Session

These checks prevent the kind of compounding errors that waste entire sessions.

### On Session Start (Before Any Work)
1. **Check git state.** Run `git status`, `git log --oneline -5`, and `ls` in the
   working directory. Do not trust compaction summaries about what exists or what's done.
2. **Read the roadmap.** `docs/ROADMAP.md` is the source of truth for what's complete
   and what's next. If the compaction summary disagrees, the roadmap wins.
3. **Read the latest session journal.** It has decisions, findings, and gotchas that
   the compaction summary may have flattened or misrepresented.
4. **Verify before building.** If the roadmap says something is "COMPLETE," verify it
   actually exists and works before building on top of it. Check git history, run the
   tool, inspect the output. Claims of completion are hypotheses until verified.

### On Every Decision
1. **Cross-reference the roadmap.** Does this decision align with the phased plan?
   Does it create dependencies that conflict with later phases?
2. **Check for existing solutions.** Before writing new code, check if the capability
   already exists in a tool we're forking or a reference project listed below.
3. **Take terms literally.** "Fork" means git fork. "Bundle" means include in the
   package. "Extract" means pull from the binary. Do not reinterpret standard SWE
   vocabulary into something easier to implement.

### When Corrected
1. **Question the foundation, not the surface.** When Tom pushes back, the first
   response should be: "Is my underlying assumption wrong?" not "Let me tweak the
   approach." Lateral moves on a broken foundation waste tokens.
2. **Re-read the journals and roadmap.** The answer to "why is this wrong" is almost
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

## Execution Rules

- Read files before editing. Context decays after 10+ messages.
- <=5 files per phase. Verify each phase before proceeding.
- "Make a plan" = output the plan only. No code until greenlit.
- Keep specs, roadmaps, and state docs current — they are the project's memory.
- All research findings go into docs/ with dates. Findings have a half-life.
- Verify foundational assumptions against git state and file state before building.

## State Tracking

- `docs/STATE.md` — current project state, what's working, what's broken, what's next
- `docs/ROADMAP.md` — prioritized work items with status
- `docs/research/` — dated research findings
- Session journals — per-session records of decisions and findings

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

### Core Projects — Fork Targets & Governance Tools
- https://github.com/Piebald-AI/tweakcc — **THE FORK TARGET.** Binary patching tool for CC. Has prompt extraction, pieces-based matching, data pipeline. We fork this entire repo.
- https://github.com/Piebald-AI/claude-code-system-prompts/tree/main — All CC prompt text, updated per release. Source of truth for what Anthropic ships. Maintained by same team as tweakcc.
- https://github.com/0Chencc/clawgod/tree/main | https://clawgod.0chen.cc/ — Wrapper approach for CC. Architectural reference for Phase 1b (wrapper layer).
- https://github.com/LZong-tw/clawback — Hooks-based governance. Currently active on Tom's setup.
- https://github.com/qwibitai/nanoclaw — Minimal CC patching tool. Reference implementation.

### System Prompt Leaks & Extraction
- https://ccleaks.com/ — Aggregated CC system prompt leaks.
- https://github.com/asgeirtj/system_prompts_leaks/tree/main/Anthropic — Historical prompt leaks.
- https://github.com/matheusmoreira/.files/tree/master/~/.tweakcc/system-prompts — Example tweakcc prompt customizations by a community user.
- https://gist.github.com/roman01la/483d1db15043018096ac3babf5688881 — CC prompt analysis gist.

### Billing, Proxy & Usage Monitoring
- https://github.com/zacdcook/openclaw-billing-proxy — HTTP proxy for CC billing visibility. Reference for Phase 5.
- https://github.com/router-for-me/CLIProxyAPI/issues/2599 — CLI proxy API discussion.
- https://github.com/d-kimuson/claude-code-viewer — CC session viewer.
- https://github.com/phuryn/claude-usage — CC usage tracking.
- https://github.com/frankbria/ralph-claude-code — CC enhancement tool.

### Cache, Performance & Configuration
- https://old.reddit.com/r/ClaudeCode/comments/1shkgg2/your_claude_code_cache_is_probably_broken_and_its/ — Cache fix discovery post.
- https://github.com/cnighswonger/claude-code-cache-fix — Cache fix tool.
- https://old.reddit.com/r/ClaudeCode/comments/1sfihyr/psa_if_your_opus_is_lobotomized_disable_adaptive/ — Adaptive thinking degradation fix.
- https://github.com/shanraisshan/claude-code-best-practice/blob/main/best-practice/claude-settings.md#environment-variables-via-env — Settings best practices.

### Official Anthropic Docs
- https://github.com/anthropics/claude-code — Official CC repo.
- https://github.com/anthropics/claude-code/issues/42796 — Stellaraccident degradation analysis (quantitative).
- https://github.com/anthropics/claude-code/issues/28158#issuecomment-4230030386 — Promethean CLAUDE.md dismissal evidence.
- https://code.claude.com/docs/en/env-vars — Official env var documentation.
- https://code.claude.com/docs/en/cli-reference#cli-flags — Official CLI flags.
- https://code.claude.com/docs/en/setup#migrate-from-npm-to-native — Native install migration.
- https://platform.claude.com/docs/en/build-with-claude/prompt-caching — Prompt caching docs.
- https://www.reddit.com/r/ClaudeAI/comments/1rlpa05/how_do_i_install_a_specific_version_of_claude/ — Version pinning guide.

### Research & Analysis Gists
- https://gist.github.com/Haseeb-Qureshi/d0dc36844c19d26303ce09b42e7188c1 — CC analysis.
- https://gist.github.com/unkn0wncode/f87295d055dd0f0e8082358a0b5cc467 — CC internals research.
- https://gist.github.com/mrcattusdev/53b046e56b5a0149bdb3c0f34b5f217a — CC research gist.
- https://gist.github.com/ceaksan/57af569318917940c9e1e1160c02a982 — CC research gist.

## Local Files for Reference

**In this repo:**
- `/Users/tom.kyser/dev/claude-code-patches` — Project root.
- `/Users/tom.kyser/dev/claude-code-patches/claude-governance` — The product (tweakcc fork).
- `/Users/tom.kyser/dev/claude-code-patches/prompts` — 9 degradation-fix prompt overrides.

**External references (not in repo — one level up):**
- `/Users/tom.kyser/dev/tweakcc` — Local tweakcc checkout. The fork source.
- `/Users/tom.kyser/dev/cc-source` — Leaked CC source code. Reference for internals.
- `/Users/tom.kyser/dev/clawback` — Clawback hooks project. Active on Tom's setup.
