# Milestone 2 Bootstrap — Paste After Compaction

---

Read these files in order:

1. `.planning/milestones/M-2/CONTEXT.md` — Shared context (read FIRST)
2. `.planning/ROADMAP.md` — Phase status and what's next
3. `.planning/STATE.md` — Global project state
4. `.planning/milestones/M-2/handoffs/HANDOFF-PHASE-2A.md` — Latest handoff

Quick verify:
```bash
cd /Users/tom.kyser/dev/claude-code-patches/claude-governance
node dist/index.mjs check
```

**Completed:** 2a (tool injection patch, external loader, claude shim)
**Next:** 2a-gaps (binary vault, apply corruption, Zod shim, prompt overrides — 7 gaps)
**Then:** 2b (Clean-Room REPL — blocked on 2a-gaps)

**CRITICAL — read before doing anything:**
- `.planning/milestones/M-2/trackers/PHASE-2A-GAPS-TRACKER.md` — full gap list with root causes
- `.planning/journals/session-2026-04-12-c.md` — session findings, binary corruption details
