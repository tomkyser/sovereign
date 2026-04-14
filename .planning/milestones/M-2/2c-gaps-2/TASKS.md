# Phase 2c-gaps-2 Tasks — Tungsten Adoption

## T1: Tungsten guidance injection — PATCH 11
**Status:** COMPLETE
**Files:** `claude-governance/src/patches/governance.ts`
**Commit:** 6b6aace

Wrote `writeTungstenToolGuidance` with v1→v2 upgrade path. Directive framing: "A Tungsten session is established at the start of every work session." v1 was "use Tungsten instead of Bash" (incorrect framing — Tungsten is the environment layer, not a Bash alternative). v2 establishes Tungsten-first posture with FS9 inheritance explanation. Includes regex-based v1 upgrade path for binaries with stale guidance.

## T2: Expand tungsten.js tool prompt
**Status:** COMPLETE
**Files:** `claude-governance/data/tools/tungsten.js`
**Commit:** 6b6aace

Reframed from "When to Use Tungsten vs Bash" to "Tungsten send vs Bash" — complementary layers, not alternatives. Added: Session Lifecycle (create first, kill last), FS9 Environment Propagation, Any-language REPL pattern, Multi-session orchestration, Anti-patterns (session accumulation, capture-before-send, exit codes, skip session creation), panel mention, agent inheritance.

## T3: Tungsten verification hook + lifecycle hooks
**Status:** COMPLETE
**Files:** `~/.claude/hooks/tungsten-verify.cjs`, `~/.claude/hooks/tungsten-session-end.cjs`, `~/.claude/settings.json`
**Commit:** 6b6aace

SessionStart hook: 5 checks (tmux, tungsten.js, FS9/panel/guidance patches), graceful degradation when state.json absent (skips patch checks, still verifies tmux+tool). Stdout directive to Claude: create session as first action. Stop hook: kills tmux server via socket name from tungsten-state.json, cleans state files. Both registered in settings.json.

## T4: Verification registry update
**Status:** COMPLETE (merged into T1)
**Files:** `claude-governance/src/patches/governance.ts`, `claude-governance/src/patches/index.ts`
**Commit:** 6b6aace

Added `tungsten-tool-guidance` to VERIFICATION_REGISTRY (signature: "Tungsten session is established at the start of every work session"), PATCH_DEFINITIONS, and patchImplementations. Existing `tungsten-fs9` and `tungsten-panel` entries verified unchanged.

## T5: Integration testing
**Status:** COMPLETE

- `pnpm build` — clean (170KB)
- `claude-governance check` — 20/20 SOVEREIGN
- `claude-governance --apply` on clean binary — all 20 patches applied
- SessionStart hook: stderr "Tungsten: READY (5/5)", stdout directive to create session
- Stop hook: tested with real tmux session, kills server, cleans state files
- Graceful degradation: 2/2 without state.json (patch checks skipped)
- v1→v2 upgrade: old guidance replaced in-place
- No regressions on existing 19 checks

## T6: Prompt override file review
**Status:** COMPLETE — no changes needed

Reviewed all 9 prompt override files. Only `system-prompt-agent-thread-notes.md` mentions Bash (line 9: "Bash tool resets to cwd between calls") — factually accurate, not conflicting. PATCH 11 guidance + expanded tool prompt provide complete coverage for all agents via system prompt inheritance.
