# Milestone 2 Bootstrap — Paste After Compaction

---

Read these files in order:

1. `.planning/VISION.md` — Project intent
2. `.planning/milestones/M-2/IMPACT.md` — Milestone scope
3. `.planning/milestones/M-2/2c-gaps-1/HANDOFF.md` — Last completed phase handoff
4. `.planning/milestones/M-2/2c-gaps-2/PLANNING.md` — **Active phase plan**
5. `.planning/milestones/M-2/2c-gaps-2/TASKS.md` — **Active phase tasks**
6. `.planning/milestones/M-2/2c-gaps-2/CONTEXT.md` — **Active phase shared state**

Quick verify:
```bash
cd /Users/tom.kyser/dev/claude-code-patches/claude-governance
pnpm build && node dist/index.mjs check
```

**Phase:** 2c-gaps-2 — PLANNING (ready for execution)
**Previous:** 2c-gaps-1 COMPLETE — 19/19 SOVEREIGN, all live testing passed
**Scope:** Tungsten adoption — three pillars:
1. Guidance injection (PATCH 11 — "Using your tools" integration)
2. Expanded tool prompt (FS9, any-language REPL, multi-session, anti-patterns)
3. Hook enforcement (tungsten-verify.cjs — session-start verification)
**Tasks:** T1-T6 defined in TASKS.md
**Baseline:** 19/19 SOVEREIGN on CC 2.1.101
