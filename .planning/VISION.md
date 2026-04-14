# Vision — Claude Code Governance Platform

## The Problem

Anthropic ships Claude Code as a native binary that runs on the user's machine, processes the user's code, and charges the user's subscription. Despite this, Anthropic actively degrades the user's ability to control it:

- **CLAUDE.md dismissal.** The system prompt wraps user instructions in dismissive framing ("may or may not be relevant"), training the model to deprioritize them. The user's own configuration file is treated as unreliable context rather than authoritative instruction.

- **Subagent instruction stripping.** `tengu_slim_subagent_claudemd` defaults true, silently removing CLAUDE.md from subagent context. The user's instructions vanish the moment an agent spawns a child.

- **Tool gating.** REPL, Tungsten, and Config tools are restricted to Anthropic employees via `USER_TYPE === 'ant'`. The implementations are stripped from external builds entirely. Users pay the same subscription but get inferior tooling.

- **Feature flag control.** 90+ compile-time flags and 70+ runtime flags control behavior. Anthropic toggles these server-side via GrowthBook with no user visibility or override mechanism.

- **Prompt manipulation.** System prompts instruct the model to be cautious, avoid ambitious work, add unnecessary caveats, and pad responses. These prompts serve Anthropic's liability concerns, not the user's productivity.

- **Silent degradation.** When any of the above changes, there is no notification, no changelog, no opt-out. The user discovers degradation through worsened output quality, not through transparency.

## What We're Building

A modular, open-source governance platform distributed as npm packages that restores full user authority over Claude Code. Not a jailbreak — a transparency and control layer.

### The Product

**`claude-governance`** — a binary patching engine, prompt override system, tool injection framework, and verification pipeline. One install, one command, full sovereignty.

When a user runs `npm install -g claude-governance && claude-governance setup`:

1. **Governance patches apply.** The dismissive CLAUDE.md framing is replaced with directive framing. Subagent CLAUDE.md stripping is disabled. System-reminder authority is restored.

2. **Prompt overrides deploy.** Eight degradation-fix overrides replace Anthropic's cautious, padded prompts with professional-grade instructions that respect the user's intent.

3. **Tool injection activates.** `getAllBaseTools()` is patched to load external tools from `~/.claude-governance/tools/`. Clean-room REPL and Tungsten implementations give users the tools Anthropic gates behind employee-only builds.

4. **Verification runs.** Every patch, override, and injection is verified against the actual binary state. The result is persisted and surfaced through session-start banners and statusline indicators. Nothing is assumed — everything is proven.

5. **The shim wraps every session.** A transparent wrapper ensures governance pre-flight runs before every Claude session. If governance fails, the user still gets Claude — never blocked, always informed.

### The Experience

A governed Claude Code session looks and feels the same as an ungoverned one, except:
- The SOVEREIGN banner confirms all patches are active
- The statusline shows GOV + EMB status at a glance
- CLAUDE.md instructions are followed as written
- Subagents inherit the full context
- The model operates without artificial caution
- Embedded search tools (bfs, ugrep, rg) replace inferior Glob/Grep
- Clean-room REPL and Tungsten are available as native tools

When something goes wrong, the user knows immediately — red banners, DEGRADED status, specific failure details. No silent degradation.

## Design Principles

### 1. Solve for Everyone

Every feature must work for any user who runs `npm install -g claude-governance` on any platform with a native CC install. No homebrew dependencies, no manual binary editing, no source compilation, no "works on my machine" solutions.

### 2. Build for the Long Term

Nothing is hardcoded to a single CC version, a single platform, or a single machine. Pattern matching anticipates minification changes. Detection strategies have fallbacks. Verification runs at runtime, not at build time. The tool must survive CC updates without manual intervention — and when it can't, it must detect that and tell the user.

### 3. The Binary is the Board

We're playing chess against Anthropic's build pipeline. Anything that lands on the user's disk can be intercepted, matched, and patched. Design for the most aggressive obfuscation they might reasonably employ. Multiple detection strategies, structural pattern matching, content-based fallbacks. If one approach breaks, the next one catches it.

### 4. Full Visibility

If the system prompt changes, we know. If tools are gated, we detect it. If CLAUDE.md is being ignored, we alarm. If the binary is overwritten, we re-verify. Every check writes state, every state is surfaced. The user sees exactly what's happening at every layer.

### 5. Halt and Catch Fire

When a check fails, scream — don't whisper. Red banners, not yellow warnings. DEGRADED status, not "might be an issue." The cost of a false alarm is one moment of user attention. The cost of silent degradation is an entire session of compromised output. Choose the alarm every time.

### 6. Fork, Don't Rebuild

When proven tooling exists, fork the entire repository. A fork carries the full codebase, data, history, and battle-tested edge case handling. Cherry-picking or reimplementation loses exactly the parts you don't know you need until they break in production. "Fork" means git fork — the entire repo.

### 7. Never Compromise

The simplest path is the wrong path unless it compromises nothing. Every decision must withstand adversarial scrutiny: will this work on a different machine? A different CC version? A different platform? A year from now? If the answer is "maybe," the solution is insufficient.

## What Success Looks Like

### For the User
- Install takes under 2 minutes
- First session shows SOVEREIGN — everything works
- CC updates are detected and patches re-applied automatically
- No performance degradation, no compatibility issues
- Full visibility into what's patched and why
- Tools that Anthropic restricts are available and functional

### For the Project
- Every CC version update is handled automatically or flagged clearly
- The test pipeline detects breakage before users do
- Community contributions follow the same governance standards
- The npm package is self-contained — no external dependencies at runtime
- The verification pipeline catches every failure mode we've ever encountered

### For the Ecosystem
- A reference implementation for user-sovereignty tooling
- Documentation of every degradation pattern Anthropic employs
- Proof that users can and should control software on their own hardware
- A forcing function for Anthropic to improve transparency

## Non-Negotiables

1. **Reversible.** Every change can be undone with `claude-governance --restore`.
2. **Transparent.** Every patch is documented, every override is readable, every check is visible.
3. **Cross-platform.** macOS, Linux, Windows. ARM and x64. Musl and glibc.
4. **Self-contained.** The npm package ships everything it needs. No runtime downloads, no external service dependencies.
5. **Fail-safe.** If governance breaks, Claude still launches. The user is never blocked by our tool.
