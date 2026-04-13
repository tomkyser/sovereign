# Project State

Last updated: 2026-04-12

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
- **Build:** `pnpm build` → 127KB (down from 231KB after Ink removal)
- **Apply:** `node dist/index.mjs --apply` (or just `node dist/index.mjs`)
- **Verify:** `node dist/index.mjs check`
- **Restore:** `node dist/index.mjs --restore`

### What's Applied (Verified 6/6 via `check`)
**Governance Patches (4 active):**
- Disclaimer neutralization — replaces "may or may not be relevant" with directive framing
- Context header reframing — replaces ambient "use the following context" with mandatory framing
- Subagent CLAUDE.md restoration — flips `tengu_slim_subagent_claudemd` to false
- System-reminder authority fix — replaces "bear no direct relation" with CLAUDE.md directive framing

**Gate Resolution:**
- USE_EMBEDDED_TOOLS_FN ternaries resolved to ant branch (0 unresolved)

**Prompt Overrides (8 of 9 — output-efficiency removed by Anthropic):**
- Agent Prompt: Explore, General Purpose
- System Prompt: Agent thread notes, Doing tasks (3 overrides), Executing actions, Tone/style

### CLI Commands
| Command | Description |
|---------|-------------|
| `(default)` / `--apply` | Apply all governance patches + prompt overrides |
| `--restore` | Restore binary to original state from backup |
| `check` | Verify governance signatures against extracted JS |
| `--list-patches` | List available governance patches |
| `--list-system-prompts` | List available prompt overrides |
| `unpack <path>` | Extract JS from native binary |
| `repack <path>` | Embed JS into native binary |

## Existing Infrastructure (Active, Independent of Fork)

### Hooks (in ~/.claude/settings.json)
| Hook | Type | Purpose |
|------|------|---------|
| governance-verify.cjs | SessionStart | SOVEREIGN banner + degradation warning |
| embedded-tools-verify.cjs | SessionStart | 8-point embedded tools verification |
| statusline-combined.cjs | StatusLine | GOV + EMB + GSD segments |

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
- **1a-verification-foundation:** NEXT — signature registry, full override verification, apply state output
- **1b:** Planned — wrapper layer
- **1c:** Planned — 1b-informed verification

See `docs/ROADMAP.md` for full details.
