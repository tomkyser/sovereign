# Milestone 3.5 Bootstrap — P3-GAP (Component Override Verification)

---

**Status:** P3-GAP-REPL COMPLETE — one gap phase remaining (P3-GAP)
**SOVEREIGN:** 32/32
**Next:** P3-GAP (component override verification — 6 tasks)

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

## What's Done
- **P3-GAP-REPL** — COMPLETE. Two binary patches:
  - repl-visibility.ts: isAbsorbedSilently false in zJ6() — REPL visible in collapsed groups
  - repl-transcript.ts: D_8() bypass — REPL preserved in --resume transcripts
  - TUI verified, resume verified, 32/32 SOVEREIGN

## What's Next: P3-GAP (Component Override Verification)
> This gap phase exists because T18/T20 were rubber-stamped without behavioral verification.
> No component override has EVER rendered in the TUI.

- T-GAP-1: Verify handler signature matches binary injection code (oOY/sOY)
- T-GAP-2: Write a real component override (e.g., thinking block custom render)
- T-GAP-3: Test override end-to-end in TUI
- T-GAP-4: Ship verified default overrides in data/components/
- T-GAP-5: Correct docs/README.md to match verified handler signature
- T-GAP-6: Document update resilience (what survives CC updates, what doesn't)
- T-GAP-7: Export mandatory env vars in shim shell script (process-level, not settings.json)
- T-GAP-8: Add CLAUDE_CODE_REPL=1 to env overrides
- T-GAP-9: Merge RECOMMENDED_ENV into launch command's launchEnv
- T-GAP-10: Verify env vars present in running CC process

## Key Context for P3-GAP
- Override system: `globalThis.__govMessageOverrides` / `__govContentOverrides` registries
- Binary injection points: oOY() (message renderer), sOY() (content block renderer)
- User JS in `~/.claude-governance/components/` gets React refs + message data
- defaults.js is currently an empty IIFE returning empty override registries
- Handler signature in docs/README.md is UNVERIFIED against actual binary injection
- CC source components (389 files, 9.3MB) too coupled for extract-and-edit

## Build & Verify
```bash
cd claude-governance && pnpm build
/bin/cp ~/.claude-governance/native-binary.backup ~/.local/share/claude/versions/2.1.101
node claude-governance/dist/index.mjs -a
node claude-governance/dist/index.mjs check   # Target: 32/32 SOVEREIGN
```
