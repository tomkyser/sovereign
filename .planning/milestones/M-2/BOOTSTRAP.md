# Milestone 2 Bootstrap — Paste After Compaction

---

Read these files in order:

1. `.planning/milestones/M-2/CONTEXT.md` — Shared context (read FIRST)
2. `.planning/ROADMAP.md` — Phase status and what's next
3. `.planning/STATE.md` — Global project state
4. `.planning/FINDINGS.md` — Architecture-informing discoveries (F1-F16)
5. `.planning/milestones/M-2/handoffs/HANDOFF-PHASE-2B-GAPS.md` — Phase 2b-gaps handoff

Quick verify:
```bash
cd /Users/tom.kyser/dev/claude-code-patches/claude-governance
pnpm build && node dist/index.mjs check
```

**Completed:** 2a (tool injection), 2a-gaps (12/12), 2b (clean-room REPL), 2b-gaps (14/14 + 2 post-testing fixes), 2b-gaps-2 (G15 + G9/G11 tests)
**Next:** 2b-gaps-3 (REPL Coexist Hardening — G16-G23)
**Then:** 2c (Clean-Room Tungsten), 2d (Context Snipping Tool)

**CRITICAL — read before doing anything:**
- `.planning/specs/tungsten-clean-room.md` — Tungsten design spec v0.2
- `.planning/milestones/M-2/handoffs/HANDOFF-PHASE-2B-GAPS-2.md` — REPL production readiness (latest handoff)
- `.planning/milestones/M-2/handoffs/HANDOFF-PHASE-2B-GAPS.md` — verification pattern that 2c MUST follow
- `.planning/FINDINGS.md` — F1 (tool registry access), F10 (return shapes), F11 (delegation pattern), F18 (shell snapshot) inform Tungsten

**Key context for 2c:**
- Auto-discovery loader handles tool deployment — just drop a `tungsten.js` in `data/tools/`
- Tool injection mechanism (2a) is battle-tested across 2b+2b-gaps
- Verification pattern established in 2b-gaps: functional probe, module validation, hook/statusline, state.json
- `deployTools()` reads from source `data/tools/` dir — .js changes deploy without rebuild
- TypeScript changes in `src/` need `pnpm build`
