# Project State

Last updated: 2026-04-14

## Current Claude Code Version
- **Installed:** 2.1.101 (native, arm64-darwin)
- **Binary:** `~/.local/share/claude/versions/2.1.101` (191MB Mach-O)
- **Auto-updater:** Disabled (`DISABLE_AUTOUPDATER=1`)

## Current Patching: claude-governance (Phase 1a Complete)

All governance patches and prompt overrides applied by `claude-governance` —
our fork of tweakcc with cosmetic patches stripped, Ink/React UI removed,
and governance-specific `check` command added.

- **Fork location:** `/Users/tom.kyser/dev/claude-code-patches/claude-governance/`
- **Based on:** tweakcc 4.0.11 (full fork, fresh git)
- **Config dir:** `~/.claude-governance/` (falls back to `~/.tweakcc/` for migration)
- **Build:** `pnpm build` → 153KB | **Package:** 2.2MB (npm pack)
- **Apply:** `node dist/index.mjs --apply` (or just `node dist/index.mjs`)
- **Verify:** `node dist/index.mjs check`
- **Restore:** `node dist/index.mjs --restore`

### What's Applied (Verified 20/20 via `check`)
**Governance Patches (5 active):**
- Disclaimer neutralization — replaces "may or may not be relevant" with directive framing
- Context header reframing — replaces ambient "use the following context" with mandatory framing
- Subagent CLAUDE.md restoration — flips `tengu_slim_subagent_claudemd` to false
- System-reminder authority fix — replaces "bear no direct relation" with CLAUDE.md directive framing
- Tungsten tool guidance — Tungsten-first execution posture directive in "Using your tools"

**Gate Resolution:**
- USE_EMBEDDED_TOOLS_FN ternaries resolved to ant branch (0 unresolved)

**Tool Injection:**
- getAllBaseTools() patched to load external tools from `~/.claude-governance/tools/index.js`
- Loader fills TOOL_DEFAULTS, tools use inputJSONSchema (standard JSON Schema, no Zod)
- Sample Ping tool deployed for runtime testing

**Prompt Overrides (8 of 9 — output-efficiency removed by Anthropic):**
- Agent Prompt: Explore, General Purpose
- System Prompt: Agent thread notes, Doing tasks (3 overrides), Executing actions, Tone/style

### CLI Commands
| Command | Description |
|---------|-------------|
| `(default)` / `--apply` | Apply all governance patches + prompt overrides |
| `launch [-- args]` | Pre-flight verify + launch CC (wrapper mode) |
| `--restore` | Restore binary to original state from backup |
| `check` | Verify 14 governance signatures against extracted JS |
| `modules` | List governance modules and their status |
| `setup` | First-run wizard — module selection, apply, verify |
| `--list-patches` | List available governance patches |
| `--list-system-prompts` | List available prompt overrides |
| `unpack <path>` | Extract JS from native binary |
| `repack <path>` | Embed JS into native binary |

## Existing Infrastructure (Active, Independent of Fork)

### Hooks (in ~/.claude/settings.json)
| Hook | Type | Purpose |
|------|------|---------|
| governance-verify.cjs | SessionStart | SOVEREIGN banner + degradation warning (reads state.json, version-change detection, live fallback) |
| embedded-tools-verify.cjs | SessionStart | 8-point embedded tools verification |
| tungsten-verify.cjs | SessionStart | Tungsten readiness (5 checks: tmux, tool, FS9/panel/guidance patches) + create-session directive |
| tungsten-session-end.cjs | Stop | Kill tmux server, clean tungsten state files |
| statusline-combined.cjs | StatusLine | GOV + EMB + GSD segments (config dir resolution, new state.json format) |

### Environment Variables (in settings.json env)
| Var | Value | Purpose |
|-----|-------|---------|
| EMBEDDED_SEARCH_TOOLS | 1 | Activate bfs/ugrep/rg pipeline |
| ENABLE_LSP_TOOL | 1 | IDE-grade code navigation |
| DISABLE_AUTOUPDATER | 1 | Pin version for stable patching |
| CLAUDE_CODE_MAX_OUTPUT_TOKENS | 128000 | Max output |
| MAX_THINKING_TOKENS | 128000 | Max thinking |
| CLAUDE_CODE_EFFORT_LEVEL | max | Maximum effort |
| CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING | 1 | No thinking throttling |

## Phase Status

- **1a:** COMPLETE — fork, strip, governance patches, check command
- **1a-gaps:** COMPLETE — contamination detection, already-applied, dead file cleanup, warning suppression
- **1a-verification-foundation:** COMPLETE — 13-entry registry, per-override verification, state.json
- **1b:** COMPLETE — launch subcommand, pre-flight verification, process control
- **1c:** COMPLETE — verification API extraction, hook rewrite, status line fix
- **1d:** COMPLETE — module system, core + env-flags modules, modules CLI
- **1e:** COMPLETE — npm packaging, setup wizard, postinstall welcome
- **M-1 Retro:** COMPLETE — 18 gaps fixed, canary→Phase 3, dashboard→deferred
- **2a:** COMPLETE — tool injection patch, external tool loader, transparent claude shim
- **2a-gaps:** COMPLETE — 12/12 gaps closed. 15/15 SOVEREIGN on 2.1.101
- **2b:** COMPLETE — clean-room REPL (auto-discovery loader, 9 handlers, coexist/replace modes). Post-testing fixes: replace mode stash, state persistence, IIFE fallback, defensive extraction.
- **2b-gaps:** COMPLETE — 14/14 gaps + 2 post-testing fixes (parentMessage F17, IIFE script-source). User benchmark: 6.5/7 handlers functional.
- **2b-gaps-2:** COMPLETE — G15 already working (F18), G9-test/G11-test prompt effectiveness verified
- **2b-gaps-3:** COMPLETE — G16-G23 + replace mode hardening. Glob .gitignore fix, catch-all pattern fix, mode-aware prompts (coexist/replace), comprehensive replace prompt with primitive tool guidance, binary patch strengthened. Replace mode verified: Sonnet fresh session, single-prompt dashboard.
- **2c:** COMPLETE — Clean-Room Tungsten. 6 deliverables: tungsten.js tool, FS9 binary patch, render tree injection, live panel, statusline TNG, REPL prompt update. 19/19 SOVEREIGN.
- **2-PM-update:** COMPLETE — PM restructuring + project rename. REFERENCES.md (35 refs), per-phase directories (14 phases), milestone docs (IMPACT/FINDINGS/GAPS/RETROSPECTIVE), CLAUDE.md lifecycle (6-step phase + milestone), TASKS.md sync protocol, PLANNING.md bidirectional scope, milestone CONTEXT.md archived to artifacts. Project renamed to claude-governance, GitHub repo renamed.
- **2c-gaps-1:** COMPLETE — 11 gaps (G29-G40) closed. Panel crash fix, restore/apply vault wiring, verification honesty, FS9 verified, tungsten.js robustness, panel setAppState fix. All verified in live TUI session. 19/19 SOVEREIGN.
- **2c-gaps-2:** COMPLETE — Tungsten-first execution posture. PATCH 11 (v2) directive in "Using your tools", tool prompt reframe (complementary layers + lifecycle), SessionStart/Stop lifecycle hooks. 20/20 SOVEREIGN.
- **M-2 Retro:** COMPLETE — 10 phases evaluated. 13 outstanding gaps catalogued (GAPS.md). Key outcome: GP3 (Ant vs External divergence) defines M-3 scope. Phase 3prelim (codebase reorg) recommended first.

### Binary Vault (from 2a-gaps)
- **Module:** `src/binaryVault.ts` — XDG path discovery, GCS download, SHA256 verification, immutable locking
- **Virgin:** `~/.claude-governance/binaries/virgin-{version}.bin` — always fresh download, locked
- **Working:** `~/.claude-governance/binaries/working-{version}.bin` — apply operates here
- **Binary-safe copy:** `/bin/cp` (unix), `copy /b` (win32) — NEVER Node.js fs
- **Shim failsafe:** Exit 111 + fallback to direct CC launch + UNPROTECTED banner

See `.planning/ROADMAP.md` for full details.
