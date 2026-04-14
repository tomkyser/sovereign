# Milestone 2 Bootstrap — Paste After Compaction

---

Read these files in order:

1. `.planning/milestones/M-2/IMPACT.md` — Milestone scope and phase impact
2. `.planning/ROADMAP.md` — Phase status and what's next
3. `.planning/STATE.md` — Global project state
4. `.planning/FINDINGS.md` — Architecture-informing discoveries (F1-F21)
5. `.planning/milestones/M-2/2c/HANDOFF.md` — Phase 2c handoff

Quick verify:
```bash
cd /Users/tom.kyser/dev/claude-code-patches/claude-governance
pnpm build && node dist/index.mjs check
```

**Completed:** 2a, 2a-gaps (12/12), 2b (clean-room REPL), 2b-gaps (14/14 + 2 post-testing fixes), 2b-gaps-2 (G15 + G9/G11 tests), 2b-gaps-3 (8/8 gaps + replace mode hardening), 2c (clean-room Tungsten — 6 deliverables, 19/19 SOVEREIGN), 2-PM-update (PM restructuring)
**Next:** 2c-gaps-1 (Tungsten gaps), then 2d (Context Snipping)
**Then:** Milestone 2 Retro

**Post-Tungsten gaps (from 2b-gaps-3):** G24-G28 — functional probe in replace mode, coexist nudging, oversized labeling, CLI mode switch, coexist prompt parity.

**PM restructuring (2-PM-update):**
- New structure: per-phase directories under milestone (e.g., `M-2/2c/HANDOFF.md`)
- REFERENCES.md for all external URLs — cite by ID
- Milestone-level: IMPACT.md, FINDINGS.md, GAPS.md, RETROSPECTIVE.md
- Phase-level: TRACKER.md, CONTEXT.md, PLANNING.md, RESEARCH.md, TASKS.md, HANDOFF.md
