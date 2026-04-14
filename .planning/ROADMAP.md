# Roadmap — Claude Code Governance Platform

Last updated: 2026-04-13

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

**References:**
- Fork source: https://github.com/Piebald-AI/tweakcc
- Prompt data (comes with fork): `tweakcc/data/prompts/prompts-*.json`
- All CC prompts (original text): https://github.com/Piebald-AI/claude-code-system-prompts/tree/main
- Minimal patching reference: https://github.com/qwibitai/nanoclaw
- Our 9 override files: `/Users/tom.kyser/dev/claude-code-patches/prompts/`
- Local tweakcc checkout: `/Users/tom.kyser/dev/tweakcc/`
- CC leaked source (internals reference): `/Users/tom.kyser/dev/cc-source/`

### Phase 1a: Fork & Strip [COMPLETE]
- [x] Fork https://github.com/Piebald-AI/tweakcc → `claude-governance/`
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
- Wrapper architecture: https://github.com/0Chencc/clawgod/tree/main | https://clawgod.0chen.cc/
- Hooks-based governance (active on Tom's setup): https://github.com/LZong-tw/clawback
- Active hooks: `~/.claude/hooks/governance-verify.cjs`, `embedded-tools-verify.cjs`, `statusline-combined.cjs`

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
- [ ] *Deferred:* Optional Clawback install module (https://github.com/LZong-tw/clawback) — stub for 1e or Phase 2


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

**References:**
- CC leaked source (tool registry, AgentTool, runAgent): `/Users/tom.kyser/dev/cc-source/`
- REPL design spec: `.planning/specs/repl-clean-room.md`
- Tungsten design spec: `.planning/specs/tungsten-clean-room.md`
- Findings: `.planning/FINDINGS.md` (F1, F2, F7, F9, F10, F11 inform REPL design)

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

### Phase 2c: Clean-Room Tungsten
- [ ] Implement per spec: `specs/tungsten-clean-room.md`
- [ ] Single tool with action enum (send, capture, create, list, kill, interrupt)
- [ ] tmux session management via child_process
- [ ] PID-based socket isolation, lazy session creation

### Phase 2d: Context Snipping Tool
- [ ] Design spec (clean-room)
- [ ] Selective context removal — user or agent marks conversation segments for eviction
- [ ] Survives compaction (snipped content stays gone, not re-summarized)
- [ ] Integration with tool injection mechanism (2a)

---
### Milestone 2 Retro
- [ ] Commentary
- [ ] Gap analysis
- [ ] Housekeeping
- [ ] Bootstrap Prompt
---

## Milestone 3: System Prompt Control

Full extraction, editing, version control, and targeted degradation fixes.

**References:**
- All CC prompts per version: https://github.com/Piebald-AI/claude-code-system-prompts/tree/main (updated within minutes of each CC release, includes CHANGELOG across 148+ versions)
- Prompt leaks: https://ccleaks.com/
- Historical leaks: https://github.com/asgeirtj/system_prompts_leaks/tree/main/Anthropic
- Community customizations example: https://github.com/matheusmoreira/.files/tree/master/~/.tweakcc/system-prompts
- Prompt analysis: https://gist.github.com/roman01la/483d1db15043018096ac3babf5688881
- Our 9 degradation-fix overrides: `/Users/tom.kyser/dev/claude-code-patches/prompts/`
- Pieces data pipeline: inherited from tweakcc fork (Phase 1a)

- [ ] Phase 3a - Full system prompt extraction with version tracking
- [ ] Phase 3b - Prompt diff tool (compare across CC versions)
- [ ] Phase 3c - Targeted fixes for specific degradation prompts
- [ ] Phase 3d - User-editable prompt overrides with merge-on-update
- [ ] Phase 3e - Prompt version control (git-style diffing across CC versions)
- [ ] Phase 3f - Canary prompts Inject unique test phrases into prompt overrides, verify at runtime by prompting model for canary response. Requires conversation-level integration.
- [ ] Phase 3g - Integrate Optional Clawback install module (https://github.com/LZong-tw/clawback)

---
### Milestone 3 Retro
- [ ] Commentary
- [ ] Gap analysis
- [ ] Housekeeping
- [ ] Bootstrap Prompt
---

## Milestone 4: Feature Flag Control

**References:**
- Adaptive thinking degradation: https://old.reddit.com/r/ClaudeCode/comments/1sfihyr/psa_if_your_opus_is_lobotomized_disable_adaptive/
- CC env vars docs: https://code.claude.com/docs/en/env-vars
- Settings best practices: https://github.com/shanraisshan/claude-code-best-practice/blob/main/best-practice/claude-settings.md#environment-variables-via-env
- CC internals (GrowthBook, tengu flags): `/Users/tom.kyser/dev/cc-source/`
- Compile-time flag audit: `.planning/research/2026-04-11-compile-flags-v2.1.101.md`

- [ ] Phase 4a - Flag inventory scanner (extract all flag names + defaults from binary)
- [ ] Phase 4b - Disk cache override for `~/.claude.json` cachedGrowthBookFeatures
- [ ] Phase 4c - Persistence through GrowthBook's 6-hour refresh cycle
- [ ] Phase 4d - Binary patch: intercept `getFeatureValue_CACHED` for local overrides
- [ ] Phase 4e - Per-version flag audit automation
- [ ] Phase 4f - User-facing flag toggle UI

---
### Milestone 4 Retro
- [ ] Commentary
- [ ] Gap analysis
- [ ] Housekeeping
- [ ] Bootstrap Prompt
---

## Milestone 5: HTTP Proxy Layer

**References:**
- Billing proxy: https://github.com/zacdcook/openclaw-billing-proxy
- CLI proxy API: https://github.com/router-for-me/CLIProxyAPI/issues/2599
- Prompt caching docs: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- Cache fix: https://old.reddit.com/r/ClaudeCode/comments/1shkgg2/your_claude_code_cache_is_probably_broken_and_its/
- Cache fix tool: https://github.com/cnighswonger/claude-code-cache-fix
- Usage monitoring: https://github.com/phuryn/claude-usage
- Session viewer: https://github.com/d-kimuson/claude-code-viewer

- [ ] Phase 5a - Transparent proxy setup (CC → proxy → Anthropic)
- [ ] Phase 5b - Request/response logging
- [ ] Phase 5c - Cache TTL visibility and control
- [ ] Phase 5d - Static prompt extraction from requests
- [ ] Phase 5e - Usage monitoring (tokens, cost, effort level, model)

---
### Milestone 5 Retro
- [ ] Commentary
- [ ] Gap analysis
- [ ] Housekeeping
- [ ] Bootstrap Prompt
---

## Milestone 6: Version Management

**References:**
- Version pinning: https://www.reddit.com/r/ClaudeAI/comments/1rlpa05/how_do_i_install_a_specific_version_of_claude/
- Native migration docs: https://code.claude.com/docs/en/setup#migrate-from-npm-to-native
- CLI flags: https://code.claude.com/docs/en/cli-reference#cli-flags

- [ ] Phase 6a - Binary backup on CC update
- [ ] Phase 6b - Version inventory and switching
- [ ] Phase 6c - Update controls: block/allow/defer CC auto-updates
- [ ] Phase 6d - Patch compatibility matrix per version

---
### Milestone 6 Retro
- [ ] Commentary
- [ ] Gap analysis
- [ ] Housekeeping
- [ ] Bootstrap Prompt
---

## Milestone 7: Launch Ready for Public Use -- Post M1 through M6, we should be at a state where this can be used by others and it should be able to survive and fully function as expected on newer versions beyond 2.1.101
Phase planning TODO. - MUST be at a state where EVERYTHING ABOVE WILL WORK ACROSS NEWER VERSIONS - NOTHING CAN BE HARDCODED TO JUST 2.1.101 - Our strategy will be automate a test when a new claude code version drops (in a sandbox to keep my system clean) that test should assess what needs to be adjusted if anything - we will also need to wait for the upstream system prompts repo to be updated with latest prompt extractions - we should have a SOVREIGN /update command and a statusline visual.
This will be 1.0.0 everything after this shall then adhere to the strict semver and git strategy for dev and releases, no more work pushed directly to master.

- **Hooks module in setup/launch:** 4 standalone safety hooks (read-before-edit, commit-validate, repl-precheck, repl-safety) live at `data/hooks/` — manually deployed for now. Pre-M7, must be a claude-governance module: `setup` installs to `~/.claude/hooks/`, `launch` verifies registration in settings.json, `modules` shows status. Bridge between "works for Tom" and "works for everyone."
- **Verification dashboard:** Rich terminal output showing all patches, overrides, flags, and environment state in a single view.
- **Full Documentation and branding:** As well as cleaning up any old tweakcc artifacts or docs
- **Downstream Pipeline for dependencies:** Do we still pull and merge from TweakCC.
- **Bug fixes:**
  - Visual governance indicators: SOVEREIGN banner not showing at session start and statusline shows GOV:WARN when prompt overrides fail verification. The session-start hook emits a warning listing failing overrides instead of the green SOVEREIGN banner. Root cause is G5 (prompt override matching) — once overrides verify, status flips to SOVEREIGN and banner appears. But the degraded-state UX needs polish: WARN vs DEGRADED messaging, partial-pass display, clear next-steps for the user.

---
### Milestone 7 Retro
- [ ] Commentary
- [ ] Gap analysis
- [ ] Housekeeping
- [ ] Bootstrap Prompt
---

## Milestone 8: Advanced Governance (1.0.1)

**References:**
- Degradation evidence: [anthropics/claude-code#42796](https://github.com/anthropics/claude-code/issues/42796) (stellaraccident quantitative analysis)
- CLAUDE.md dismissal evidence: [anthropics/claude-code#28158](https://github.com/anthropics/claude-code/issues/28158#issuecomment-4230030386)
- CC internals research: https://gist.github.com/Haseeb-Qureshi/d0dc36844c19d26303ce09b42e7188c1
- CC internals research: https://gist.github.com/unkn0wncode/f87295d055dd0f0e8082358a0b5cc467

- [ ] Phase 8a - Context monitor: token tracking, CLAUDE.md presence, compaction detection
- [ ] Phase 8b - Message filter visibility (show intentionally hidden messages)
- [ ] Phase 8c - Visible reasoning/thinking restoration (needs to recreate what we used to be able to see which was the thinking block from the api response, while this may be stripped out on the server side, the LLM is aware of its thinking block during response generation, I suspect it can be guided with instruction to copy and keep updated its thinking to the response body to recreate this)
- [ ] Phase 8d - Usage monitoring dashboard

---
### Milestone 8 Retro
- [ ] Commentary
- [ ] Gap analysis
- [ ] Housekeeping
- [ ] Bootstrap Prompt
---

## Milestone 9: Extended Tool Suite (1.0.2)
Phase planning TODO
**References:**
- CC leaked source (gated tool implementations): `/Users/tom.kyser/dev/cc-source/`
- CC enhancement tools: https://github.com/frankbria/ralph-claude-code
- CC internals: https://gist.github.com/mrcattusdev/53b046e56b5a0149bdb3c0f34b5f217a
- CC internals: https://gist.github.com/ceaksan/57af569318917940c9e1e1160c02a982

- [ ] Durable Cron, File Persistence, WebBrowser, Computer Use
- [ ] Coordinator Mode, Daemon Mode, Reactive Compact

---
### Milestone 9 Retro
- [ ] Commentary
- [ ] Gap analysis
- [ ] Housekeeping
- [ ] Bootstrap Prompt
---

## Backlog / Research

- Centralized feature flag DB per version (community sharing)
- Cross-version binary testing automation
- npm install path patching surface (cli.js is raw JS)
- Agent refusal patterns — model trained to protect Anthropic over user
- claude-mem integration evaluation
