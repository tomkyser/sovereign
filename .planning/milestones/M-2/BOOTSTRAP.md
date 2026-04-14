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

**Completed:** 2a (tool injection), 2a-gaps (12/12), 2b (clean-room REPL), 2b-gaps (14/14 + 2 post-testing fixes), 2b-gaps-2 (G15 + G9/G11 tests), 2b-gaps-3 (8/8 gaps + replace mode hardening)
**Current:** 2c (Clean-Room Tungsten) — RESEARCHED & SCOPED, ready to implement
**Then:** 2d (Context Snipping Tool)

**CRITICAL — read before doing anything:**
- `.planning/milestones/M-2/CONTEXT.md` — Has full 2c research findings, binary symbol map, 6 deliverables
- `.planning/specs/tungsten-clean-room.md` — Tungsten design spec v0.2 (informational, scope has evolved beyond this)
- `.planning/journals/session-2026-04-13-b.md` — Research session with key decisions and findings
- `.planning/FINDINGS.md` — F1 (tool registry), F10 (return shapes), F11 (delegation), F17 (parentMessage), F18 (shell snapshot)
- `.planning/milestones/M-2/handoffs/HANDOFF-PHASE-2B-GAPS.md` — verification pattern that 2c MUST follow

**Key context for 2c (6 deliverables, nothing deferred):**
- **D1: tungsten.js** — Drop in `data/tools/`, auto-discovery loader picks it up. 6 actions (send/capture/create/list/kill/interrupt). Socket isolation via `claude-<PID>`.
- **D2: FS9() binary patch** — `function FS9(){return null}` → returns our socket info. Activates bashProvider tmux passthrough for ALL Bash calls including REPL's bash().
- **D3: Render tree injection** — Replace `!1,null` (unique sig: `cn7(O_)))),!1,null,b_.createElement(m,{flexGrow:1})`) with createElement loading our panel component. Pass React (b_), useAppState (Y_), Box (m), Text (L) as props.
- **D4: tungsten-panel.js** — Clean-room TungstenLiveMonitor. Reads AppState via passed useAppState prop, renders tmux capture-pane output.
- **D5: Statusline + hooks** — TNG segment, session cleanup on exit, tungsten-state.json.
- **D6: REPL prompt update** — Tungsten awareness in both coexist and replace prompts.

**Implementation order:** D1 (tool) → D2 (FS9 patch, highest risk) → D3+D4 (UI injection) → D5+D6 (polish)
- `deployTools()` reads from source `data/tools/` dir — .js changes deploy without rebuild
- TypeScript changes in `src/` need `pnpm build`
- tmux 3.5a available on this machine
