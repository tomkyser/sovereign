# Milestone 1 Retrospective — Core Engine

Date: 2026-04-12
Phases: 1a, 1a-gaps, 1a-verification-foundation, 1b, 1c, 1d, 1e (7 phases)

## What Was Delivered

A complete governance engine for Claude Code:

| Capability | Status |
|-----------|--------|
| Binary patching (4 governance patches) | 13/13 SOVEREIGN |
| Prompt override system (8 overrides) | Active, pieces-matched |
| USE_EMBEDDED_TOOLS_FN gate resolution | All gates resolved |
| Verification engine (signature-based) | Extracted API, state.json output |
| Wrapper layer (pre-flight + launch) | Process control, signal forwarding |
| Session hooks (startup + status line) | Config-aware, version-change detection |
| Module system (core + env-flags) | Registry-driven, configurable |
| NPM distribution | 2.2MB package, setup wizard, postinstall |
| CLI | apply, check, launch, modules, setup, restore, unpack, repack |

**Build:** 139KB | **Package:** 2.2MB | **Verification:** 13/13 SOVEREIGN on CC 2.1.101

---

## Deferred Items

Items explicitly scoped but deferred during M-1:

| Item | Deferred From | Disposition |
|------|--------------|-------------|
| Clawback install module | 1d | **M-2 or later.** Optional module that installs/updates Clawback hooks. Low priority — hooks are already manually deployed. |
| Canary prompts | Pinned retro | **Phase 3 (System Prompt Control).** Requires injecting unique phrases into prompt overrides and verifying at runtime via model response. Needs conversation-level integration — doesn't fit in the binary patching layer. |
| Verification dashboard | Pinned retro | **M-1 addendum candidate.** A `status` subcommand that shows rich terminal output: all patches, overrides, flags, env state, module health, hook status in a single view. Low complexity, high user value. Could be a quick addition before M-2. |
| `~/.claude-governance/` directory creation | 1a | Currently falls back to `~/.tweakcc/`. The `setup` wizard (1e) now creates the directory, but running `apply` or `check` without `setup` still uses the legacy path. |

---

## Gap Analysis — Codebase Audit

### High Priority (Fix Before M-2)

| # | Issue | File | Description |
|---|-------|------|-------------|
| H1 | Version coupling — state.json | `verification.ts:119` | `governanceVersion: '0.1.0'` hardcoded. Must read from package.json or build-time constant. State file will show wrong version after bumps. |
| H2 | Version coupling — CLI banner | `index.tsx:150` | `.version('0.1.0')` string literal. Same issue — desync on version bump. |
| H3 | Missing `require()` in setup.ts | `index.tsx:975` | `readModulesConfig()` uses `require('node:fs')` in ESM module. Works via `createRequire` shim in built output, but fragile. Should use dynamic import or top-level fsSync import. |
| H4 | Dead code — communityThemes.ts | `src/communityThemes.ts` | 53-line file never imported. Fetches community themes from GitHub — a tweakcc feature we stripped. Should delete. |

### Medium Priority (Fix During M-2)

| # | Issue | File | Description |
|---|-------|------|-------------|
| M1 | Fork naming residue — lib/ | `src/lib/config.ts`, `detection.ts`, `index.ts` | Comments reference "tweakcc", env var `TWEAKCC_CC_INSTALLATION_PATH`, example shows `import from 'tweakcc'`. Confusing for users/contributors. |
| M2 | Silent error swallowing | `startup.ts:171`, `commands.ts:266` | Empty catches with no logging. User gets no feedback when config dir creation or version detection fails. |
| M3 | Missing input validation — patch IDs | `index.tsx:223` | `--patches foo,bar,invalid` passed without validation. Invalid IDs silently do nothing. Should warn on unrecognized IDs. |
| M4 | Unsafe type casts | `index.tsx:877` | Double `as unknown as Record` cast to access governance config. Should use proper type guard or extend the config type. |
| M5 | Prompt sync verbosity during setup | `setup.ts` → `readConfigFile()` | First-run setup prints 280 prompt file creation messages. Should suppress during wizard flow. |
| M6 | No `~/.claude-governance/` creation on `apply` | `config.ts` | Running `apply` without `setup` first uses `~/.tweakcc/` forever. Should create `~/.claude-governance/` on first apply if neither exists. |

### Low Priority (Backlog)

| # | Issue | File | Description |
|---|-------|------|-------------|
| L1 | Hardcoded version in help text | `index.tsx:622,632` | Example shows `--list-system-prompts 2.1.101`. Minor UX — not a correctness issue. |
| L2 | Magic number 200000 | `nativeInstallation.ts:18` | `NIX_WRAPPER_MAX_SIZE` undocumented. Inherited from tweakcc, works correctly. |
| L3 | Missing parent dir check in unpack | `commands.ts:405` | `handleUnpack()` writes without ensuring parent dir exists. Edge case — users typically specify existing paths. |
| L4 | Missing file check in repack | `commands.ts:449` | `handleRepack()` reads without checking file exists. Same — edge case with poor error message. |

---

## Architectural Assessment

### Strengths

1. **Clean extraction pattern.** The verification engine (`verification.ts`) is properly separated from the CLI. Modules contribute verification entries declaratively. This is the right architecture for M-2 tool injection — new tools can declare their own verification contracts.

2. **Config dir resolution is centralized.** All code paths use `CONFIG_DIR` from config.ts. The 4-step fallback (env → ~/.claude-governance/ → ~/.tweakcc/ → XDG) is consistent. Hooks duplicate the logic but mirror it correctly.

3. **Module system is extensible.** Adding new modules requires: create file with `GovernanceModule`, register in `registry.ts`. No changes to verification engine or CLI framework.

4. **Non-blocking governance.** The wrapper launches CC even if governance apply fails. Setup is optional — `apply` works with zero config. This is correct for a user sovereignty tool.

### Weaknesses

1. **Fork residue.** The tweakcc fork carries significant dead weight: unused types in `types.ts` (Theme, ThinkingVerbsConfig, Toolset, etc.), migration logic for features we don't have, community theme fetching, and tweakcc naming in lib/. This inflates the codebase and confuses contributors.

2. **Synchronous config reads.** `readModulesConfig()` uses sync fs to read config.json. This blocks the event loop during CLI startup. Fine for a CLI tool, but if the lib export is used programmatically, it's a problem.

3. **No automated testing.** Zero test files exist (src/tests/ is empty after 1a-gaps cleanup). All verification is manual (`check` command + visual inspection). Phase 2 tool injection will need at least integration tests to prevent regressions.

4. **Hooks are decoupled from the package.** The three hooks (`governance-verify.cjs`, `statusline-combined.cjs`, `governance-statusline.cjs`) live in `~/.claude/hooks/`, not in the npm package. They're manually deployed. A future `setup` enhancement should offer to install/update hooks.

---

## Pinned Retro Item Evaluations

### Canary Prompts

**Verdict: Defer to Phase 3 (System Prompt Control).**

Canary prompts require: (1) injecting unique test phrases into prompt overrides, (2) prompting the model at runtime to confirm it sees the canary text, (3) interpreting the response. This is a conversation-level verification mechanism, not a binary-level one. The current verification engine checks whether text exists in the extracted JS — it can't verify whether the model actually processes it at runtime. Phase 3's system prompt extraction and editing infrastructure is the right home for this.

### Verification Dashboard

**Verdict: M-1 addendum — quick win before M-2.**

A `status` subcommand that consolidates output from `check`, `modules`, hook status, and env var state into a single view. The building blocks exist: `check` already runs verification, `modules` reports health, env-flags module reports var state. This is ~50 lines of new code combining existing data. High user value (single command to see everything), low risk, no architectural changes. Recommend adding as a pre-M-2 polish task.

---

## M-2 Readiness Assessment

**Phase 2a (Tool Injection Mechanism)** requires patching `getAllBaseTools()` in the CC binary to load external tool definitions. Readiness:

| Prerequisite | Status | Gap |
|-------------|--------|-----|
| Binary extraction + repacking | Ready | `unpack`/`repack` commands work |
| Patch system for JS injection | Ready | `governance.ts` patch pattern (find → replace) |
| Tool registry in CC binary | **Needs research** | Must locate `getAllBaseTools()` in minified JS, understand tool schema, find injection point |
| Tool definition format | **Needs research** | CC's `AgentTool` interface must be reverse-engineered from leaked source |
| Verification for injected tools | Ready | Module system can declare new verification entries |
| Hot-loadable tool dir | **Needs design** | `~/.claude-governance/tools/` — must survive binary updates |

**Blocking gaps for M-2:**
- H1 and H2 (version coupling) must be fixed before bumping to 0.2.0
- H4 (dead code) is a housekeeping task, not blocking
- No architectural blockers. The patch system, verification engine, and module architecture are all suitable for tool injection.

**Recommended pre-M-2 work:**
1. Fix H1+H2 (version coupling) — 10 min
2. Fix H4 (delete communityThemes.ts) — 1 min
3. Add `status` subcommand (verification dashboard) — 30 min
4. Fix M6 (create ~/.claude-governance/ on first apply) — 10 min

---

## Process Observations

### What Worked

- **Phased execution with <=5 files per phase.** Prevented context decay and kept commits atomic.
- **Handoff docs at phase boundaries.** Each phase started with clear context from the previous one. Critical after compaction.
- **CONTEXT.md as shared notepad.** Agents and resumed sessions could orient quickly.
- **Bootstrap prompt after compaction.** Reading CONTEXT → ROADMAP → STATE → latest handoff provided reliable re-entry.

### What Didn't Work

- **1a-gaps as a separate phase.** It was really 1a cleanup — should have been the tail end of 1a. Splitting it created an extra phase boundary with overhead for what was ~2 hours of bug fixes.
- **No automated tests.** Every verification was manual. This works at M-1 scale but won't scale to M-2 (tool injection needs regression testing).
- **Fork residue accumulation.** Each phase found more tweakcc leftovers (dead types, wrong naming, unused files) but cleanup was always deferred. The codebase has more dead weight now than it should.

### Process Improvements for M-2

1. **Add a "housekeeping" task to each phase** — 10 min of dead code cleanup per phase prevents accumulation.
2. **Write at least one integration test per phase** — even a simple `check` → 13/13 test catches regressions.
3. **Create `~/.claude-governance/` proactively** — stop relying on `~/.tweakcc/` fallback. The migration should complete, not persist.

---

## Milestone 1 Scorecard

| Dimension | Score | Notes |
|-----------|-------|-------|
| Scope completion | 10/10 | All planned phases delivered |
| Code quality | 7/10 | Works correctly, but fork residue and missing tests |
| Architecture | 9/10 | Module system, extracted verification, clean separation |
| Distribution readiness | 8/10 | NPM packaging works, but version coupling must be fixed before publish |
| Documentation | 9/10 | Handoffs, trackers, roadmap all maintained |
| Process adherence | 8/10 | Phased execution worked well, test discipline lacking |

**Overall: Strong foundation. Fix the 4 high-priority gaps, add the verification dashboard, then M-2 is unblocked.**
