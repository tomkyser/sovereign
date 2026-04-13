# Session Journal — 2026-04-12

Continued from session-journal-2025-07-12-b.md (post-compaction restart).

## Session Context

Third session on the claude-code-patches project. Previous sessions established research,
governance patches, embedded tools activation, design specs. This session received Tom's
full compiled notes/outline and executed Phase 1a of the core engine.

## Key Decisions

### 1. Full Vision Dump → Roadmap Restructure
Tom dumped comprehensive project goals. Scope expanded from "patch governance issues" to
a full governance platform with 8 major systems: wrapper/CLI, patching engine, HTTP proxy,
tool suite, version manager, feature flag control, monitoring, prompt editor. Roadmap
restructured from flat P0-P7 to phased architecture.

### 2. Fork TweakCC, Don't Rebuild
Confirmed approach: fork tweakcc, keep the solid binary I/O and minified identifier
detection, gut the React/Ink UI and cosmetic patches, carry over governance fixes.
Resulted in 12 TypeScript source files with 7 runtime deps (vs tweakcc's 13).

### 3. Modular Distribution
NPM packages, user chooses what modules they want. "Who are we to decide for them?"

### 4. Prompt Override Architecture — Never Hardcode Matching
Tom emphasized: "we are playing a game of chess against Ant, and the minified binary is
the game board." All matching uses multi-detector strategy: pieces-based regex (high
confidence) → semantic anchor proximity (medium) → structural fallback (low). No single
exact-text match is ever the only path.

### 5. Visible Reasoning — Keep Personal, Don't Ship
Tom discovered he could convince Claude to reproduce reasoning in output via CLAUDE.md.
After discussion: keep as personal config, don't bake into public package. The project's
credibility rests on "local software control" not "server-side circumvention." Tom will
write up as responsible disclosure for eventual Anthropic application. Format: blockquote
with italic header. Binary-patched collapsible renderer pinned for Phase 2.

### 6. Verification Expands Per Phase
Verification engine designed as extensible — not a hardcoded checklist. Each phase adds:
- 1b wrapper: pre-flight checks before CC launch
- 1c modular: pluggable registry, modules declare own verification contracts
- 1d distribution: post-install verification

## Files Created

### claude-governance/ (NEW PROJECT)
| File | Purpose |
|------|---------|
| `package.json` | Project metadata, 7 runtime deps |
| `tsconfig.json` | TypeScript strict config |
| `src/types.ts` | All type definitions |
| `src/utils.ts` | Debug, file I/O, version comparison |
| `src/binary.ts` | Bun binary extract/repack (Mach-O/ELF/PE) |
| `src/content.ts` | Read/write JS content abstraction |
| `src/detection.ts` | Simplified CC installation detection |
| `src/patches/helpers.ts` | Minified identifier detection |
| `src/patches/governance.ts` | 5 governance patch definitions |
| `src/patches/prompts.ts` | 2 prompt overrides with pieces+semantic matching |
| `src/patches/engine.ts` | Patch application engine + patchAll |
| `src/cli.ts` | CLI: apply, check, restore, status, unpack |
| `src/index.ts` | Public library API |
| `hooks/governance-verify.cjs` | 3-tier verification hook |

### Docs Updated
- `docs/ROADMAP.md` — Full restructure, Phase 1a marked complete
- `docs/STATE.md` — Current state with all new files and architecture

### Memory Updated
- `reference_external_resources.md` — All external repos/gists/refs from Tom's dump
- `project_full_vision.md` — Comprehensive project goals
- `feedback_fork_tweakcc.md` — Fork don't rebuild
- `project_governance_rerun.md` — Only reapply on CC update
- `project_system_prompt_architecture.md` — Three pieces: billing/static/dynamic

### CLAUDE.md Modified
- `~/.claude/CLAUDE.md` — Added visible reasoning directive (blockquote format)

## Verified Against Live Binary

- `claude-governance check` — correctly detected 2/5 governance targets + 0/2 prompt
  targets (binary already patched by old tools, correct behavior)
- `claude-governance apply --no-backup` — correctly reported already-patched state
- `governance-verify.cjs` — all checks pass on current state
- Simulated version mismatch — halt-and-catch-fire triggered correctly

## External Resources Cataloged

30+ repos, gists, and references organized by category:
- Core governance projects (clawgod, clawback, tweakcc, nanoclaw)
- System prompt leaks (ccleaks, Piebald, asgeirtj)
- Billing/proxy/usage (openclaw-billing-proxy, claude-usage)
- Cache fixes (cnighswonger, reddit threads)
- Official docs (env vars, CLI flags, prompt caching)

## Claude-Mem Evaluation

Researched https://github.com/thedotmack/claude-mem (49k stars, actively maintained).
Recommendation: park for now, revisit after Phase 2. Current workflow with STATE.md +
ROADMAP.md + session journals + auto-memory is covering needs for this focused project.

## End-to-End Test Results

Ran `claude-governance apply` on a restored (mostly clean) binary:
- **Governance patches: 4/4 applied at HIGH confidence** (exact detectors matched)
- **Prompt overrides: 0/2 matched** — binary still had tweakcc's prompt overrides from incomplete restore

### Prompt Override Findings (Critical for Next Session)

All 9 prompt files in `/prompts/` differ from Anthropic originals — ALL need patching:

| ID | Pieces | Vars | Key Change |
|----|--------|------|------------|
| agent-prompt-explore | 6 | 4 | Thoroughness over speed, conditional grep |
| agent-prompt-general-purpose | 1 | 0 | Template wrapper differences |
| system-prompt-agent-thread-notes | 1 | 0 | Permissive snippets, USE_EMBEDDED_TOOLS_FN conditional |
| system-prompt-doing-tasks-no-additions | 1 | 0 | Complete rewrite — nuanced vs restrictive |
| system-prompt-doing-tasks-no-premature-abstractions | 1 | 0 | Complete rewrite — balanced vs absolute |
| system-prompt-doing-tasks-no-unnecessary-error-handling | 1 | 0 | Rewrite — boundary validation vs none |
| system-prompt-executing-actions-with-care | 1 | 0 | Enhanced autonomy guidance |
| system-prompt-output-efficiency | N/A | N/A | **NO PIECES DATA** — not in tweakcc cache |
| system-prompt-tone-concise-output-short | 1 | 0 | "clear and appropriately detailed" vs "short and concise" |

### Why Prompt Matching Failed
1. Pieces regex searches for ORIGINAL Anthropic text
2. Binary still had tweakcc's OVERRIDE text (restore was incomplete)
3. The pieces data IS correct for a truly clean binary
4. Need: dual detection (original text for fresh binary, override text for already-patched)

### Binary State After Test
- **Explore prompt**: Still has tweakcc's "Be thorough" override (original pieces won't match)
- **Thread-notes**: Has `USE_EMBEDDED_TOOLS_FN()` conditional ternary — not simple variable interpolation
- **Variable names in binary**: `_`, `q`, `mq`, `l8`, `H` for explore prompt tools

### Architecture Fix Needed (prompts.ts)
1. Make data-driven: load overrides from files, pieces from JSON cache
2. For single-piece prompts (7/9): direct search-and-replace on original text
3. For multi-piece (explore): pieces regex with variable capture
4. For no-data (output-efficiency): semantic anchor matching
5. For already-patched: detect override text → report "no-change"
6. Handle USE_EMBEDDED_TOOLS_FN conditional branching in thread-notes

## What's Next

1. **Fix prompt overrides** — rebuild prompts.ts as data-driven, all 9 prompts
2. **Phase 1b: Wrapper layer** — ClawGod-style entry point, pre-flight verification
3. **Phase 1c: Modular architecture** — pluggable verification registry, module system
4. **Phase 1d: Distribution** — npm/npx, post-install verification
5. Then Phase 2: REPL + Tungsten native tool injection
