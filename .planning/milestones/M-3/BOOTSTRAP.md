# Milestone 3 Bootstrap — System Prompt Control

---

Read these files in order:

1. `.planning/VISION.md` — Project intent
2. `.planning/milestones/M-3/IMPACT.md` — Milestone scope
3. `.planning/milestones/M-3/3prelim/HANDOFF.md` — Last completed phase handoff
4. Active phase docs (path below)

Quick verify:
```bash
cd /Users/tom.kyser/dev/claude-code-patches/claude-governance
pnpm build && node dist/index.mjs check
```

**Status:** Phase 3prelim COMPLETE — next phase TBD (GP3 research or 3a)
**Previous:** 3prelim COMPLETE — 8 tasks, 7-layer verified, 20/20 SOVEREIGN
**Last handoff:** `.planning/milestones/M-3/3prelim/HANDOFF.md`
**Baseline:** 20/20 SOVEREIGN on CC 2.1.101

**M-2 retro recommendations for M-3 (updated):**
- ~~Phase 3prelim (codebase reorganization) before adding features~~ DONE
- GP3 (Ant vs External divergence) is the core research question — do this next
- Budget for prompt testing infrastructure
- Hooks module (G21) before public release
- Maintain gap phase pattern

**What 3prelim delivered:**
- `src/patches/governance/` — 14 per-patch files (was 1184-line monolith)
- `src/patches/orchestration/` — 3 modules (was 955-line monolith)
- `src/tools/{ping,repl,tungsten}/` — all 3 tools now TypeScript with build pipeline
- `tsdown.tools.config.ts` — CJS build per tool, no shared chunks
- 7-layer verification protocol codified and proven across all tasks
