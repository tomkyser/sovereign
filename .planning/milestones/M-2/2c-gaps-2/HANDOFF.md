# Phase 2c-gaps-2 Handoff — Tungsten Adoption

## What Was Delivered

**Tungsten-first execution posture** — Claude defaults to establishing a persistent Tungsten session at session start. Bash and REPL operate within this context automatically via FS9. Complete session lifecycle managed by hooks.

### Deliverables

| Item | Description |
|------|-------------|
| PATCH 11 (v2) | `writeTungstenToolGuidance` in governance.ts — directive in "Using your tools" establishing Tungsten as default execution context. v1→v2 upgrade path included. |
| Tool prompt reframe | tungsten.js prompt() rewritten: "Tungsten send vs Bash" (complementary layers), Session Lifecycle, FS9 Environment Propagation, any-language REPL, multi-session orchestration, anti-patterns |
| VERIFICATION_REGISTRY | `tungsten-tool-guidance` entry added. 20/20 SOVEREIGN. |
| SessionStart hook | `tungsten-verify.cjs` — 5 checks (tmux, tungsten.js, FS9/panel/guidance patches), stdout directive to create session |
| Stop hook | `tungsten-session-end.cjs` — kills tmux server via socket name, cleans state files |
| settings.json | Both hooks registered (SessionStart + Stop events) |

### Verification

- `pnpm build` — clean (170KB)
- `claude-governance check` — 20/20 SOVEREIGN
- `claude-governance --apply` on clean binary — all 20 patches applied
- SessionStart hook: stderr "Tungsten: READY (5/5)", stdout create-session directive
- Stop hook: kills real tmux session, cleans tungsten-state.json and tungsten-verify.json
- Graceful degradation without state.json: 2/2 (tmux + tool only)
- No regressions on existing 19 checks

## Key Decision

**Tungsten is the environment layer, not a Bash replacement.** Initial implementation framed Tungsten as an alternative to Bash ("use Tungsten instead of Bash"). User corrected this — Tungsten provides the persistent context that Bash operates within. The stack is Tungsten → FS9 → Bash/REPL/Agents. PATCH 11 was rewritten from recommendation to directive establishing this default posture.

## Files Changed

| File | Change |
|------|--------|
| `claude-governance/src/patches/governance.ts` | +PATCH 11 function, +VERIFICATION_REGISTRY entry |
| `claude-governance/src/patches/index.ts` | +import, +PATCH_DEFINITIONS entry, +patchImplementations wiring |
| `claude-governance/data/tools/tungsten.js` | Prompt reframe + 5 new sections |
| `~/.claude/hooks/tungsten-verify.cjs` | New — SessionStart verification + directive |
| `~/.claude/hooks/tungsten-session-end.cjs` | New — Stop hook cleanup |
| `~/.claude/settings.json` | +2 hook registrations |

## Commit

`6b6aace` — Phase 2c-gaps-2: Tungsten-first execution posture — PATCH 11 + tool prompt + lifecycle hooks

## What's Next

- **M-2 Retrospective** — Milestone 2 is feature-complete. Next: retro, gap analysis, housekeeping, then M-3.
- **PINNED:** User toggle for Tungsten panel visibility (keyboard shortcut or config flag)
- **REPL agent() bug** — "O is not a function" logged but not Tungsten-scoped
- **G24-G28** — Post-Tungsten REPL concerns (separate gap phase if needed)
