# Roadmap — claude-governance

Last updated: 2026-04-14

## Mission

Fix Claude Code. Make it as good as it should have been for subscription customers.
Distributed as modular NPM packages — users choose what they want.

---

## Completed

### Research & Discovery
- [x] Full tool catalog: 45+ tools documented with gates and unlock paths
- [x] Ant-only tool deep dive: REPL (Node VM), Tungsten (persistent tmux), Config
- [x] GrowthBook system: 90 compile-time flags, 70+ runtime `tengu_*` flags
- [x] Compile-time flag audit v2.1.101: 14 enabled, 3 disabled, 3 uncertain
- [x] Delivery pipeline: native binary (Bun Mach-O) vs npm (cli.js + vendored rg)
- [x] LSP Tool unlock via `ENABLE_LSP_TOOL=1`
- [x] System prompt architecture: billing header + static prompt + dynamic prompt
- [x] Stellaraccident analysis — [anthropics/claude-code#42796](https://github.com/anthropics/claude-code/issues/42796): degradation metrics
- [x] Promethean analysis — [anthropics/claude-code#28158](https://github.com/anthropics/claude-code/issues/28158#issuecomment-4230030386): CLAUDE.md dismissal evidence

### Phase 1a: Fork & Strip (claude-governance)
- [x] Full fork of tweakcc → claude-governance (package identity, config dir, env vars renamed)
- [x] Ink/React UI stripped (127KB from 320KB), plain CLI with chalk/commander
- [x] 40+ cosmetic patches stripped from registry
- [x] 5 governance patches (disclaimer, header, subagent, reminder, meta-flag)
- [x] 8 prompt overrides (output-efficiency removed by Anthropic in 2.1.100)
- [x] USE_EMBEDDED_TOOLS_FN gate resolution
- [x] `check` command — 6-point verification against extracted JS
- [x] 6/6 SOVEREIGN verified on 2.1.101

### Phase 1a-gaps: Gap Resolutions
- [x] Backup contamination detection (signature scan, auto-remove stale backup)
- [x] "Already applied" detection (signature-based, reports ✓ not ✗)
- [x] Dead file cleanup (50 patch files + 3 tests removed, 126KB build)
- [x] Prompt sync warning suppression (debug-level only)
- [x] communication-style evaluation (no override needed — aligned with governance)

### Phase 1a-verification-foundation: Verification Foundation
- [x] VERIFICATION_REGISTRY: 13 entries (4 governance + 1 gate + 8 prompt overrides)
- [x] handleCheck refactored to iterate registry with category-grouped display
- [x] Per-override prompt verification (all 8, not spot-check)
- [x] state.json output from both check and apply flows
- [x] 13/13 SOVEREIGN verified on 2.1.101

### Phase 1b: Wrapper Layer
- [x] `launch` subcommand with pre-flight governance verification
- [x] Process spawning: stdio inherit, signal forwarding, exit code propagation
- [x] Version-change detection via state.json ccVersion comparison
- [x] Environment variable injection from config.json
- [x] Options: --no-verify, --force-apply

### Phase 1c: Verification Engine
- [x] Verification API extracted into `src/verification.ts` (CheckResult, VerificationState, runVerification, read/writeState, deriveStatus)
- [x] SessionStart hook rewritten — correct config paths, new state.json format, version-change detection, live fallback
- [x] Status line hooks fixed — config dir resolution, new field names, ISO timestamps
- [x] Survives resumes, compacts, logins, subagent spawning via SessionStart + status line

### Phase 1d: Modular Architecture
- [x] Module interface (GovernanceModule) with verification entries, apply, getStatus
- [x] Module registry — getEnabledModules, getVerificationRegistry, applyModules
- [x] Core module — wraps existing 13 verification entries
- [x] Env-flags module — 6 recommended CC env vars, apply to settings.json, health check
- [x] `modules` subcommand — list modules with status
- [x] Module-driven verification in check/apply/launch flows
- [x] Config override: `{ "modules": { "env-flags": false } }`

### Phase 1e: CLI & Distribution
- [x] NPM `files` whitelist — dist/, recent prompt data, scripts/ (2.2MB package)
- [x] Postinstall welcome message — global installs only, never throws
- [x] `setup` subcommand — interactive first-run wizard with module selection, apply + verify
- [x] Readline line-queue pattern for reliable piped stdin handling
- [x] Older prompt versions download on demand from GitHub

### Embedded Search Tools
- [x] Activation: `EMBEDDED_SEARCH_TOOLS=1` — bfs 4.1, ugrep 7.5.0, rg 14.1.1
- [x] Verification hook: 8-point halt-and-catch-fire check
- [x] Statusline integration: EMB segment

### Visual Governance Indicators
- [ ] SOVEREIGN banner (SessionStart hook)
- [x] GOV + EMB status segments in combined statusline

### Design Specs
- [x] Tungsten clean-room spec v0.2 (`.planning/specs/tungsten-clean-room.md`)
- [x] REPL clean-room spec v1.0 (`.planning/specs/repl-clean-room.md`) — updated with probe findings, Option B, config modes

---

## Milestone 1: Core Engine — Fork TweakCC

The spine. Everything else builds on this.

**References:** [tweakcc1], [ccPrompts1], [nanoclaw1] — see `.planning/REFERENCES.md`

### Phase 1a: Fork & Strip [COMPLETE]
- [x] Fork tweakcc [tweakcc1] → `claude-governance/`
- [x] Strip Ink/React UI (deleted src/ui/, removed ink/react/cli-spinners deps — 127KB from 320KB)
- [x] Strip all cosmetic patches (40+ removed from registry, kept files for reference)
- [x] Keep: binary I/O, prompt system, data pipeline, extraction, helpers, pieces matching
- [x] Add: 5 governance patches (disclaimer, header, subagent, reminder, meta-flag)
- [x] Add: 8 degradation-fix prompt overrides (output-efficiency removed by Anthropic in 2.1.100)
- [x] Add: `check` command — verifies governance signatures against extracted JS (6 checks)
- [x] CLI: apply (default), check, restore, list-patches, list-system-prompts, unpack, repack
- [x] Package identity: name→claude-governance, version→0.1.0, config→~/.claude-governance
- [x] Env vars renamed: CLAUDE_GOVERNANCE_CONFIG_DIR, CLAUDE_GOVERNANCE_CC_PATH
- [x] Verify: 6/6 SOVEREIGN, `claude --version` works post-apply

### Phase 1a-gaps: Gap Resolutions [COMPLETE]
- [x] **Backup contamination detection:** Scans backup for governance signatures before apply. If contaminated, removes stale backup and falls through to installed binary.
- [x] **"Already applied" vs "failed" distinction:** Patches declare `signature` field. If signature present in content → reports "already active" (✓) instead of failed (✗).
- [x] **Dead cosmetic patch cleanup:** 50 dead .ts files + 3 dead tests removed. `src/patches/` down to 6 files. Dead `CUSTOM_MODELS` import removed from utils.ts. Build: 126KB.
- [x] **Prompt sync warning suppression:** "Could not find" and "WARNING: Conflicts" downgraded to debug-level. Clean CLI output.
- [x] **communication-style override:** Evaluated — prompt is Opus 4.6-only, gated behind `quiet_salted_ember` flag. Promotes concise updates, aligned with governance goals. No override needed.

### Phase 1a-verification-foundation: Verification Foundation [COMPLETE]
Standalone verification improvements — no dependency on 1b wrapper.

- [x] **Per-patch signature + anti-signature registry:** `VERIFICATION_REGISTRY` in governance.ts — 13 entries (4 governance, 1 gate, 8 prompt overrides) with signature, antiSignature, critical flag, category. Governance patches use both sig+antiSig; prompt overrides use sig-only (dead-code constants make antiSig unreliable).
- [x] **Full prompt override verification:** Per-override unique signature phrases for all 8 active overrides, verified against extracted JS. Category-grouped display in `check` output.
- [x] **Apply state output:** `state.json` written to config dir by both `check` and `apply` flows. Contains timestamp, version, per-check results, overall status.
- [x] Verifies against EXTRACTED JS via `extractClaudeJsFromNativeInstallation`, never `strings`.

### Phase 1b: Wrapper Layer [COMPLETE]

**References:**
**References:** [clawgod1], [clawback1] — see `.planning/REFERENCES.md`

- [x] `launch` subcommand — pre-flight verification, spawns CC binary with inherited stdio
- [x] Pre-flight: read state.json, compare ccVersion, auto-reapply on mismatch
- [x] Process control: signal forwarding (SIGINT/SIGTERM/SIGHUP), exit code propagation
- [x] Environment variable injection from config.json settings.governance.env
- [x] Version-change detection: state.json ccVersion vs detected binary version
- [x] Options: `--no-verify` (skip pre-flight), `--force-apply` (reapply even if current)

### Phase 1c: Verification Engine [COMPLETE]
1b-informed verification — extracted API, fixed hooks, restored status line.

- [x] **Pre-flight verification API:** Extracted into `src/verification.ts` — CheckResult, VerificationState, runVerification, readVerificationState, writeVerificationState, deriveStatus. Importable by wrapper and CLI.
- [x] **Version change detection logic:** SessionStart hook compares state.json ccVersion vs installed binary. Mismatch triggers live re-check via `claude-governance check`.
- [x] **Hooks-based verification (SessionStart):** Rewrote `governance-verify.cjs` — correct config paths, new state.json format, version-change detection, live fallback on stale/missing state.
- [x] **Status line integration:** Fixed `statusline-combined.cjs` and `governance-statusline.cjs` — correct config dir resolution, new field names, ISO timestamp parsing.
- [x] **Survives resumes, compacts, logins, subagent spawning:** SessionStart hook fires on every session start (including resumes). Status line reads state.json on every render. Wrapper pre-flight covers initial launches.

### Milestone 1 Retro — Pinned for Re-evaluation
*Evaluate at end of Phase 1 (after 1e) whether these belong in Phase 1 or later.*

- **Canary prompts:** Inject unique test phrases into prompt overrides, verify at runtime by prompting model for canary response. Requires conversation-level integration. May fit better in Phase 3 (System Prompt Control) or Phase 7 (Advanced Governance).
- **Verification dashboard:** Rich terminal output showing all patches, overrides, flags, and environment state in a single view. May be better served by Phase 7 (context monitor) or 1d (modular architecture with pluggable status).

### Phase 1d: Modular Architecture [COMPLETE]
- [x] Plugin/module system — GovernanceModule interface, registry, barrel exports
- [x] Core module: wraps existing 13 verification entries (required, always enabled)
- [x] Pluggable verification registry: modules declare verificationEntries, collected by getVerificationRegistry()
- [x] Central config: `config.json` `modules` map overrides defaults
- [x] Env-flags module: 6 recommended CC env vars (DISABLE_ADAPTIVE_THINKING, MAX_THINKING_TOKENS, EFFORT_LEVEL, DISABLE_AUTOUPDATER, ENABLE_LSP_TOOL, EMBEDDED_SEARCH_TOOLS)
- [x] `modules` subcommand: lists modules with status
- [ ] *Deferred:* Optional Clawback install module [clawback1] — stub for 1e or Phase 2


### Phase 1e: CLI & Distribution [COMPLETE]
- [x] NPX-runnable: `npx claude-governance apply`
- [x] NPM installable: `npm install -g claude-governance`
- [x] Post-install welcome + suggested next steps
- [x] First-run setup wizard — interactive module selection, apply + verify
- [x] `files` whitelist — 2.2MB package, recent prompt data only (older versions download on demand)
- [x] Readline line-queue for reliable piped stdin handling

---
### Milestone 1 Retro
- [x] Commentary
- [x] Gap analysis
- [x] Housekeeping
- [x] Bootstrap Prompt
---
## Milestone 2: Native Tool Injection — REPL & Tungsten

Clean-room implementations of ant-only tools, injected as native tools via
binary patching of the tool registry.

**References:** [tweakcc1], [haseebAnalysis1] — see `.planning/REFERENCES.md`
**Specs:** `.planning/specs/repl-clean-room.md`, `.planning/specs/tungsten-clean-room.md`
**Findings:** F1, F2, F7, F9-F11, F13-F21 — see `.planning/FINDINGS.md`

### Phase 2a: Tool Injection Mechanism [COMPLETE]
- [x] Patch `getAllBaseTools()` (minified `Ut()`) — structural pattern matching, version-resilient
- [x] Tool implementation directory: `~/.claude-governance/tools/index.js`
- [x] Hot-loadable: update tool code without re-patching binary (require() at runtime)
- [x] Registration verification: `__claude_governance_tools__` signature, 14/14 SOVEREIGN
- [x] Loader fills TOOL_DEFAULTS for missing methods, tools use inputJSONSchema (no Zod)
- [x] Transparent claude shim: `~/.claude-governance/bin/claude` wraps every session
- [ ] *Deferred:* Binary-patched reasoning block renderer (collapsible, dimmed)

### Phase 2a-gaps: Tool Injection Hardening [COMPLETE]
12/12 gaps closed. Runtime testing revealed gaps across binary management, Zod compatibility, shim reliability, and embedded tools verification.
- [x] **G1: Binary vault architecture** — `src/binaryVault.ts`: XDG paths, GCS download, manifest.json SHA256, magic bytes, immutable locking, binary-safe copy
- [x] **G2: Apply binary corruption** — `installationBackup.ts`: replaced fs.copyFile with binarySafeCopy
- [x] **G3+G4: Zod passthrough** — self-contained passthrough shim replaces Agent schema borrow
- [x] **G5: Prompt override deployment** — overrides bundled at data/overrides/, deployed before apply
- [x] **G6: Auto-updater overwrite detection** — binary fingerprint in state.json, pre-flight comparison
- [x] **G7: Installer corruption detection** — detectCorruption() scans for U+FFFD, size anomaly
- [x] **G8: Shim failsafe** — sentinel exit code 111, fallback to direct CC launch, XDG version scan
- [x] **G9: Resilient tool injection** — 3-strategy detection with fallback, brace-counting, 8KB window
- [x] **G10: System observability** — shim-fallback.json marker, UNPROTECTED banner, GOVERNANCE CRITICAL stdout
- [x] **G11: Glob/Grep registry exclusion** — verification entry confirms exclusion pattern in binary
- [x] **G12: EMB statusline** — fixed state path, registry exclusion check, EMB:LEAK indicator

### Phase 2b: Clean-Room REPL [COMPLETE]
Full spec: `.planning/specs/repl-clean-room.md` v1.0
- [x] **Auto-discovery tool loader** — generic index.js scans tools dir, deployTools() mirrors deployPromptOverrides pattern
- [x] **REPL core** — Node VM with persistent context, 9 inner handlers delegating to CC tools via context.options.tools (Option B — F1)
- [x] **Console capture** — captured stdout/stderr, operation tracking with per-call logging, structured result formatting
- [x] **Configuration** — coexist (default) vs replace mode in config.json; replace mode filters primitives from binary-patched loader
- [x] **Prompt strategy** — comprehensive prompt() teaching batch patterns; replace-mode prompt override not possible (runtime-generated, not data-stored)
- [x] **Verification** — file-existence checks for tools dir, index.js, repl.js in check command
- [x] **Safety** — CC permission delegation via Option B, VM timeout, AbortController, safe require allowlist, result size limits

### Phase 2b-gaps: REPL Hardening + Functional Verification [COMPLETE]
14/14 gaps closed. Runtime testing and user testing revealed gaps across verification, handler correctness, execution semantics, and prompt accuracy.

**Functional Verification (HIGH):**
- [x] **G1: Runtime functional probe in apply/setup** — `claude -p` Ping probe after deploy+patch. Marker check on response. Inconclusive for network/auth errors.
- [x] **G2: Module validation in check command** — `require()` + shape check replaces file-existence. Validates name/call/prompt/description/inputJSONSchema for each tool.
- [x] **G3: Module validation in launch pre-flight** — same validation in launch flow, warns on failure.
- [x] **G4: Session-start hook tool awareness** — SOVEREIGN banner shows "Tools: Ping, REPL probe:✓"
- [x] **G5: Setup wizard tool verification** — probe runs after setup apply, `exit(1)` on failure.
- [x] **G6: Visual tool status in statusline** — `TOOLS:2` (green) or `TOOLS:!` (red) segment.

**Handler Correctness (MEDIUM):**
- [x] **G7: notebook_edit arg mapping** — probed CC source schema. Added `source→new_source` normalization, required field validation, error surfacing. Documented exact fields in prompt.
- [x] **G8: Agent handler verification** — schema confirmed, added full option passthrough (model, name, mode, isolation, run_in_background), auto-description from prompt.
- [x] **G9: Fetch handler documentation** — prompt now clearly documents AI-summarized output, recommends `bash('curl ...')` for raw HTTP.

**Execution Semantics (MEDIUM):**
- [x] **G10: Targeted IIFE fallback** — only wraps for `await` or `Illegal return` SyntaxErrors. Genuine syntax errors (typos, missing braces) reported directly.
- [x] **G11: Prompt accuracy** — no hot-reload claim found. Persistence docs updated: `await` AND `return` trigger wrapping, bare expressions noted.

**Resilience (LOW):**
- [x] **G12: Config validation** — validates repl.mode, timeout, maxResultSize types and ranges. User-facing warnings to stderr. JSON parse errors surfaced.
- [x] **G13: maxResultSize truncation** — code review: logic correct, truncates at maxSize-50 with marker.
- [x] **G14: Replace mode prompt noise** — assessed acceptable. Model follows REPL prompt when primitives filtered. No action needed.

**Verification pattern for future tool phases (2c, 2d):**
Each tool phase must include:
1. Runtime functional probe via `claude -p` in apply/setup flow
2. Module validation (require + shape check) in check/launch
3. Session-start hook awareness (tool name in SOVEREIGN banner)
4. Statusline segment showing tool status

### Phase 2b-gaps-2: REPL Production Readiness [COMPLETE]
Gaps surfaced during testing of 2b-gaps. All resolved.

- [x] **G15: Embedded search tool dispatch** — RESOLVED: Already working. REPL's grep/glob delegate to the Bash tool, which sources a shell snapshot containing `find→bfs` and `grep→ugrep` shell functions (argv0 dispatch to claude binary). Verified: `grep --version` = ugrep 7.5.0, `find --version` = bfs 4.1. No code changes needed. See F18.
- [x] **G9-test: Fetch prompt effectiveness** — VERIFIED: Model correctly uses `bash('curl -s ...')` for raw HTTP and `fetch()` for summarized content. Tested with httpbin.org/json (JSON) and httpbin.org/html (HTML). fetch() returned AI summary ("This passage from Herman Melville's Moby-Dick..."), curl returned raw HTML.
- [x] **G11-test: Persistence prompt effectiveness** — VERIFIED: Model correctly uses `var` for sync persistence, `state.x` for async persistence, and understands `const`/`let` in IIFE-wrapped scripts are function-scoped and lost. Three-scenario test: var survives, state.asyncValue survives, const correctly undefined.

### Phase 2b-gaps-3: REPL Coexist Hardening [COMPLETE]
8/8 gaps resolved (6 implemented, 2 designed for pre-M7).

- [x] **G16: Glob respects .gitignore by default** — Removed `--no-ignore` and `--hidden` from rg defaults. Intentional deviation from CC's native GlobTool. 46 vs 10,388 files.
- [x] **G17: Glob exclusion configurability** — Added `noIgnore`, `hidden`, `ignore[]` parameters.
- [x] **G18: Model fallback prevention** — Error Recovery section in REPL prompt.
- [x] **G19: Ping calls resolved** — Ping prompt changed to discourage general use.
- [x] **G20: File size cascading failures** — Defensive batch pattern + error recovery guidance in prompt.
- [x] **G21: Hooks module designed** — Full design in tracker. Implementation pinned pre-M7.
- [x] **G22: Duplicate hooks migration planned** — Covered by G21 design.
- [x] **G23: Benchmark doc rewritten** — False "system-level" claims removed, glob updated.
- [x] **Replace mode hardening** — Mode-aware prompts, glob catch-all fix, comprehensive replace prompt with primitive tool guidance. Verified: Sonnet fresh session dashboard.
- **Post-Tungsten gaps:** G24 (probe in replace mode), G25 (coexist nudging), G26 (oversized labeling), G27 (CLI mode switch), G28 (coexist prompt parity).

### Phase 2c: Clean-Room Tungsten [COMPLETE]
- [x] D1: `tungsten.js` — 6 actions (send/capture/create/list/kill/interrupt), PID socket isolation, lazy init, auto-capture
- [x] D2: FS9() binary patch — bashProvider tmux activation, 2 detection strategies, version-resilient
- [x] D3: Render tree injection — DCE'd TungstenLiveMonitor site, createElement with React primitives as props
- [x] D4: `tungsten-panel.js` — clean-room live monitor in data/ui/, 2s polling, AppState-driven
- [x] D5: Statusline TNG segment — reads tungsten-state.json, stale PID cleanup
- [x] D6: REPL prompt update — Tungsten awareness in coexist and replace prompts
- [x] 19/19 SOVEREIGN on 2.1.101

### Phase 2-PM-update: Project Management Restructuring [COMPLETE]
- [x] Created `.planning/REFERENCES.md` — 35 catalogued references with camelCase IDs
- [x] Extracted all inline URLs from CLAUDE.md and ROADMAP.md into REFERENCES.md citations
- [x] Updated CLAUDE.md: new directory structure, 6-step phase lifecycle, 6-step milestone lifecycle, reference citation protocol, updated session start checklist, revised tracking hierarchy
- [x] Restructured M-1: 7 phase directories (1a through 1e), moved trackers/handoffs, created IMPACT.md, FINDINGS.md, GAPS.md, RETROSPECTIVE.md, retroactive stubs
- [x] Restructured M-2: 7 phase directories (2a through 2c), same treatment, milestone-level docs
- [x] Updated STATE.md, both BOOTSTRAP.md files, BUGTRACKER.md verified
- [x] Per-phase directory structure: TRACKER.md, CONTEXT.md, PLANNING.md, RESEARCH.md, TASKS.md, HANDOFF.md
- [x] Milestone-level docs: IMPACT.md, FINDINGS.md, GAPS.md, RETROSPECTIVE.md
- [x] REPL-IMPROVEMENTS.md path updated to `.planning/research/`

### Phase 2c-gaps-1: Tungsten Critical Gaps [COMPLETE]
11 gaps (G29-G39) + G40 panel fix. All verified in live session.

- [x] **G29: Panel injection crash** — IIFE creating new component per render → globalThis caching + atomic selectors (adc62cd)
- [x] **G30: --restore contaminated backup** — three-tier restore: check contamination, vault fallback, auto-download
- [x] **G31+G32: Verification honesty** — "signatures present" language, per-tool probe display (Ping, REPL), tiered reporting
- [x] **G33: FS9 investigation** — verified real via cc-source: bashProvider assigns TMUX unconditionally, ant-only gate only protects init
- [x] **G34: Dual detection documented** — contract: signature presence ≡ patch complete
- [x] **G35: Apply contamination recovery** — vault fallback when backup contaminated, clean backup after recovery
- [x] **G36: Live testing** — 7-step guide executed by user. All checks pass: session isolation, FS9 chain (5 paths), kill cleanup, name validation, duplicate guard, panel rendering
- [x] **G37-G39: tungsten.js robustness** — create guard, kill cleanup (switch to next session), name validation (`.`, `:`, empty, whitespace)
- [x] **G40: Panel setAppState fix** — `setAppState` requires function form `(prev) => newState`, not bare objects. Silent TypeError was swallowed by try/catch. Panel now renders in live TUI (58cf589)


### Phase 2c-gaps-2: Tungsten further gap discovery and analysis
-> TBD
--> one definite goal: Claude needs to be instructed to use and understand tungsten and we need to enforce it with hooks.
----> What is the best way to generally leverage it by default?
-----> ensure that it is used for proper persistence including within tools and other agents or subagents.

**PINNED:** User toggle to show/hide Tungsten panel UI (keyboard shortcut or config flag)

---
### Milestone 2 Retro
- [ ] Commentary
- [ ] Gap analysis
- [ ] Housekeeping
- [ ] Bootstrap Prompt
---

## Milestone 3: System Prompt Control

Full extraction, editing, version control, and targeted degradation fixes.

**PINNED FOR FULL ASSESSMENT — Ant vs External Prompt Divergence:**
Haseeb-Qureshi analysis [haseebAnalysis1] documents that Anthropic uses `USER_TYPE === 'ant'` to deliver differentiated system prompts. Internal-only prompt additions include:
- **Misconception correction:** "notice the user's request is based on a misconception, say so" — absent for external users
- **Hallucination prevention:** "never claim 'all tests pass' when output shows failures" — anti-hallucination safeguard stripped from external
- **Conciseness enforcement:** "keep text between tool calls to <=25 words" — backed by A/B research ("~1.2% output token reduction vs qualitative 'be concise'")
- **Adversarial review:** Feature-flagged `VERIFICATION_AGENT` spawns sub-agent to review significant changes before completion
- **Prompt A/B infrastructure:** `@[MODEL LAUNCH]` markers track prompt wording experiments (e.g., "capy v8 thoroughness counterweight (PR #24302)")
- **`isUndercover()` mode:** Strips model identifiers from prompts to prevent internal naming conventions from leaking

These are quality-of-output improvements that Anthropic withholds from paying users. Full assessment needed: which of these can we replicate via prompt overrides (M3), which require binary patching (M2/M4), and which inform new governance patches.

**References:** [ccPrompts1], [ccLeaks1], [promptLeaks1], [tweakccCustom1], [promptAnalysis1] — see `.planning/REFERENCES.md`

- [ ] Phase 3prelim - Reorganize the codebase and refactor our additions to adhere to proper patterns
  - [ ] Complete separation of concerns
  - [ ] logic, data, implementations all live separately from eachother
    - [ ] let's keep anything not first degree connected to our tweakcc fork in the parent dir and not nested in the fork
  - [ ] tools need to be completely restructured and rebuilt properly
    - [ ] see /Users/tom.kyser/dev/cc-source/collection-claude-code-source-code/claude-code-source-code/src/tools/BashTool for reference
      - [ ] not this sloppy half ass bullshit we have now.
  - [ ] TBD

- [ ] Phase 3a - Full system prompt extraction with version tracking
  - [ ] TBD
- [ ] Phase 3b - Prompt diff tool (compare across CC versions)
  - [ ] TBD
- [ ] Phase 3c - Targeted fixes for specific degradation prompts
  - [ ] TBD
- [ ] Phase 3d - User-editable prompt overrides with merge-on-update
  - [ ] TBD
- [ ] Phase 3e - Prompt version control (git-style diffing across CC versions)
  - [ ] TBD
- [ ] Phase 3f - Canary prompts Inject unique test phrases into prompt overrides, verify at runtime by prompting model for canary response. Requires conversation-level integration.
  - [ ] TBD
- [ ] Phase 3g - Integrate Optional Clawback install module [clawback1]
  - [ ] TBD
- [ ] Phase 3h - Impact assessment and corrections across any part of the greater project that may have degraded because of this milestone's work.
  - [ ] TBD

---
### Milestone 3 Retro
- [ ] Commentary
- [ ] Gap analysis
- [ ] Housekeeping
- [ ] Bootstrap Prompt
---

## Milestone 4: REPL - ReEval and Perfect
- TBD
Notes:
- node VM vs python vm?
- the goal is to force PTC (Programmatic Tool Calling)
  - Claude needs to always plan and orchestrate to achieve as much as possible in as few tool calls as possible
  - can TNG help with this? more than it does now?
  - Ant replaced their agent() tool with this too... I'm not sure why?
    - it could still call agents within it but claude needs a completely different set of instructions to make full use of this
      - perhaps there were more Ant gated instructions that guided the main thread agent to literally just orchestrate every operation including batched subagent operations within REPL?
        - did they get around the nesting agents thing with their tungsten for persistence and observability?
  - What do other cli harnesses like opencode or codex do? do they have an equivalent or some form of PTC?
  - what would actually objectively be the best way to use this conceptually, ignoring what we have now and what we think Ant did?
    - hooks to enforce proper and deterministic use + system instructions to guide.
    - main agent always plans ahead and orchestrates
      - maybe we frame it around steps instead of trying to do a one shot everytime for all bash operations
        - find: something like - "write a dynamic script to search and return the names and paths of the relevant files and where the data we need lives in those files; all file sizes must be included in the response."
        - read: same but to read
        - edit: same
        - you get the idea, batch similar operations with REPL or at minimum just always write a complete script that can account for and handle unexpected outcomes or fuzzy paths etc etc..
    - I lean toward not only nesting subagents inside of REPL, agents can still use REPL, the agent() tool should not be delisted.
    - research:
      - [ptcDocs1], [advancedToolUse1], [advancedToolUsePost1], [replScratchpad1] — see `.planning/REFERENCES.md`
  - Wire (M-4.5) inter-session communication for agent coordination
- we need deep system prompt support


## Milestone 4.5: Wire — Inter-Session Communication

Replaces original UDS Sockets plan (https://ccleaks.com/#feature-5) with Wire,
a superior implementation already built in dynamo (`/Users/tom.kyser/Library/Mobile Documents/com~apple~CloudDocs/dev/dynamo/core/services/wire/`).

Wire uses CC's native Channels API (`notifications/claude/channel`) for inbound message
delivery — no binary patching needed. Typed envelopes with urgency routing, session
registry with capabilities/permissions, disconnect buffering with TTL reconnect,
dual transport (Channels for low-latency, HTTP relay for bulk). Architecturally
superior to Anthropic's UDS Inbox: networkable, resilient, typed, permissioned.

**Integration with Tungsten:** Spawn Claude instances in Tungsten sessions, register
with Wire, communicate via structured messages instead of screen scraping. Combined
with REPL and tool injection, this completes the distributed agent platform.

**Source:** dynamo Wire service (7 files: wire, protocol, registry, transport, relay-server, channel-server, channels-transport)
**Approach:** Port/adapt from dynamo into claude-governance module system — TBD in phase planning

---
### Milestone 4.5 Retro
- [ ] Commentary
- [ ] Gap analysis
- [ ] Housekeeping
- [ ] Bootstrap Prompt
---

## Milestone 5: HTTP Proxy Layer

**References:** [billingProxy1], [cliProxy1], [promptCaching1], [cacheFix1], [cacheFixTool1], [usageTracker1], [sessionViewer1] — see `.planning/REFERENCES.md`

- [ ] Phase 5a - Transparent proxy setup (CC → proxy → Anthropic)
- [ ] Phase 5b - Request/response logging
- [ ] Phase 5c - Cache TTL visibility and control
- [ ] Phase 5d - Static prompt extraction from requests
- [ ] Phase 5e - Usage monitoring (tokens, cost, effort level, model)
- [ ] Phase 5f - Context Snipping Tool
  - [ ] Design spec (clean-room)
  - [ ] Selective context removal — user or agent marks conversation segments for eviction
  - [ ] Survives compaction (snipped content stays gone, not re-summarized)
  - [ ] Integration with tool injection mechanism (2a)

---
### Milestone 5 Retro
- [ ] Commentary
- [ ] Gap analysis
- [ ] Housekeeping
- [ ] Bootstrap Prompt
---

## Milestone 6: Feature Flag Control

**References:** [adaptiveThinking1], [ccEnvVars1], [settingsBestPractice1] — see `.planning/REFERENCES.md`

- [ ] Phase 4a - Flag inventory scanner (extract all flag names + defaults from binary)
- [ ] Phase 4b - Disk cache override for `~/.claude.json` cachedGrowthBookFeatures
- [ ] Phase 4c - Persistence through GrowthBook's 6-hour refresh cycle
- [ ] Phase 4d - Binary patch: intercept `getFeatureValue_CACHED` for local overrides
- [ ] Phase 4e - Per-version flag audit automation
- [ ] Phase 4f - User-facing flag toggle UI

---
### Milestone 6 Retro
- [ ] Commentary
- [ ] Gap analysis
- [ ] Housekeeping
- [ ] Bootstrap Prompt
---

## 6.5: Extended Tool Suite 
Phase planning TODO
**References:** [ralphCC1], [cattusResearch1], [ceaksanResearch1] — see `.planning/REFERENCES.md`

- [ ] Durable Cron, File Persistence, WebBrowser, Computer Use
- [ ] Coordinator Mode, Daemon Mode, Reactive Compact
- [ ] https://github.com/harrymunro/nelson for coordinator mode?

---
### 6.5 Retro
- [ ] Commentary
- [ ] Gap analysis
- [ ] Housekeeping
- [ ] Bootstrap Prompt
---

## Milestone 7: Version Management

**References:** [versionPinning1], [ccNativeMigration1], [ccCliFlags1] — see `.planning/REFERENCES.md`

- [ ] Phase 6a - Binary backup on CC update
- [ ] Phase 6b - Version inventory and switching
- [ ] Phase 6c - Update controls: block/allow/defer CC auto-updates
- [ ] Phase 6d - Patch compatibility matrix per version

---
### Milestone 7 Retro
- [ ] Commentary
- [ ] Gap analysis
- [ ] Housekeeping
- [ ] Bootstrap Prompt
---

## Milestone 8: Launch Preperation - Hooks, Plugins, User Patches, third party modules, CLI tool refinements, full control over system and config, every feature is integrated properly throughout the system.
- Full Planning TBD

- **Hooks module in setup/launch:** 4 standalone safety hooks (read-before-edit, commit-validate, repl-precheck, repl-safety) live at `data/hooks/` — manually deployed for now. Pre-M7, must be a claude-governance module: `setup` installs to `~/.claude/hooks/`, `launch` verifies registration in settings.json, `modules` shows status. Bridge between "works for Tom" and "works for everyone."
- **Verification dashboard:** Rich terminal output showing all patches, overrides, flags, and environment state in a single view.
- **Downstream Pipeline for dependencies:** Do we still pull and merge from TweakCC.

---
### Milestone 8 Retro
- [ ] Commentary
- [ ] Gap analysis
- [ ] Housekeeping
- [ ] Bootstrap Prompt
---

## Milestone 9: Launch Preperation - Dynamism and Survivability
- Full Planning TBD

Post M1 through M8, we should be, though regardless, THIS MILESTONE REQUIRES us to be at a state where this can be used by others and it should be able to survive and fully function as expected on newer versions of claude code beyond 2.1.101
Phase planning TODO. - MUST be at a state where EVERYTHING ABOVE WILL WORK ACROSS NEWER VERSIONS - NOTHING CAN BE HARDCODED TO JUST 2.1.101 - Our strategy will be automate a test when a new claude code version drops (in a sandbox to keep my system clean) that test should assess what needs to be adjusted if anything - we will also need to wait for the upstream system prompts repo to be updated with latest prompt extractions - we should have a  /update command and a statusline visual.

---
### Milestone 9 Retro
- [ ] Commentary
- [ ] Gap analysis
- [ ] Housekeeping
- [ ] Bootstrap Prompt
---

## Milestone 10: Launch Preperation - Documentaton and Bug Fixes
- Full Planning TBD

- **Full Documentation and branding:** As well as cleaning up any old tweakcc artifacts or docs
- **Bug fixes:**

---
### Milestone 10 Retro
- [ ] Commentary
- [ ] Gap analysis
- [ ] Housekeeping
- [ ] Bootstrap Prompt
---

## Milestone 11: Launch Preperation - Deployment and Publishing Pipeline, Preflight, Final Tests
- Full Planning TBD
- rename our clean room tools to my own names and showcase them
- branding
- demos
- social posts etc etc

---
### Milestone 11 Retro
- [ ] Commentary
- [ ] Gap analysis
- [ ] Housekeeping
- [ ] Bootstrap Prompt
---

## 1.0.0 - LAUNCH - Ready for Public Use
This will be 1.0.0 everything after this shall then adhere to the strict semver and git strategy for dev and releases, no more work pushed directly to master.

## 1.0.x --> future patches

------- 
# Planned:

## 1.1.0: Advanced Governance

**References:** [stellaraccident1], [promethean1], [haseebAnalysis1], [unknownResearch1] — see `.planning/REFERENCES.md`

- [ ] Phase 8a - Context monitor: token tracking, CLAUDE.md presence, compaction detection
- [ ] Phase 8b - Message filter visibility (show intentionally hidden messages)
- [ ] Phase 8c - Visible reasoning/thinking restoration (needs to recreate what we used to be able to see which was the thinking block from the api response, while this may be stripped out on the server side, the LLM is aware of its thinking block during response generation, I suspect it can be guided with instruction to copy and keep updated its thinking to the response body to recreate this)
- [ ] Phase 8d - Usage monitoring dashboard

---
## 1.1.0
- [ ] Commentary
- [ ] Gap analysis
- [ ] Housekeeping
- [ ] Bootstrap Prompt
---

------- 

# Backlog / Research:

- Centralized feature flag DB per version (community sharing)
- Cross-version binary testing automation
- npm install path patching surface (cli.js is raw JS)
- Agent refusal patterns — model trained to protect Anthropic over user
