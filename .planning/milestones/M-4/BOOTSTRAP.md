# Milestone 4 Bootstrap — Version Management

---

**Status:** NOT STARTED — milestone initiation required
**SOVEREIGN:** 32/32
**Previous:** M-3.75 COMPLETE (RALPH cognitive redirect framework)

## Milestone Initiation Checklist

### Step 1: Research
- [ ] Read `VISION.md` — ground in project intent
- [ ] Read `.planning/STATE.md` and `.planning/ROADMAP.md` — verify global state
- [ ] Read M-3.75 `RETROSPECTIVE.md` — carry forward lessons and pinned items
- [ ] Read M-3.75 `GAPS.md` — check for gaps that affect M-4
- [ ] Create `M-4/IMPACT.md` — scope impact to project and vision
- [ ] Assess: what CC update patterns exist? How does auto-update work?
- [ ] Research CC version inventory on this machine

### Step 2: Phase Planning
- [ ] Break 4Prelim into concrete tasks
- [ ] Create phase directory structure
- [ ] Update ROADMAP.md with refined task list

### Step 3: Execute 4Prelim, then iterate through phases

## What This Milestone Is

Version management for Claude Code governance. The goal is resilience across CC
updates — patches, tools, prompts, hooks, and env flags should survive or
gracefully degrade when Anthropic ships a new CC version.

Key challenge: the binary changes on every update. Pattern matching must be
version-aware. Backup/restore must be atomic.

## Read First

`.planning/VISION.md`
`.planning/STATE.md`
`.planning/ROADMAP.md` (M-4 section)
`.planning/milestones/M-3.75/RETROSPECTIVE.md` (lessons, pinned items)
`.planning/milestones/M-3.75/GAPS.md` (gap analysis)
`.planning/FINDINGS.md` (F32-F34 RALPH findings)

## Pinned Items from M-3.75

1. **Longitudinal RALPH metrics** — track first-pass success rate, context
   efficiency, training effect during M-4 work
2. **RALPH uninstall path** — test `unregisterHooksFromSettings()` before ship
3. **Component override timing** — `__govReactRefs` during init (from M-3.5)
4. **`--apply` should regenerate shim** (from M-3.5)

## Build & Verify
```bash
cd claude-governance && pnpm build
node claude-governance/dist/index.mjs check   # Target: 32/32 SOVEREIGN
```
