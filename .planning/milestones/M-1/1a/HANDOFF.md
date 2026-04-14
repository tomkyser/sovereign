# Phase 1a + 1a-gaps Handoff

Written: 2026-04-12 (final — both phases COMPLETE)

## STATUS: COMPLETE — 6/6 SOVEREIGN

## What Was Done

### Phase 1a: Fork & Strip
1. Forked tweakcc → `claude-governance/`, fresh git
2. Stripped 40+ cosmetic patches from registry
3. Stripped Ink/React UI (126KB from 320KB)
4. Added 5 governance patches in `src/patches/governance.ts`
5. Added USE_EMBEDDED_TOOLS_FN gate resolution
6. Added `check` subcommand (6-point signature verification)
7. Updated package identity (claude-governance@0.1.0)
8. Config dir: `~/.claude-governance/` with `~/.tweakcc/` fallback
9. 8 prompt overrides via pieces matching (output-efficiency removed by Anthropic)

### Phase 1a-gaps: Gap Resolutions
1. Backup contamination detection — scans for governance signatures, auto-removes stale
2. "Already applied" detection — signature field on patches, reports ✓ not ✗
3. Dead file cleanup — 50 patch files + 3 tests removed, dead import fixed
4. Prompt sync warning suppression — downgraded to debug-level
5. communication-style evaluation — no override needed (aligned with governance)

### Housekeeping
- Repo published to GitHub as `sovereign` (https://github.com/tomkyser/sovereign)
- Reference dirs (cc-source, tweakcc, clawback) moved out of repo to `/Users/tom.kyser/dev/`
- Project restructured into `.planning/` hierarchy
- Rigid process codified in CLAUDE.md (15-step per-phase checklist)
- Journal filenames corrected to real dates

## Verification Results (6/6 SOVEREIGN)
- ✓ Disclaimer Neutralization — active
- ✓ Context Header Reframing — active
- ✓ System-Reminder Authority Fix — active
- ✓ Subagent CLAUDE.md Restoration — active (flag=false)
- ✓ Embedded Tools Gate Resolution — all gates resolved
- ✓ Prompt Override Signatures — spot-check phrases present

## Key Files
| File | Purpose |
|------|---------|
| `claude-governance/src/index.tsx` | CLI entry point |
| `claude-governance/src/patches/index.ts` | Patch orchestrator |
| `claude-governance/src/patches/governance.ts` | 5 governance patches + contamination detection |
| `claude-governance/src/config.ts` | Config dir resolution |
| `.planning/ROADMAP.md` | Phase status |
| `.planning/milestones/M-1/CONTEXT.md` | Shared agent context |

## What's Next
**1a-verification-foundation** — standalone verification improvements:
- Per-patch signature + anti-signature registry
- Full prompt override verification (all 8, not spot-check)
- Apply state output (~/.claude-governance/state.json)

Then: 1b (wrapper), 1c (1b-informed verification), 1d (modular), 1e (distribution)

## What NOT To Do
- Do NOT use patched pieces data — must be original unpatched text
- Do NOT verify with `strings` — use extracted JS via `unpack`
- Do NOT reference `~/.tweakcc/` as runtime dependency
- Do NOT skip CONTEXT.md when spawning agents
