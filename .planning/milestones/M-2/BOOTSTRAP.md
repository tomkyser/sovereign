# Milestone 2 Bootstrap — Paste After Compaction

---

Read these files in order:

1. `.planning/milestones/M-2/CONTEXT.md` — Shared context (read FIRST)
2. `.planning/ROADMAP.md` — Phase status and what's next
3. `.planning/STATE.md` — Global project state
4. `.planning/FINDINGS.md` — Architecture-informing discoveries (F1-F16)
5. `.planning/milestones/M-2/handoffs/HANDOFF-PHASE-2B.md` — Phase 2b handoff

Quick verify:
```bash
cd /Users/tom.kyser/dev/claude-code-patches/claude-governance
pnpm build && node dist/index.mjs check
```

**Completed:** 2a (tool injection), 2a-gaps (12/12), 2b (clean-room REPL + 4 post-testing bugfixes)
**Next:** 2b-gaps (REPL Hardening + Functional Verification — 14 gaps)
**Then:** 2c (Clean-Room Tungsten), 2d (Context Snipping Tool)

**CRITICAL — read before doing anything:**
- `.planning/ROADMAP.md` Phase 2b-gaps section — full gap list with severity and descriptions
- `.planning/FINDINGS.md` — F12-F16 are all from this session's gap-closing, inform 2b-gaps design
- `.planning/journals/session-2026-04-13-d.md` — latest: 2b implementation + gap-closing test battery + honest assessment

**Key context for 2b-gaps:**
- Functional verification (G1-G6) is the priority — violates project vision (halt-and-catch-fire)
- `claude -p` headless mode can be used for runtime functional probes
- notebook_edit (G7) arg mapping is broken — needs schema probe via `claude -p` context inspection
- IIFE fallback (G10) is too greedy — any SyntaxError triggers it, not just return/await
- Tom's replace mode test failed because he didn't rebuild (TypeScript changes need `pnpm build`)
- `deployTools()` reads from source `data/tools/` dir — tool .js changes deploy without rebuild
- Verification pattern established here must carry to 2c (Tungsten) and 2d (Context Snip)

**Post-testing fix commits (already pushed):**
- `0358f47` Replace mode stash + defensive result handling
- `512cab7` State persistence + realm-safe SyntaxError + state object
- `a6461d6` return works in sync scripts — IIFE fallback on any SyntaxError
