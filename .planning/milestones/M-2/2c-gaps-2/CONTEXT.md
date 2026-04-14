# Phase 2c-gaps-2 Context — Tungsten Adoption

## Phase Scope

Three pillars:
1. **Guidance injection** — PATCH 11 in governance.ts, injecting Tungsten guidance into "Using your tools" array (same approach as PATCH 8 REPL guidance)
2. **Tool prompt expansion** — tungsten.js prompt() expanded with FS9 propagation, any-language REPL, multi-session, anti-patterns, panel, cross-tool interactions
3. **Hook enforcement** — tungsten-verify.cjs SessionStart hook checking tmux, tool deployment, patch presence

## Current Tungsten Infrastructure (from 2c-gaps-1)

**Patches applied (in VERIFICATION_REGISTRY):**
- `tungsten-fs9`: FS9() reads `__CLAUDE_GOVERNANCE_TMUX_ENV` → bashProvider sets TMUX env
- `tungsten-panel`: `__tungsten_panel__` IIFE in React render tree
- `repl-tool-guidance`: PATCH 8, `could one REPL call do this` in "Using your tools"

**Tool:**
- `data/tools/tungsten.js` — 6 actions, PID-isolated tmux socket, AppState for panel, state file for hooks
- Deployed via tool loader (`__claude_governance_tools__` signature in binary)

**FS9 chain (verified 2c-gaps-1):**
Tungsten `discoverSocketInfo()` → `process.env.__CLAUDE_GOVERNANCE_TMUX_ENV` → FS9() patch in binary → bashProvider `getEnvironmentOverrides()` → `env.TMUX` on all Bash child processes → REPL `bash()` inherits → Agents inherit via `process.env`

**Verification baseline:** 19/19 SOVEREIGN on CC 2.1.101

## Key Files

| File | Role |
|------|------|
| `claude-governance/src/patches/governance.ts` | PATCH 11 injection + VERIFICATION_REGISTRY |
| `claude-governance/data/tools/tungsten.js` | Tool prompt expansion |
| `~/.claude/hooks/tungsten-verify.cjs` | New SessionStart hook |
| `~/.claude/hooks/governance-verify.cjs` | Reference hook pattern |
| `~/.claude/hooks/embedded-tools-verify.cjs` | Reference hook pattern |

## Technical Constraints

- PATCH 11 must detect post-PATCH-8 state (REPL element already in the array)
- Patches apply sequentially in `applyPatchImplementations` — PATCH 8 runs before PATCH 11
- Hook execution order is alphabetical: governance-verify < tungsten-verify (correct dependency order)
- tungsten-verify reads governance state.json — must degrade gracefully if absent

## What This Phase Does NOT Cover

- User toggle for panel visibility (PINNED in ROADMAP — future work)
- REPL `agent()` runtime bug ("O is not a function" — REPL gap, not Tungsten)
- Post-Tungsten REPL concerns G24-G28 (separate gap phase)
- M-2 retrospective (after this phase)
