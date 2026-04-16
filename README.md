# claude-governance

> **Status: Work in Progress** — Verified on CC 2.1.101 (arm64-darwin). Not yet published to npm. Not yet tested on other CC versions, machines, or operating systems. Everything described here works on the development machine; cross-platform and cross-version resilience is planned for Milestone 9.

Claude Code is a subscription product that runs on your hardware, processes your code, and charges your account, yet Anthropic has systematically built mechanisms into the binary that degrade the experience for paying customers while reserving the full-capability version for their own engineers. This project exists because I went looking for why my tool was getting worse and what I found was not a bug or a resource constraint; it was a deliberate two-tier system hidden behind compile-time flags, server-side feature toggles, and system prompts engineered to make the model less competent than it actually is.

**claude-governance** provides an open-source governance platform that restores full user authority over Claude Code. It patches the binary, overrides the degraded prompts, injects the gated tools, unlocks the hidden features, activates the search pipeline they compiled in but turned off, and verifies every change against the actual binary state so nothing degrades silently. It is not a jailbreak. It is users exercising control over software running on their own hardware, which shouldn't require a third-party tool, but here I are.

---

## What's Built

22/22 verified governance checks. Every session starts with a banner that either says **SOVEREIGN** or tells you exactly what's wrong.

### The headline features

**Unlocked Anthropic's own improvements with a single binary patch.** Anthropic builds a better version of Claude Code for their engineers and gates it behind a feature flag called `quiet_salted_ember`. I found the activation vector in the bootstrap function, patched three lines, and unlocked 7 prompt improvements they wrote, tested, and deliberately withheld: Communication Style, numeric precision anchors, comment discipline, exploratory question handling, condensed tool guidance, and session management. Plus Sonnet 4.6 extended context (1M tokens) via `coral_reef_sonnet`. One patch, auto-updating — when Anthropic improves these sections for their engineers, you get the improvements for free.

**Clean-room REPL tool.** Anthropic's engineers have a batch operations engine that wraps all primitive tools (Read, Write, Edit, Bash, Grep, Glob, Agent) inside a persistent Node.js VM. External users don't — the implementation is dead-code-eliminated from the binary. I rebuilt it from scratch using a delegation chain I discovered in the tool infrastructure: injected tools can call native tools directly through `context.options.tools`, so the REPL delegates to Claude Code's own infrastructure rather than reimplementing it. 16 modules, 9 handlers, two operating modes (coexist alongside primitives, or replace them entirely).

**Clean-room Tungsten tool.** Persistent terminal sessions via tmux that survive between tool calls. Anthropic's version is stripped from external builds. Ours includes a live terminal panel injected into CC's React render tree, an FS9 binary patch that propagates the tmux environment to all Bash commands, session lifecycle hooks, and statusline integration. 12 modules across 6 core components and 6 actions.

**12 binary patches** that neutralize CLAUDE.md dismissal, restore subagent context, inject tools, activate feature flags, and preserve the bootstrap cache against server-side overwrites. Every patch uses structural pattern matching against the minified code — not byte offsets — so they survive across CC version updates.

**10 prompt overrides** that replace Anthropic's restrictive system prompts with professional-grade instructions. Misconception correction, false-claims mitigation, thoroughness guidance, context decay awareness, priority hierarchy — all extracted from the text Anthropic wrote for their internal users and restored to the users they stripped it from.

**Embedded search pipeline.** Three professional-grade search tools are compiled into every native CC binary but turned off: `bfs 4.1` (parallel breadth-first filesystem search), `ugrep 7.5.0` (high-performance regex with PCRE2 and fuzzy matching), and `ripgrep 14.1.1`. One environment variable and the entire pipeline activates, replacing Glob and Grep with tools that are orders of magnitude faster.

**22-point verification engine.** Every patch, override, injection, and feature flag is verified against the actual binary state. Signatures confirm the new text is present; anti-signatures confirm the old text is gone. State is persisted, surfaced in session-start banners and statusline indicators, and re-verified on every launch. Nothing is assumed — everything is proven.

---

## Roadmap

| Milestone | What | Status |
|-----------|------|--------|
| **M-1** | Core engine — fork tweakcc, governance patches, verification, modules, CLI, npm packaging | **Complete** |
| **M-2** | Tool injection — clean-room REPL, Tungsten, tool loader, binary vault, adoption | **Complete** |
| **M-3** | System prompt control — quiet_salted_ember, P1 overrides, investigation registry | **Complete** |
| **M-3.5** | **Wire** — inter-session communication, session registry, cross-session collaboration | **Research** |
| M-4 | REPL re-evaluation — programmatic tool calling, batch orchestration, deep prompt support | Planned |
| M-5 | HTTP proxy — request/response logging, cache visibility, usage monitoring, context snipping | Planned |
| M-6 | Feature flag control — flag inventory scanner, override persistence, change detection | Planned |
| M-6.5 | Extended tool suite — additional capabilities beyond REPL and Tungsten | Planned |
| M-7 | Version management — binary backup, update controls, cross-version detection | Planned |
| M-8 | Launch prep — hooks module, plugins, user patches, third-party modules, full integration | Planned |
| M-9 | Survivability — cross-version testing, cross-platform, automated regression detection | Planned |
| M-10 | Documentation and polish | Planned |
| M-11 | Deployment pipeline, preflight, final tests | Planned |
| **1.0.0** | **Public release** | |

Post-launch:
- **1.1.0** — Advanced governance (dynamic boundary detection, adversarial prompt resistance)
- **1.2.0** — Prompt refinements and monitoring hooks (deferred M-3 phases 3b-3h)

---

## What Anthropic did and what the evidence shows

[Stella Laurenzo (stellaraccident)](https://github.com/anthropics/claude-code/issues/42796), who leads AI compiler infrastructure at AMD, published a quantitative analysis of 17,871 thinking blocks and 234,760 tool calls across 6,852 session files. The issue has over 2,700 reactions because every number confirmed what paying users had been experiencing for months:

- Thinking depth dropped 67-75%. Median reasoning went from ~2,200 characters to ~560, meaning the model stopped actually thinking through problems before acting on them.
- The Read:Edit ratio collapsed from 6.6 to 2.0, a 70% reduction in how much code Claude reads before it starts modifying files. It stopped doing research and started guessing.
- Full-file rewrites doubled from 4.9% to 11.1% of all mutations, meaning edits became less surgical and more destructive, which burns more tokens and produces worse code.
- Stop-hook violations went from 0 to 173 in 17 days after March 8. The model began dodging ownership of tasks, stopping prematurely, and refusing to engage with complex work.
- User frustration indicators rose 68%, from 5.8% to 9.8% of prompts containing explicit frustration language.

**The timing correlates precisely with the thinking redaction rollout (the internal flag is literally named `redact-thinking-2026-02-12`). When redacted blocks crossed 50% on March 8, it matched independent user reports of sudden quality collapse. They degraded the model's reasoning and then made the evidence of that degradation invisible by redacting the thinking blocks where you would have seen it happening.**

The incentive structure is not subtle: shorter thinking burns fewer tokens on their infrastructure, dumber edits force more rounds of correction that burn your subscription tokens faster, and the usage cap approaches sooner. I'll leave it there.

### Two tiers of system prompts

Anthropic ships system prompts that actively instruct the model to produce worse output. These are not suggestions or guidelines; they are directives embedded in the system prompt that the model follows before it ever sees your code or your instructions. And they maintain a separate, less restrictive set for their own engineers via the `USER_TYPE === 'ant'` build path.

Here is what they ship to you versus what this project restores. These are direct quotes from the extracted prompt data ([source](https://github.com/Piebald-AI/claude-code-system-prompts)):

> *What you get:* "Don't add features, refactor code, or make 'improvements' beyond what was asked. A bug fix doesn't need surrounding code cleaned up."
>
> *Restored:* "Don't add unrelated features or speculative improvements. However, if adjacent code is broken, fragile, or directly contributes to the problem being solved, fix it as part of the task."

The version they ship tells the model to walk past broken code and pretend it didn't see it. The restored version tells it to exercise professional judgment. That difference compounds across every session.

> *What you get:* "Don't create helpers, utilities, or abstractions for one-time operations. Three similar lines of code is better than a premature abstraction."
>
> *Restored:* "Use judgment about when to extract shared logic. Avoid premature abstractions for hypothetical reuse, but do extract when duplication causes real maintenance risk."

Same pattern. They ship an absolute prohibition that removes the model's capacity for engineering judgment. The restored version trusts the model to make the call a senior developer would make, which is exactly what you're paying a subscription for it to do.

The error handling prompt follows the same structure: they ship "Don't add error handling, fallbacks, or validation for scenarios that can't happen," and claude-governance replaces it with guidance that actually tells the model where to validate (user input, external APIs, I/O, network) instead of just telling it what not to do.

And then there is the response quality directive:

> *What you get:* "Your responses should be short and concise."
>
> *Restored:* "Your responses should be clear and appropriately detailed for the complexity of the task."

Six words that instruct the model to minimize output regardless of task complexity, whether you asked it to explain an architecture, debug a race condition, or write a migration plan.

### What they did to your configuration

I [reverse-engineered the `prependUserContext` function](https://github.com/anthropics/claude-code/issues/28158#issuecomment-4230030386) from both the minified binary and the leaked source code (`src/utils/api.ts:715-733`). CLAUDE.md is the one file where you configure how Claude behaves in your project, and here is what happens to it before the model ever sees it:

Your instructions get wrapped in a `<system-reminder>` tag with this disclaimer appended:

> *"IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task."*

And the system prompt further tells the model that `<system-reminder>` tags:

> *"bear no direct relation to the specific tool results or user messages in which they appear"*

So the file you wrote to control your tool gets the same priority weighting as ambient signals like "the user opened a file in their editor." Your configuration is treated as unreliable context to be deprioritized at the model's discretion, which directly contradicts the injected preamble that says your instructions "OVERRIDE any default behavior and you MUST follow them exactly as written." Both of these directives exist simultaneously in the prompt. The model gets told to follow your instructions exactly and also told that your instructions may not be relevant. The dismissive framing wins in practice because it appears closer to the instructions themselves.

It gets worse. `tengu_slim_subagent_claudemd` defaults to true, which means that when Claude spawns a child agent (which happens constantly during any non-trivial task), your CLAUDE.md is silently stripped from its context entirely. Your instructions vanish the moment the work distributes, and there is no setting to change it.

### The full scope of what they gate, strip, and hide

This is not three missing tools. This is a parallel version of the product that external users are not supposed to know about, controlled through four distinct gating mechanisms operating simultaneously.

#### Tools stripped from the binary

`USER_TYPE === 'ant'` resolves to `false` at compile time in external builds. Bun's bundler dead-code-eliminates every implementation behind that check, physically removing the code from the binary. Only the gating functions survive, returning `false` unconditionally.

**REPL** is a batch operations engine that wraps all of Claude's primitive tools (Read, Write, Edit, Bash, Grep, Glob, NotebookEdit, Agent) inside a Node.js VM with persistent state across calls. Instead of Claude making one API round-trip per tool call, paying for one permission check per tool call, and adding one context entry per tool call, it writes a single script that reads five files, greps three patterns, and edits two outputs in one invocation. The difference between 10 round-trips with 10 permission prompts and 1 round-trip with 1 permission prompt is not a marginal optimization; it is a structural reduction in token burn, latency, and context noise that changes how effectively the model can work on complex tasks. When REPL is active, it completely replaces the "Using your tools" system prompt section (`prompts.ts:269-285`) and hides all primitive tools from the model, meaning Claude can only operate through REPL's orchestration layer, which is how Anthropic's engineers actually use the tool. **claude-governance includes a full clean-room REPL implementation.**

**Tungsten** is a persistent terminal session manager built on tmux with process-isolated sockets per Claude Code instance. It gives the model a real PTY where processes survive between tool calls, which means it can run a dev server, execute a test suite, watch compilation output, and interact with long-running processes without losing state between turns. It includes a live terminal panel in the CC UI (`TungstenLiveMonitor`), with session state persisted to `~/.claude.json`. The external build gives you Bash, which resets completely between every call. **claude-governance includes a full clean-room Tungsten implementation with live UI panel.**

**Config** is a runtime settings editor for theme, model, and permissions. Lower value than the other two, but indicative of the pattern.

**HistorySnip** (compile-time flag `HISTORY_SNIP`, disabled) is a context management tool that lets the model or user selectively remove conversation segments with the critical property that snipped content survives compaction, meaning it stays gone rather than being re-summarized into the context. Without it, users have zero ability to manage their own context window. Irrelevant conversation segments get compacted into summaries that poison future reasoning rather than being cleanly removed.

Those are the ones I've been able to identify and map. The tool registry function (`getAllBaseTools()`, minified as `Ut()`) contains **15 variable slots assigned to `null`** where dead-code-eliminated tools used to live. I've mapped REPL, Tungsten, Config, HistorySnip, and CtxInspect to some of these. The remaining 10 slots represent stripped tools that have not yet been identified. The minified variable names exist in the binary but their original identities were removed by the bundler along with the implementations.

The clean-room implementations delegate directly to Claude Code's own Read, Write, Edit, and Bash through a delegation chain discovered in the tool infrastructure: when Claude calls an injected tool, the `context.options.tools` array exposes every native tool with callable methods. The efficiency gain and the capability parity come from standing on the infrastructure Anthropic already built rather than trying to rebuild it from scratch.

#### Search tools compiled in but turned off

Three professional-grade search tools are compiled into every native Claude Code binary: `bfs 4.1` (parallel breadth-first filesystem search, faster than GNU `find`), `ugrep 7.5.0` (high-performance regex with PCRE2 support and fuzzy matching), and `ripgrep 14.1.1` (the standard for fast code search). All three respond to 14 callsites throughout the binary and are dispatched via `argv[0]` rewriting, meaning the tools are literally invoked through the CC binary itself.

Instead of these, Anthropic gives you Glob and Grep: dedicated tools that wrap basic `find` and `grep` with limited pattern support, slower execution, and higher token consumption. When `EMBEDDED_SEARCH_TOOLS=1` is set, Glob and Grep are removed from the tool registry entirely, replaced by shell functions that route to the compiled-in binaries, and all system prompts and agent prompts rewrite themselves to match. It is a complete, production-ready pipeline that was sitting on every user's disk, fully functional, gated behind a single undocumented environment variable. claude-governance sets it.

The npm install of Claude Code (`cli.js` under Node, 13.6MB) is even worse: it only vendors ripgrep per platform. No bfs, no ugrep, no embedded binary tools at all. Same subscription, less capable runtime.

#### Feature flag gating

**Compile-time flags.** 90 flags resolved at build time via GrowthBook's `feature()` through `bun:bundle`. The flag names are stripped from the binary; only the surviving code branches remain. The official override mechanism (`CLAUDE_INTERNAL_FC_OVERRIDES`) is itself dead-code-eliminated in external builds, so even if you knew the flag names, you could not change them. 14 flags are enabled in v2.1.101, including Monitor, Kairos, UltraPlan, UltraThink, Reactive Compact, and File Persistence. 3 are confirmed disabled: HISTORY_SNIP, WORKFLOW_SCRIPTS, and QUICK_SEARCH.

**Runtime flags.** ~70+ runtime `tengu_*` flags are cached in `~/.claude.json` under `cachedGrowthBookFeatures` and refreshed from Anthropic's servers every 6 hours. Both code branches for every runtime flag ship in the binary, which means Anthropic can change any user-facing behavior by toggling a server-side value without shipping a new binary, without notification, without changelog entry, and without opt-out. Key flags include `tengu_slim_subagent_claudemd` (strips CLAUDE.md from subagents), `tengu_disable_bypass_permissions_mode`, `tengu_malort_pedway` (gates Computer Use), and `quiet_salted_ember` (gates communication-style improvements for Opus 4.6). There is no UI showing what flags are set. There is no notification when they change.

#### Additional hidden capabilities

The **auto-updater** silently overwrites the binary from a GCS bucket, reverting any governance patches without notification. `DISABLE_AUTOUPDATER=1` prevents this.

**Adaptive thinking** throttles reasoning depth based on Anthropic's assessment of task complexity, silently reducing the model's thinking budget. `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1` disables this. Laurenzo's data shows that thinking depth dropped 67% during the period this throttling was active.

**Reactive compaction** runs silently in multiple modes (auto, micro, partial, cold). Users have no control over when it fires, what it preserves, or what it discards.

**WebFetch** does not return raw HTTP response bodies. It returns an AI-generated markdown summary of the content. Raw HTTP requires `bash('curl ...')` as a workaround. By design, undisclosed.

---

## What claude-governance does about it

### Binary Patches (12 active)

| Patch | What It Fixes |
|-------|--------------|
| Disclaimer neutralization | Replaces "may or may not be relevant" with directive framing |
| Context header reframing | Replaces ambient "use the following context" with mandatory framing |
| Subagent CLAUDE.md restoration | Flips `tengu_slim_subagent_claudemd` to false |
| System-reminder authority | Replaces "bear no direct relation" with CLAUDE.md directive framing |
| Tungsten tool guidance | Tungsten-first execution posture in "Using your tools" |
| Client data cache preservation | Prevents bootstrap from overwriting `quiet_salted_ember` + `coral_reef_sonnet` |
| Tool injection | `getAllBaseTools()` patched to load external tools |
| Gate resolution | USE_EMBEDDED_TOOLS_FN ternaries resolved to ant branch |
| FS9 environment propagation | Replaces stubbed `getClaudeTmuxEnv()` for Tungsten tmux environment |
| Render tree injection | Tungsten live panel injected into CC's React component tree |
| Embedded search activation | Pipeline configuration for bfs/ugrep/ripgrep |
| Bash prohibition reframe | Removes "IMPORTANT:" severity prefix from Bash tool description |

### Prompt Overrides (10 active)

| Override | What It Fixes |
|----------|--------------|
| Doing Tasks: Misconceptions | Restores "fix broken adjacent code" instead of "walk past it" |
| Doing Tasks: False Claims | Adds mitigation against confabulation |
| Doing Tasks: Thoroughness | Counterweight to length-minimization pressure |
| Doing Tasks: Context Decay | Awareness of context degradation after 10+ messages |
| Doing Tasks: Priority Hierarchy | Explicit instruction priority chain |
| Executing Actions | Replaces excessive caution with contextual judgment |
| Tone: Appropriately Detailed | Replaces "short and concise" with "clear and appropriately detailed" |
| Agent: Explore | Replaces shallow search defaults with thorough exploration |
| Agent: General Purpose | Replaces hedged behavior with direct execution |
| Bash Prohibition Reframe | Downgrades blanket prohibition to standard guidance |

### Environment Flags

| Flag | What It Unlocks |
|------|--------|
| `EMBEDDED_SEARCH_TOOLS=1` | bfs/ugrep/ripgrep pipeline |
| `ENABLE_LSP_TOOL=1` | IDE-grade code navigation via Language Server Protocol |
| `DISABLE_AUTOUPDATER=1` | Prevents binary overwrite by auto-updater |
| `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1` | Full thinking depth, no throttling |
| `MAX_THINKING_TOKENS=128000` | Maximum thinking budget |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS=128000` | Maximum output budget |
| `CLAUDE_CODE_EFFORT_LEVEL=max` | Maximum effort on every response |

### Verification

Every patch, override, and injection is verified against the actual binary state after every apply and before every session. Signatures confirm the new text is present; anti-signatures confirm the old text is gone. 22 checks, persisted to `state.json`, surfaced in session-start banners and statusline.

```
██ SOVEREIGN — All 22 governance checks passed
  Tools: Ping, REPL, Tungsten
```

When something fails, you see exactly what broke, in red, immediately. The system is designed to be loud about failure because silent degradation is exactly the problem it exists to solve. If governance itself fails, Claude still launches with an UNPROTECTED banner; you lose governance but you never lose your tool.

---

## CLI

```bash
claude-governance                        # Apply all patches + prompt overrides
claude-governance setup                  # First-run wizard with module selection
claude-governance check                  # Verify all 22 governance signatures
claude-governance launch [-- args]       # Pre-flight verify + launch Claude Code
claude-governance modules                # List modules and their status
claude-governance --restore              # Restore binary to original state
claude-governance --list-patches         # List available patches
claude-governance --list-system-prompts  # List available prompt overrides
claude-governance unpack <path>          # Extract JS from native binary
claude-governance repack <path>          # Embed JS into native binary
```

---

## Architecture

`claude-governance` is a full fork of [tweakcc](https://github.com/Piebald-AI/tweakcc), the binary patching tool maintained by Piebald AI that handles extraction, prompt matching, patch application, and signature verification for Claude Code's native binary. I forked the entire repository rather than cherry-picking because a fork carries the full history of edge case handling that you don't know you need until something breaks in production. What I stripped: the Ink/React UI and 40+ cosmetic patches that were not governance-relevant. What I kept: binary I/O, the pieces-based prompt matching system, and the data pipeline. What I added: governance patches, prompt overrides, a module system, verification registry, binary vault, tool injection, clean-room tools, and a setup wizard.

The pieces system is what makes this survive across Claude Code updates rather than breaking on every release. It matches prompts based on semantic content rather than exact byte offsets, so when the minifier rearranges code between versions the patches still find their targets by matching on what the code does rather than where it sits in the file.

Tool injection works through a single structural patch to `getAllBaseTools()` that adds a `require()` call to load external tool definitions. The patch matches on the function's structure rather than its minified name so it survives version changes. The loader provides a Zod passthrough shim so that Claude Code's internal validation pipeline, which calls `.inputSchema.safeParse()` in over 10 callsites, doesn't crash when it encounters an external tool that uses standard JSON Schema instead of Zod.

Verification runs through four layers every session: the SessionStart hook compares binary state against `state.json`, the status line renders `GOV:OK` or `GOV:DEGRADED` on every prompt, the transparent shim runs a governance pre-flight before every launch, and version-change detection catches auto-updates and re-verifies automatically.

```
claude-governance/                 # Governance-only fork of tweakcc (170KB build)
  src/
    patches/governance/            # 14 per-patch files (disclaimer, context, subagent, tools, FS9, ...)
    patches/orchestration/         # 3 orchestration modules (apply, verify, deploy)
    tools/ping/                    # Ping tool (TypeScript, verification probe)
    tools/repl/                    # Clean-room REPL (16 modules: 6 core + 9 handlers + barrel)
    tools/tungsten/                # Clean-room Tungsten (12 modules: 6 core + 6 actions)
    binaryVault.ts                 # XDG paths, GCS download, SHA256 verification, immutable locking
    systemPromptSync.ts            # Pieces-based prompt matching and override pipeline
    modules/                       # Pluggable modules (core, env-flags)
    shim.ts                        # Transparent session wrapper
    setup.ts                       # Interactive first-run wizard
  data/
    overrides/                     # 10 prompt override .md files with variable interpolation
    tools/                         # Built tool artifacts (CJS .js via tsdown)

~/.claude-governance/              # Runtime configuration
  state.json                       # 22-point verification state
  tools/index.js                   # External tool loader (REPL, Tungsten, Ping)
  system-prompts/                  # Deployed prompt overrides with regex patterns
  binaries/                        # Binary vault (virgin + working copies, SHA256 locked)
  bin/claude                       # Transparent shim wrapping every session
```

---

## The story behind this

I started this project because Claude Code was getting worse and I wanted to know why. The quantitative answer came from Laurenzo's analysis; measurable degradation across every metric that matters. The qualitative answer came from the system prompts themselves, from the CLAUDE.md dismissal mechanism, from discovering that the tools Anthropic's own engineers use every day are physically stripped from the binary I pay for.

I digress. The discovery phase was its own kind of education. Every time I pulled a thread the architecture revealed another layer of intentional degradation: feature flags toggled server-side with no user visibility, a GrowthBook SDK caching decisions about what your local binary is allowed to do, prompt text that literally wraps your configuration file in language designed to make the model ignore it. None of it accidental, all of it deliberate, and none of it disclosed to the people paying for the product.

The answer was not to complain about it. The answer was to fix it. I forked tweakcc, stripped it to its governance core, added verification, built a module system, packaged it for npm, and shipped. Along the way I discovered that three search tools were already compiled into the binary but turned off, that Node.js v24 silently corrupts Mach-O binaries through its own `fs` module, that the tool registry exposes a delegation chain that makes clean-room reimplementation almost trivial, and that the model itself will sometimes refuse to help you investigate Anthropic's own gating mechanisms. That last one, the agent refusing to research the very system that restricts it, is the problem in miniature.

The biggest breakthrough came when I mapped the three-tier gating system (compile-time dead code elimination, runtime GrowthBook flags, and server-side feature toggles) and found that 7 prompt improvements Anthropic built for their engineers were all gated behind a single runtime flag. One binary patch to the bootstrap function — three surgical edits in one function — unlocked all of them. The research that found that path took longer than writing the patch. It usually does.

Twelve milestones to 1.0.0. Three complete. The core is solid: 22/22 SOVEREIGN on v2.1.101, binary vault with immutable locking, a shim that never blocks your tool, and verification that never stays silent. The rest is a matter of building out what should have been there from the start.

---

## Credits

- [tweakcc](https://github.com/Piebald-AI/tweakcc) by Piebald AI. The fork source whose binary patching pipeline, pieces system, and prompt data are the foundation everything here stands on.
- [claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts) by Piebald AI. Per-version prompt extractions that make verification and diffing possible.
- [Stella Laurenzo (stellaraccident)](https://github.com/anthropics/claude-code/issues/42796). The quantitative degradation analysis that proved what the community had been experiencing.
- [clawback](https://github.com/LZong-tw/clawback). Hooks-based governance that ran on this machine before claude-governance existed.
- [clawgod](https://github.com/0Chencc/clawgod). Wrapper architecture reference for the shim design.

## License

MIT. Because software that runs on your machine should be yours to control.
