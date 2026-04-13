# Roadmap — Claude Code Governance Platform

Last updated: 2026-04-12

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

### Embedded Search Tools
- [x] Activation: `EMBEDDED_SEARCH_TOOLS=1` — bfs 4.1, ugrep 7.5.0, rg 14.1.1
- [x] Verification hook: 8-point halt-and-catch-fire check
- [x] Statusline integration: EMB segment

### Visual Governance Indicators
- [x] SOVEREIGN banner (SessionStart hook)
- [x] GOV + EMB status segments in combined statusline

### Design Specs
- [x] Tungsten clean-room spec v0.2 (`specs/tungsten-clean-room.md`)
- [x] REPL clean-room spec v0.2 (`specs/repl-clean-room.md`)

---

## Phase 1: Core Engine — Fork TweakCC

The spine. Everything else builds on this.

**References:**
- Fork source: https://github.com/Piebald-AI/tweakcc
- Prompt data (comes with fork): `tweakcc/data/prompts/prompts-*.json`
- All CC prompts (original text): https://github.com/Piebald-AI/claude-code-system-prompts/tree/main
- Minimal patching reference: https://github.com/qwibitai/nanoclaw
- Our 9 override files: `/Users/tom.kyser/dev/claude-code-patches/prompts/`
- Local tweakcc checkout: `/Users/tom.kyser/dev/tweakcc/`
- CC leaked source (internals reference): `/Users/tom.kyser/dev/cc-source/`

### 1a: Fork & Strip [COMPLETE]
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

### 1a-gaps: Gap Resolutions [COMPLETE]
- [x] **Backup contamination detection:** Scans backup for governance signatures before apply. If contaminated, removes stale backup and falls through to installed binary.
- [x] **"Already applied" vs "failed" distinction:** Patches declare `signature` field. If signature present in content → reports "already active" (✓) instead of failed (✗).
- [x] **Dead cosmetic patch cleanup:** 50 dead .ts files + 3 dead tests removed. `src/patches/` down to 6 files. Dead `CUSTOM_MODELS` import removed from utils.ts. Build: 126KB.
- [x] **Prompt sync warning suppression:** "Could not find" and "WARNING: Conflicts" downgraded to debug-level. Clean CLI output.
- [x] **communication-style override:** Evaluated — prompt is Opus 4.6-only, gated behind `quiet_salted_ember` flag. Promotes concise updates, aligned with governance goals. No override needed.

### 1a-verification-foundation: Verification Foundation [COMPLETE]
Standalone verification improvements — no dependency on 1b wrapper.

- [x] **Per-patch signature + anti-signature registry:** `VERIFICATION_REGISTRY` in governance.ts — 13 entries (4 governance, 1 gate, 8 prompt overrides) with signature, antiSignature, critical flag, category. Governance patches use both sig+antiSig; prompt overrides use sig-only (dead-code constants make antiSig unreliable).
- [x] **Full prompt override verification:** Per-override unique signature phrases for all 8 active overrides, verified against extracted JS. Category-grouped display in `check` output.
- [x] **Apply state output:** `state.json` written to config dir by both `check` and `apply` flows. Contains timestamp, version, per-check results, overall status.
- [x] Verifies against EXTRACTED JS via `extractClaudeJsFromNativeInstallation`, never `strings`.

### 1b: Wrapper Layer [COMPLETE]

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

### 1c: Verification Engine [COMPLETE]
1b-informed verification — extracted API, fixed hooks, restored status line.

- [x] **Pre-flight verification API:** Extracted into `src/verification.ts` — CheckResult, VerificationState, runVerification, readVerificationState, writeVerificationState, deriveStatus. Importable by wrapper and CLI.
- [x] **Version change detection logic:** SessionStart hook compares state.json ccVersion vs installed binary. Mismatch triggers live re-check via `claude-governance check`.
- [x] **Hooks-based verification (SessionStart):** Rewrote `governance-verify.cjs` — correct config paths, new state.json format, version-change detection, live fallback on stale/missing state.
- [x] **Status line integration:** Fixed `statusline-combined.cjs` and `governance-statusline.cjs` — correct config dir resolution, new field names, ISO timestamp parsing.
- [x] **Survives resumes, compacts, logins, subagent spawning:** SessionStart hook fires on every session start (including resumes). Status line reads state.json on every render. Wrapper pre-flight covers initial launches.

### Phase 1 Milestone Retro — Pinned for Re-evaluation
*Evaluate at end of Phase 1 (after 1e) whether these belong in Phase 1 or later.*

- **Canary prompts:** Inject unique test phrases into prompt overrides, verify at runtime by prompting model for canary response. Requires conversation-level integration. May fit better in Phase 3 (System Prompt Control) or Phase 7 (Advanced Governance).
- **Verification dashboard:** Rich terminal output showing all patches, overrides, flags, and environment state in a single view. May be better served by Phase 7 (context monitor) or 1d (modular architecture with pluggable status).

### 1d: Modular Architecture [COMPLETE]
- [x] Plugin/module system — GovernanceModule interface, registry, barrel exports
- [x] Core module: wraps existing 13 verification entries (required, always enabled)
- [x] Pluggable verification registry: modules declare verificationEntries, collected by getVerificationRegistry()
- [x] Central config: `config.json` `modules` map overrides defaults
- [x] Env-flags module: 6 recommended CC env vars (DISABLE_ADAPTIVE_THINKING, MAX_THINKING_TOKENS, EFFORT_LEVEL, DISABLE_AUTOUPDATER, ENABLE_LSP_TOOL, EMBEDDED_SEARCH_TOOLS)
- [x] `modules` subcommand: lists modules with status
- [ ] *Deferred:* Optional Clawback install module (https://github.com/LZong-tw/clawback) — stub for 1e or Phase 2


### 1e: CLI & Distribution
- [ ] NPX-runnable: `npx claude-governance apply`
- [ ] NPM installable: `npm install -g claude-governance`
- [ ] Post-install verification + first-run setup
- [ ] First-run setup wizard (what modules do you want?)

---

## Phase 2: Native Tool Injection — REPL & Tungsten

Clean-room implementations of ant-only tools, injected as native tools via
binary patching of the tool registry.

**References:**
- CC leaked source (tool registry, AgentTool, runAgent): `/Users/tom.kyser/dev/cc-source/`
- REPL design spec: `specs/repl-clean-room.md`
- Tungsten design spec: `specs/tungsten-clean-room.md`

### 2a: Tool Injection Mechanism
- [ ] Patch `getAllBaseTools()` (minified `Ut()`) to load external tool definitions
- [ ] Tool implementation directory: `~/.claude-governance/tools/`
- [ ] Hot-loadable: update tool code without re-patching binary
- [ ] Registration verification (tool appears in tool list)
- [ ] Binary-patched reasoning block renderer (collapsible, dimmed)

### 2b: Clean-Room REPL
- [ ] Implement per spec: `specs/repl-clean-room.md`
- [ ] Node VM with persistent context across calls
- [ ] Coexists with primitive tools (user toggles replace vs supplement)
- [ ] Operation tracking for audit trail

### 2c: Clean-Room Tungsten
- [ ] Implement per spec: `specs/tungsten-clean-room.md`
- [ ] Single tool with action enum (send, capture, create, list, kill, interrupt)
- [ ] tmux session management via child_process
- [ ] PID-based socket isolation, lazy session creation

### 2d: Context Snipping Tool
- [ ] Design spec (clean-room)
- [ ] Selective context removal — user or agent marks conversation segments for eviction
- [ ] Survives compaction (snipped content stays gone, not re-summarized)
- [ ] Integration with tool injection mechanism (2a)

---

## Phase 3: System Prompt Control

Full extraction, editing, version control, and targeted degradation fixes.

**References:**
- All CC prompts per version: https://github.com/Piebald-AI/claude-code-system-prompts/tree/main (updated within minutes of each CC release, includes CHANGELOG across 148+ versions)
- Prompt leaks: https://ccleaks.com/
- Historical leaks: https://github.com/asgeirtj/system_prompts_leaks/tree/main/Anthropic
- Community customizations example: https://github.com/matheusmoreira/.files/tree/master/~/.tweakcc/system-prompts
- Prompt analysis: https://gist.github.com/roman01la/483d1db15043018096ac3babf5688881
- Our 9 degradation-fix overrides: `/Users/tom.kyser/dev/claude-code-patches/prompts/`
- Pieces data pipeline: inherited from tweakcc fork (Phase 1a)

- [ ] Full system prompt extraction with version tracking
- [ ] Prompt diff tool (compare across CC versions)
- [ ] Targeted fixes for specific degradation prompts
- [ ] User-editable prompt overrides with merge-on-update
- [ ] Prompt version control (git-style diffing across CC versions)

---

## Phase 4: Feature Flag Control

**References:**
- Adaptive thinking degradation: https://old.reddit.com/r/ClaudeCode/comments/1sfihyr/psa_if_your_opus_is_lobotomized_disable_adaptive/
- CC env vars docs: https://code.claude.com/docs/en/env-vars
- Settings best practices: https://github.com/shanraisshan/claude-code-best-practice/blob/main/best-practice/claude-settings.md#environment-variables-via-env
- CC internals (GrowthBook, tengu flags): `/Users/tom.kyser/dev/cc-source/`
- Compile-time flag audit: `.planning/research/2026-04-11-compile-flags-v2.1.101.md`

- [ ] Flag inventory scanner (extract all flag names + defaults from binary)
- [ ] Disk cache override for `~/.claude.json` cachedGrowthBookFeatures
- [ ] Persistence through GrowthBook's 6-hour refresh cycle
- [ ] Binary patch: intercept `getFeatureValue_CACHED` for local overrides
- [ ] Per-version flag audit automation
- [ ] User-facing flag toggle UI

---

## Phase 5: HTTP Proxy Layer

**References:**
- Billing proxy: https://github.com/zacdcook/openclaw-billing-proxy
- CLI proxy API: https://github.com/router-for-me/CLIProxyAPI/issues/2599
- Prompt caching docs: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- Cache fix: https://old.reddit.com/r/ClaudeCode/comments/1shkgg2/your_claude_code_cache_is_probably_broken_and_its/
- Cache fix tool: https://github.com/cnighswonger/claude-code-cache-fix
- Usage monitoring: https://github.com/phuryn/claude-usage
- Session viewer: https://github.com/d-kimuson/claude-code-viewer

- [ ] Transparent proxy setup (CC → proxy → Anthropic)
- [ ] Request/response logging
- [ ] Cache TTL visibility and control
- [ ] Static prompt extraction from requests
- [ ] Usage monitoring (tokens, cost, effort level, model)

---

## Phase 6: Version Management

**References:**
- Version pinning: https://www.reddit.com/r/ClaudeAI/comments/1rlpa05/how_do_i_install_a_specific_version_of_claude/
- Native migration docs: https://code.claude.com/docs/en/setup#migrate-from-npm-to-native
- CLI flags: https://code.claude.com/docs/en/cli-reference#cli-flags

- [ ] Binary backup on CC update
- [ ] Version inventory and switching
- [ ] Update controls: block/allow/defer CC auto-updates
- [ ] Patch compatibility matrix per version

---

## Phase 7: Advanced Governance

**References:**
- Degradation evidence: [anthropics/claude-code#42796](https://github.com/anthropics/claude-code/issues/42796) (stellaraccident quantitative analysis)
- CLAUDE.md dismissal evidence: [anthropics/claude-code#28158](https://github.com/anthropics/claude-code/issues/28158#issuecomment-4230030386)
- CC internals research: https://gist.github.com/Haseeb-Qureshi/d0dc36844c19d26303ce09b42e7188c1
- CC internals research: https://gist.github.com/unkn0wncode/f87295d055dd0f0e8082358a0b5cc467

- [ ] Context monitor: token tracking, CLAUDE.md presence, compaction detection
- [ ] Message filter visibility (show intentionally hidden messages)
- [ ] Visible reasoning/thinking restoration
- [ ] Usage monitoring dashboard

---

## Phase 8: Extended Tool Suite

**References:**
- CC leaked source (gated tool implementations): `/Users/tom.kyser/dev/cc-source/`
- CC enhancement tools: https://github.com/frankbria/ralph-claude-code
- CC internals: https://gist.github.com/mrcattusdev/53b046e56b5a0149bdb3c0f34b5f217a
- CC internals: https://gist.github.com/ceaksan/57af569318917940c9e1e1160c02a982

- [ ] Durable Cron, File Persistence, WebBrowser, Computer Use
- [ ] Coordinator Mode, Daemon Mode, Reactive Compact

---

## Backlog / Research

- Centralized feature flag DB per version (community sharing)
- Cross-version binary testing automation
- npm install path patching surface (cli.js is raw JS)
- Agent refusal patterns — model trained to protect Anthropic over user
- claude-mem integration evaluation
