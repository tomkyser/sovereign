# Milestone 2 Gaps — Native Tool Injection

Last updated: 2026-04-14

## Summary

M-2 closed 40+ gaps across 10 phases, delivering tool injection, clean-room REPL,
clean-room Tungsten, and Tungsten-first execution posture. 20/20 SOVEREIGN on CC 2.1.101.

The gaps below are items identified during M-2 that were explicitly deferred, designed
but not built, or discovered late and scoped out. They are categorized by urgency and
natural home (which milestone should own the fix).

---

## Outstanding Gaps

### PINNED — Flagged for Retro Evaluation

| ID | Description | Origin | Recommendation |
|----|-------------|--------|----------------|
| GP1 | **User toggle for Tungsten panel** — keyboard shortcut or config flag to show/hide the live Tungsten panel in the TUI. Panel currently renders whenever a session is active with no way to dismiss it. | 2c-gaps-2 | M-3 or standalone mini-phase. Config flag in `config.json` (`tungsten.panelVisible`) + potential keybind if CC's Ink tree exposes input handling. Low complexity. |
| GP2 | **REPL `agent()` runtime bug** — "O is not a function" when a REPL-spawned subagent calls bash(). The REPL→Agent→Bash path has a tool runtime initialization issue. Top-level Agent→Bash works fine. Logged in REPL-IMPROVEMENTS.md and F25. | 2c-gaps-1 | M-4 (REPL re-eval). This is a minification artifact in the subagent tool runtime — likely a function reference that doesn't survive the REPL→agent delegation boundary. Needs binary-level investigation. |
| GP3 | **Ant vs External prompt divergence assessment** — Haseeb analysis [haseebAnalysis1] documents 6+ quality-of-output improvements Anthropic withholds from external users (misconception correction, hallucination prevention, conciseness enforcement, adversarial review, prompt A/B, isUndercover). Full assessment needed: which can we replicate via prompt overrides, which require binary patching. | 2c-gaps-2 | M-3 (System Prompt Control). This IS the core research question for M-3. Already documented in ROADMAP.md M-3 header. |

### REPL Gaps (from 2b-gaps-3) — Deferred Post-Tungsten

| ID | Description | Origin | Recommendation |
|----|-------------|--------|----------------|
| G24 | **Functional probe in replace mode** — Replace mode has no runtime probe equivalent to coexist mode's `claude -p` Ping test. Replace mode filters primitives, so the probe would need to exercise REPL-delegated operations. | 2b-gaps-3 | M-4. Design a REPL-specific probe that validates the full delegation chain (REPL→Read, REPL→Bash, etc.) in replace mode. |
| G25 | **Coexist nudging (prompt effectiveness)** — In coexist mode, the model sometimes uses individual tools when REPL would be more efficient. The prompt guides but doesn't enforce. | 2b-gaps-3 | M-4. Evaluate whether hook-level enforcement (intercepting repetitive single-tool calls) or stronger prompt language shifts behavior. |
| G26 | **Oversized result labeling** — When REPL truncates large results (at `maxResultSize`), the truncation marker is plain text. Could include byte count, file path, or hint to re-read with offset. | 2b-gaps-3 | M-4. Minor UX improvement. Enhance truncation marker with actionable context. |
| G27 | **CLI mode switch command** — No `claude-governance` subcommand to switch between coexist and replace mode. Users must edit `config.json` manually. | 2b-gaps-3 | M-3 or M-4. Add `claude-governance repl-mode [coexist|replace]` subcommand. Low complexity. |
| G28 | **Coexist prompt parity with replace** — Replace mode prompt has comprehensive "primitive tool guidance" section. Coexist mode prompt has less guidance on when to prefer REPL over individual tools. | 2b-gaps-3 | M-4. Bring coexist prompt up to the same level of decisiveness as replace, while preserving the "model chooses" philosophy. |

### Infrastructure Gaps — Designed but Not Built

| ID | Description | Origin | Recommendation |
|----|-------------|--------|----------------|
| G21 | **Hooks module** — Full design exists in 2b-gaps-3 tracker. Module would deploy `.cjs` hooks from `data/hooks/` to `~/.claude/hooks/`, register in `settings.json`, verify in check/launch. Would eliminate manual hook management. | 2b-gaps-3 | Pre-M7 (as pinned). This becomes critical before public release — users shouldn't manually copy hook files. |
| G22 | **Duplicate hooks migration** — Covered by G21 design. Detects GSD/third-party duplicate hooks and offers to clean up during `apply()`. | 2b-gaps-3 | Same as G21. |

### UX Gaps

| ID | Description | Origin | Recommendation |
|----|-------------|--------|----------------|
| BT1 | **SOVEREIGN banner not showing** — Session-start hook emits warning listing failing overrides instead of green banner. Root cause: prompt override verification failures. Degraded-state UX needs polish (WARN vs DEGRADED messaging, partial-pass display, clear next-steps). | BUGTRACKER | M-3. Prompt override verification is M-3's domain. Polish the degraded-state UX alongside the prompt control work. |

### Deferred Features

| ID | Description | Origin | Recommendation |
|----|-------------|--------|----------------|
| DF1 | **Binary-patched reasoning block renderer** — Collapsible, dimmed reasoning blocks in terminal output. | 2a | M-5+ or standalone. Nice-to-have visual improvement, not governance-critical. |
| DF2 | **Optional Clawback install module** — Stub exists in module system. Would integrate Clawback hooks as a governance module. | 1d | M-3 (Phase 3g in ROADMAP). Already scoped. |

---

## Gap Statistics

| Category | Count | Closed in M-2 | Remaining |
|----------|-------|---------------|-----------|
| Pinned (retro) | 3 | 0 | 3 |
| REPL (post-Tungsten) | 5 | 0 | 5 |
| Infrastructure | 2 | 0 | 2 |
| UX | 1 | 0 | 1 |
| Deferred features | 2 | 0 | 2 |
| **Total outstanding** | **13** | — | **13** |
| **Closed during M-2** | **40+** | **40+** | — |

---

## Disposition

No gaps are M-2 blockers. The milestone is feature-complete at 20/20 SOVEREIGN.
All outstanding gaps have natural homes in M-3, M-4, or pre-release infrastructure work.
GP3 (Ant vs External divergence) is the most strategically important — it defines M-3's scope.
