# Phase 1a State Tracker — Fork & Strip

Started: 2026-04-12
Status: COMPLETE

## Steps

### 1. Setup
- [x] Move failed `claude-governance/` aside → `claude-governance-old/`
- [x] Copy `tweakcc/` → `claude-governance/`, fresh git
- [x] Verify fork builds as-is (`pnpm build` → 320KB, clean)
- [x] Update package.json (name → claude-governance, version → 0.1.0, bin entry, keywords, author, repo)

### 2. Strip Cosmetic Patches
- [x] Removed ALL cosmetic/broken patches from PATCH_DEFINITIONS in index.ts
- [x] Removed all cosmetic patch imports (40+ patches stripped from registry)
- [x] Kept: system prompts module, governance patches, helpers, patchDiffing
- [x] Added PatchGroup.GOVERNANCE enum value + backward-compat values
- [x] Clean build: 230KB (down from 320KB)

### 3. Strip Ink/React UI
- [x] Rewrote index.tsx — removed all `render()`, `<App/>`, `<InstallationPicker/>`
- [x] Replaced interactive TUI with plain console output
- [x] Default action: apply (no --apply flag needed)
- [x] Updated lib/detection.ts — removed Ink picker, replaced with error listing
- [x] Deleted src/ui/ directory entirely
- [x] Removed ink, ink-link, react, @types/react, cli-spinners from deps
- [x] Build: 127KB (down from 231KB — nearly half)

### 4. Config Dir Rename
- [x] `~/.tweakcc` → `~/.claude-governance` (with legacy fallback)
- [x] Updated getConfigDir() priority: env override → .claude-governance → .tweakcc (migration) → XDG
- [x] Renamed env var: TWEAKCC_CONFIG_DIR → CLAUDE_GOVERNANCE_CONFIG_DIR
- [x] Renamed env var: TWEAKCC_CC_INSTALLATION_PATH → CLAUDE_GOVERNANCE_CC_PATH
- [x] Updated User-Agent header

### 5. Add Governance Patches
- [x] Created `src/patches/governance.ts` — 5 patches with multi-detector strategy
- [x] Registered all 5 in PATCH_DEFINITIONS as PatchGroup.GOVERNANCE
- [x] Config reads from `config.settings.governance` section
- [x] isMeta patch is conditional (off by default)
- [x] All 4 active governance patches verified at HIGH confidence on fresh binary

### 6. Add Verification (`check` command)
- [x] Added `check` subcommand to CLI
- [x] Extracts JS from native binary (not `strings`)
- [x] Checks 6 signatures: disclaimer, header, reminder, subagent flag, gates, prompt spot-check
- [x] Reports SOVEREIGN / DEGRADED / PARTIAL with per-check details
- [x] Exit code 1 on critical failure, 0 on pass
- [x] Tested: 6/6 SOVEREIGN on patched 2.1.101

### 7. Prompt Overrides
- [x] 8 of 9 apply (output-efficiency removed by Anthropic in 2.1.100)
- [x] Pieces data in fork's `data/prompts/` for all 8 targets
- [x] Verified against extracted JS

### 8. Build & Verify
- [x] Clean build: 127KB, no errors
- [x] `claude-governance check` → 6/6 SOVEREIGN
- [x] `claude --version` → 2.1.101 (works post-apply)
- [x] All tweakcc branding replaced in CLI-facing code

## Decisions Made
- Stripped ALL cosmetic patches — many broken on 2.1.101 (tweakcc #676, #660, #674)
- Stripped Ink/React UI entirely — governance tool is non-interactive
- Default CLI action is apply (not interactive TUI)
- Config dir rename with legacy fallback for migration
- `check` command verifies against extracted JS, not `strings`

## Items for Phase 1c (Verification Engine)
- Backup contamination detection (clean vs patched backup)
- "Already applied" vs "failed" distinction in apply flow
- Canary prompts for runtime verification
- Per-patch signature + anti-signature checking
- Verification that survives compaction, resume, subagent spawn
- Status line integration (currently broken)
- `strings` on Mach-O gives false positives — always verify extracted JS
