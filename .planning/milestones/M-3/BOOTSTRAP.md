# Milestone 3 Bootstrap — System Prompt Control

---

Read these files in order:

1. `.planning/VISION.md` — Project intent
2. `.planning/milestones/M-3/IMPACT.md` — Milestone scope
3. `.planning/milestones/M-3/GP3/RESEARCH.md` — GP3 research (the core findings)
4. `extracted-prompts/IMPROVEMENT-FRAMEWORK.md` — Issue registry and priority ranking
5. Active phase docs (path below)

Quick verify:
```bash
cd /Users/tom.kyser/dev/claude-code-patches/claude-governance
pnpm build && node dist/index.mjs check
```

**Status:** Phase GP3 COMPLETE — next: P0 investigations (quiet_salted_ember, dynamic boundary audit)
**Previous:** GP3 COMPLETE — 112 findings, 62 issues, 14 extracted prompts
**Last completed:** GP3 research at `b2839d2`
**Baseline:** 20/20 SOVEREIGN on CC 2.1.101

**GP3 key findings:**
- **3-tier gating system** in binary: DCE (build-time), GrowthBook/wJH (runtime), feature flags
- **`quiet_salted_ember`** — GrowthBook flag + Opus 4.6 check unlocks improved prompts already in binary
- **`tengu_hive_evidence`** — GrowthBook flag gates VERIFICATION_AGENT (full implementation in binary)
- **2/12 divergences covered** by existing overrides; 10 gaps remain
- **62 issues registered** (I-001..I-098) with quality dimensions, categories, fix classes
- **4 cross-cutting patterns:** thinking depth, lossy context, undermined authority, token economics

**P0 investigations for next session:**
1. **I-040: quiet_salted_ember** — Find where `clientDataCache` is stored. If in `~/.claude.json`, one flag flip unlocks 7 improvements
2. **I-097: Dynamic boundary audit** — Verify our prompt overrides land BEFORE `SYSTEM_PROMPT_DYNAMIC_BOUNDARY`. If after, our patches break prompt cache every turn
3. **Identify exactly what we currently fix vs what quiet_salted_ember would gain us**
4. **what is needed to enable this:** tengu_hive_evidence

**PM1(new) Create Investigation Table in ROADMAP** 
1. copy over and format all items for investigation that resulted from the research previously to an Investigation table at the top of roadmap's body before milestones.
2. be sure to include all items, this is a shortened example: **I-064: Verify thinking depth env vars** — Confirm `EFFORT_LEVEL=max` + `DISABLE_ADAPTIVE_THINKING=1` are effective
3. Complete and comprehensive developer documentation for everything we have done so far and how to use it, in /docs, absolute verification of truth at every layer is required. No assumptions whatsoever. Add pointer to the new docs in CLAUDE.md Steps.
  a. it is essential that you and possibly other developers know how everything we have done and built works, so while we are building it you don't have to relearn everything from code every context wipe.

**P1 prompt overrides to write (6 new):**
- Communication Style (G1) — replace "Output efficiency"
- Misconception correction (P1) — add to "Doing tasks"
- False-claims mitigation (P2) — add to "Doing tasks"
- Thoroughness counterweight (P4) — add to "Doing tasks"
- Context decay awareness (PA-009) — new section
- Priority hierarchy clarification (PA-012) — new section

**Extracted prompts:** `extracted-prompts/` has 14 files with all wJH-gated, DCE'd, and external prompt text verified against virgin binary

**M-2 retro recommendations for M-3 (updated):**
- ~~Phase 3prelim (codebase reorganization)~~ DONE
- ~~GP3 (Ant vs External divergence)~~ DONE — defines M-3 scope
- Budget for prompt testing infrastructure
- Hooks module (G21) before public release
- Maintain gap phase pattern
