# Phase 2c-gaps-2 Tasks — Tungsten Adoption

## T1: Tungsten guidance injection — PATCH 11
**Status:** TODO
**Files:** `claude-governance/src/patches/governance.ts`

Write `writeTungstenToolGuidance` function following PATCH 8 pattern. Inject Tungsten guidance into "Using your tools" array. Must detect post-PATCH-8 state (REPL element already inserted). Add VERIFICATION_REGISTRY entry `tungsten-tool-guidance`. Register in `applyPatchImplementations`.

Guidance text: when to use Tungsten (persistent state, long-running processes, stateful shell), environment inheritance to Bash/REPL/agents, session lifecycle.

## T2: Expand tungsten.js tool prompt
**Status:** TODO
**Files:** `claude-governance/data/tools/tungsten.js`

Add to prompt():
- FS9 environment propagation explanation (Tungsten → FS9 → bashProvider → Bash/REPL/agents)
- Any-language REPL pattern (python3, psql, node in persistent sessions)
- Multi-session orchestration pattern (named sessions, monitoring workflow)
- Anti-patterns section (no one-shot, no session accumulation, no capture-before-send, use Bash for exit codes)
- Panel mention (TUI panel when session active)
- Cross-tool interaction notes (agents inherit tmux env)

## T3: Tungsten verification hook
**Status:** TODO
**Files:** `~/.claude/hooks/tungsten-verify.cjs` (new)

SessionStart hook checking:
1. tmux availability
2. tungsten.js deployment
3. FS9 patch presence (from governance state.json)
4. Panel patch presence (from governance state.json)
5. Tool guidance patch presence (from governance state.json)

State → `~/.claude-governance/tungsten-verify.json`. Banner to stderr, warning to stdout on failure. Graceful degradation if governance state.json absent.

## T4: Verification registry update
**Status:** TODO
**Files:** `claude-governance/src/patches/governance.ts`

Add `tungsten-tool-guidance` entry to VERIFICATION_REGISTRY. Verify existing `tungsten-fs9` and `tungsten-panel` entries still match after changes. Ensure `check` command reports all Tungsten entries.

## T5: Integration testing
**Status:** TODO
**Files:** various

Verify end-to-end:
- `pnpm build` succeeds in claude-governance
- `claude-governance check` reports 20/20 (or n+1) SOVEREIGN
- `claude-governance apply` injects Tungsten guidance into binary
- Hook fires on session start and renders banner
- Tool prompt visible in session (tool description shows full content)
- No regressions on existing 19/19 checks

## T6: Prompt override file review
**Status:** TODO
**Files:** `prompts/` directory

Review existing 9 prompt override files. Determine if any need Tungsten-related updates (e.g., `system-prompt-doing-tasks-no-additions.md` or `agent-prompt-general-purpose.md`). If Tungsten guidance is fully handled by PATCH 11 injection + tool prompt, no override changes needed. Document decision.
