# Phase 2c-gaps-2 Planning — Tungsten Adoption

## Phase Goal

Make Tungsten a first-class citizen that Claude understands and uses correctly. After this phase, Claude should:
- Know when to reach for Tungsten over Bash without being told
- Understand the FS9 environment propagation chain and its implications
- Use persistent sessions for stateful work by default
- Have session-start verification that Tungsten infrastructure is intact

## Scope Alignment

**Phase → Milestone:** This closes the Tungsten adoption gap identified in ROADMAP 2c-gaps-2. The ROADMAP pinned requirement — "Claude needs to be instructed to use and understand tungsten and we need to enforce it with hooks" — is the direct target.

**Milestone → Project:** Tungsten is the last major M-2 deliverable. After this, M-2 enters retro. Tungsten adoption directly serves the project vision: tools that Anthropic gates behind `USER_TYPE === 'ant'` should work for paying users, and the model should know how to use them.

**PINNED item (user toggle for panel):** Out of scope for this phase. This is a UI feature that requires keyboard shortcut binding in the TUI. Noted and preserved.

## Approach — Three Pillars

### Pillar 1: Guidance Injection (PATCH 11)

**What:** Inject Tungsten guidance into the "Using your tools" array, same approach as PATCH 8 (REPL).

**Implementation:**
- New function `writeTungstenToolGuidance` in governance.ts (follows `writeReplToolGuidance` pattern)
- Same detection target: `sequentially instead."].filter(...)` array closing
- Inject AFTER the REPL element (order: existing elements, REPL guidance, Tungsten guidance, then `"].filter(...)`)
- Guidance text (~2 sentences): when to use Tungsten over Bash, persistent state model, environment inheritance
- New VERIFICATION_REGISTRY entry: `tungsten-tool-guidance` with signature from the guidance text
- Register in `applyPatchImplementations` as PATCH 11

**Signature candidate:** A unique phrase from the guidance text, e.g. `persistent terminal sessions where environment` or similar — must not collide with tool prompt text.

**Risk:** The injection point now has two elements being added (REPL + Tungsten). The REPL element modifies the `sequentially instead."]` string to `sequentially instead.","<REPL text>"]`. Tungsten must detect the post-REPL state (with REPL text already present) and inject after it. OR: both inject independently by targeting the same original string. Need to verify the patch application order in `applyPatchImplementations`.

**Mitigation:** Check application order. If PATCH 8 runs before PATCH 11, PATCH 11's detector must match the post-PATCH-8 state. If they run in parallel (they don't — sequential in `applyPatchImplementations`), need atomic detection.

### Pillar 2: Expanded Tool Prompt

**What:** Expand tungsten.js `prompt()` to cover all missing capabilities.

**Implementation — add these sections to prompt():**

1. **Environment Propagation** — After "Notes" or as a new section: explain the FS9 chain. Once Tungsten creates a session, Bash commands inherit TMUX env. REPL's `bash()` inherits. Subagents inherit. This means state set in Tungsten (env vars, running servers) is visible to all subsequent tool calls.

2. **Any-Language REPL Pattern** — New pattern: `python3`, `psql`, `node`, `irb` as persistent interactive sessions via Tungsten send/capture.

3. **Multi-Session Orchestration** — New pattern: named sessions for parallel workstreams with a monitoring workflow (capture each, act on results).

4. **Anti-Patterns** — New section: don't use for one-shot commands, don't accumulate sessions without killing, don't capture before sending (empty terminal), don't use Tungsten when you need exit codes (use Bash).

5. **Panel Mention** — Brief note: when a session is active, a panel appears in the TUI showing session state.

6. **Cross-Tool Interactions** — Brief note: agents spawned during a Tungsten session inherit the tmux environment via process.env.

### Pillar 3: Hook Enforcement

**What:** SessionStart hook verifying Tungsten readiness.

**Implementation:**
- New file: `~/.claude/hooks/tungsten-verify.cjs`
- Checks:
  1. tmux binary available (`which tmux`)
  2. tungsten.js exists at expected path (governance tool dir or deployed location)
  3. FS9 patch present (read governance state.json → check `tungsten-fs9` entry)
  4. Panel patch present (read governance state.json → check `tungsten-panel` entry)
  5. Tool guidance patch present (read governance state.json → check `tungsten-tool-guidance` entry)
- State written to `~/.claude-governance/tungsten-verify.json`
- Banner to stderr: "TUNGSTEN READY" / "TUNGSTEN DEGRADED"
- Warning to stdout (Claude sees): only on failure

**Key decision:** This hook depends on governance-verify having run first (for state.json). Hook execution order in CC is alphabetical by filename. `governance-verify.cjs` < `tungsten-verify.cjs` alphabetically — natural ordering is correct.

### Pillar 4: Verification Registry Update

**What:** Ensure all new Tungsten entries are in VERIFICATION_REGISTRY.

**Implementation:**
- Add `tungsten-tool-guidance` entry (PATCH 11 signature)
- Verify existing `tungsten-fs9` and `tungsten-panel` entries are still accurate
- Update `check` command output if needed

## Risks

1. **Patch ordering** — PATCH 11 must account for PATCH 8 having already modified the injection point. If both target the same original string, the second will fail to match.
2. **Prompt length** — Expanding tungsten.js prompt() increases token count per session. Must be concise — guidance, not documentation.
3. **Hook dependency** — tungsten-verify depends on governance state.json. If governance-verify fails or is absent, tungsten-verify degrades gracefully (skip patch checks, still verify tmux).

## Success Criteria

- Claude uses Tungsten for stateful work without explicit instruction
- `claude-governance check` reports Tungsten guidance injection as SOVEREIGN
- Session-start hook verifies tmux + patches and renders banner
- Tool prompt covers FS9 propagation, multi-session, anti-patterns
- All existing 19/19 SOVEREIGN checks still pass (no regressions)
