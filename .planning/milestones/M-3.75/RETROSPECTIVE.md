# Milestone 3.75 Retrospective — RALPH

**Completed:** 2026-04-17
**Duration:** Single session
**SOVEREIGN:** 32/32 (no regression)

## Deliverables

| # | Deliverable | Phase | Status |
|---|------------|-------|--------|
| 1 | UserPromptSubmit hook (Layer 0 cognitive redirect) | P1 | ✅ Shipped |
| 2 | PreToolUse REPL checkpoint (RALPH enforcement) | P2 | ✅ Shipped |
| 3 | Agent dispatch patterns documentation | P3 | ✅ Documented |
| 4 | Execution pattern library | P4 | ✅ Documented |
| 5 | Integration test suite (10 Layer 0 + 10 REPL tests) | P5 | ✅ All pass |

## Artifacts Produced

| Artifact | Location | Type |
|----------|----------|------|
| ralph-layer0.cjs | ~/.claude/hooks/ | UserPromptSubmit command hook |
| ralph-repl-checkpoint.cjs | ~/.claude/hooks/ | PreToolUse REPL command hook |
| settings.json | ~/.claude/ | Two hook entries added |
| PATTERNS.md (agent dispatch) | .planning/milestones/M-3.75/P3-agent-dispatch/ | Reference doc |
| PATTERNS.md (execution) | .planning/milestones/M-3.75/P4-execution-patterns/ | Reference doc |
| RESULTS.md (test matrix) | .planning/milestones/M-3.75/P5-integration-testing/ | Test results |

## Key Decisions

1. **Command hooks, not prompt hooks** — `"type": "prompt"` hooks send text to a
   separate Haiku model for yes/no evaluation. Not suitable for reasoning scaffolds.
   Both RALPH hooks use `"type": "command"` with `additionalContext` output.

2. **Model classifies, not hook** — The Layer 0 hook doesn't try to detect trivial
   queries lexically (too error-prone). The prompt includes Tier 1 fast-path
   instructions and the model decides its own classification.

3. **Confirmations skip entirely** — "yes", "do it", slash commands produce zero
   hook output. No overhead for workflow confirmations.

4. **Smart bash detection** — Read-only bash commands (cat, ls, git log) don't
   trigger RALPH checkpoint. Mutating commands (npm build, rm) do.

## What Worked

1. **Binary research before building** — Finding that prompt hooks use Haiku saved
   us from building the wrong thing. 30 minutes of research prevented a dead end.

2. **Incremental testing** — Testing each hook in -p mode first (fast feedback),
   then interactive mode (real verification). Both modes confirmed.

3. **Self-referential validation** — The RALPH checkpoint fires on this session's
   own REPL calls, providing continuous proof of correct behavior.

4. **Single-session completion** — All 5 phases in one session. The hook-based
   approach (vs. binary patching) enabled this velocity.

## What Didn't Work

1. **`script -q` for TUI capture** — Worked for -p mode output but CC interactive
   session exited after one response when wrapped in script. Direct tmux capture
   was more reliable for interactive testing.

2. **Shell escaping in test harness** — Testing hooks via inline echo + pipe lost
   escaping for complex JSON. File-based input (`cat file | hook`) was reliable.

3. **Initial lexical trivial detection** — First version fast-pathed "fix the display"
   (3 words, matched prefix) but this is actually ambiguous and should get the full
   scaffold. Fixed by removing lexical detection entirely.

## Findings

| Finding | Impact |
|---------|--------|
| "type": "prompt" hooks use separate Haiku model | Changed entire approach — command hooks with additionalContext instead |
| UserPromptSubmit has no existing hooks in any config | Clean namespace — no composition conflicts |
| additionalContext injection creates hook_additional_context messages | Proven mechanism, same as SessionStart hooks |
| Model reliably follows HALT/END/HERE/DELTA when scaffolded | Core hypothesis validated |
| Model correctly fast-paths Tier 1 without ceremony | No overhead concern for simple queries |
| Interactive mode shows classification in thinking | Full visibility into RALPH reasoning |

## Pinned Items for Future Work

1. **Longitudinal metrics** — First-pass success rate (>85% target), context
   efficiency (≤50% tool calls), and training effect require multi-session
   observation across real projects.

2. **RALPH for other tools** — Currently only REPL gets the checkpoint. Could
   extend to Edit/Write for complex multi-file edits.

3. **Session-stage adaptation** — The Layer 0 prompt fires on every message.
   Over long sessions, could reduce to a reminder after N messages if the model
   has internalized the pattern.

4. **claude-governance integration** — RALPH hooks are currently standalone files.
   Could be managed by `claude-governance setup` for version tracking and
   automatic installation.
