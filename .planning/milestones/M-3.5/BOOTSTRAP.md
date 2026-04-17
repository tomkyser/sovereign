# Milestone 3.5 Bootstrap — P3 Gap Phases Active

---

**Status:** P3 INCOMPLETE — two gap phases blocking closure
**SOVEREIGN:** 32/32
**Next:** P3-GAP-REPL (REPL TUI visibility), then P3-GAP (component overrides)

## Read First
`.planning/VISION.md`
`.planning/ROADMAP.md (492 - 641)`

THEN
1. `.planning/milestones/M-3.5/3.5d-message-components/HANDOFF.md`
2. `.planning/milestones/M-3.5/3.5d-message-components/CONTEXT.md`
3. `.planning/milestones/M-3.5/3.5d-message-components/TASKS.md`
4. `.planning/STATE.md`

5. `.planning/milestones/M-2/RETROSPECTIVE.md`
6. `.planning/milestones/M-3.5/FINDINGS.md`
7. `.planning/milestones/M-3.5/3.5d-message-components/P3-RESEARCH.md`
8. `.planning/project-managment/phase-steps/3.md`
9. `.planning/project-managment/phase-steps/5.md`


## DO NOT MAKE ASSUMPTIONS - Resources to read on demand (not now! but remember that you can!):
`.planning/REFERENCES.md`
`docs/*` (Careful, verify anything you read, may be wrong or outdated)
`.planning/journals/*`

## Why Gap Phases Exist
P3 tasks T18 (default component overrides) and T20 (API docs) were rubber-stamped
as complete without behavioral verification. The component override system was built
but never tested end-to-end. Additionally, REPL tool calls are invisible in the TUI
due to Anthropic's collapseReadSearch absorption mechanism.

## Priority Order
1. **P3-GAP-REPL** — Fix REPL visibility first (higher impact, user-reported)
   - Patch isAbsorbedSilently in zJ6() from true→false for REPL
   - T-REPL-2 SKIPPED: env flag CLAUDE_CODE_REPL=1 handles isReplModeEnabled
   - Patch transcript transform to preserve REPL calls
   - TUI verify + resume verify
2. **P3-GAP** — Component override verification (6 tasks)
   - Verify handler signature matches binary injection
   - Write and test a real override end-to-end in TUI
   - Ship verified defaults, correct docs

## Key Findings
- CLAUDE_CODE_REPL=1 env flag enables sets isReplModeEnabled() to true (see: `/Users/tom.kyser/dev/cc-source/collection-claude-code-source-code/original-source-code/src/tools/REPLTool/constants.ts`) but does NOT fix TUI visibility
- CC source components (389 files) are too coupled for extract-and-edit approach
- Override system architecture is correct — intercept at renderer dispatch level
- isAbsorbedSilently is the root cause of REPL invisibility in TUI

## Build & Verify
```bash
cd claude-governance && pnpm build
/bin/cp ~/.claude-governance/native-binary.backup ~/.local/share/claude/versions/2.1.101
node claude-governance/dist/index.mjs -a
node claude-governance/dist/index.mjs check   # Target: 30+/30+ SOVEREIGN
```
