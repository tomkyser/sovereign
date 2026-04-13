# Phase 1a Handoff — Fork & Strip

Written: 2026-04-12 (final update — Phase 1a COMPLETE)

## STATUS: COMPLETE — 6/6 SOVEREIGN

## What Was Done

### Session 1 (2026-04-12)
1. Identified previous `claude-governance/` was a rebuild, not a fork — scrapped it
2. Reset all project docs (ROADMAP, STATE, CLAUDE.md) to reflect reality
3. Created actual fork: copied `tweakcc/` → `claude-governance/`, fresh git
4. Stripped ALL cosmetic patches from registry (40+ removed)
5. Added 5 governance patches in `src/patches/governance.ts`
6. Added USE_EMBEDDED_TOOLS_FN gate resolution patch
7. Debugged prompt matching failures (backup contamination, pieces data)
8. Final: ALL 8 prompt overrides + 4 governance patches applied on fresh binary

### Session 2 (2026-04-12, post-compaction)
1. Updated package identity: name→claude-governance, version→0.1.0, bin entry
2. Config dir rename: `~/.tweakcc` → `~/.claude-governance` (with legacy fallback)
3. Env vars renamed: CLAUDE_GOVERNANCE_CONFIG_DIR, CLAUDE_GOVERNANCE_CC_PATH
4. Stripped Ink/React UI entirely — deleted src/ui/, removed deps (127KB from 231KB)
5. Rewrote index.tsx — plain CLI, default action is apply
6. Updated lib/detection.ts — removed Ink picker, replaced with error listing
7. Added `check` subcommand — extracts JS, verifies 6 governance signatures
8. Updated all project docs (STATE, ROADMAP, TRACKER)

## Current State of claude-governance/

**Location:** `/Users/tom.kyser/dev/claude-code-patches/claude-governance/`
**Based on:** tweakcc 4.0.11 (full fork, fresh git)
**Build:** `pnpm build` → 127KB, clean

### Files Modified in the Fork
| File | Change |
|------|--------|
| `package.json` | name, version, bin, keywords, author, repo, deps (removed ink/react) |
| `src/index.tsx` | Complete rewrite — removed Ink, plain CLI, added `check` command |
| `src/config.ts` | Config dir → ~/.claude-governance, env var rename, User-Agent |
| `src/patches/index.ts` | Stripped cosmetic patches, governance-only registry |
| `src/patches/governance.ts` | NEW — 5 governance patches + gate resolution |
| `src/installationDetection.ts` | TWEAKCC_CC_INSTALLATION_PATH → CLAUDE_GOVERNANCE_CC_PATH |
| `src/types.ts` | Updated env-var comment |
| `src/lib/detection.ts` | Removed Ink/React, picker → error listing |
| `src/ui/` | DELETED |
| `data/prompts/prompts-2.1.101.json` | Restored to original unpatched version |

### Verification Results (6/6 SOVEREIGN)
- ✓ Disclaimer Neutralization — active
- ✓ Context Header Reframing — active
- ✓ System-Reminder Authority Fix — active
- ✓ Subagent CLAUDE.md Restoration — active (flag=false)
- ✓ Embedded Tools Gate Resolution — all gates resolved
- ✓ Prompt Override Signatures — spot-check phrases present

### CLI Commands
```bash
node dist/index.mjs              # Apply governance patches (default)
node dist/index.mjs --apply      # Same as above (explicit)
node dist/index.mjs check        # Verify governance state
node dist/index.mjs --restore    # Restore original binary
node dist/index.mjs --list-patches
node dist/index.mjs --list-system-prompts
node dist/index.mjs unpack /tmp/out.js
```

## CRITICAL: Backup Issue (1c item)

tweakcc's `restoreNativeBinaryFromBackup` restores from `~/.tweakcc/native-binary.backup`.
If this backup was from a patched binary, restore feeds patched content back and regex fails.

**Workaround:** Before apply on fresh binary:
```bash
rm -f ~/.tweakcc/native-binary.backup
cp ~/.local/share/claude/versions/X.Y.Z ~/.tweakcc/native-binary.backup
```

**For 1c:** Detect clean vs patched backup automatically.

## Items for Phase 1c (Verification Engine)

1. **Backup contamination detection** — clean vs patched backup
2. **"Already applied" distinction** — apply on patched binary shows ✗, should show "already active"
3. **Per-patch signature + anti-signature registry** — both directions
4. **Canary prompts** — runtime verification via injected test phrases
5. **SessionStart hook** — replace stale governance-verify.cjs
6. **Full prompt override verification** — per-override signatures (current: 2-phrase spot-check)
7. **Status line integration** — currently broken
8. **Version change detection** — CC update → warn/block
9. **`strings` false positives** — always extract JS, never trust `strings` on Mach-O

## Next Phases

- **1b: Wrapper Layer** — ClawGod-style wrapper, pre-flight verification, env injection
- **1c: Verification Engine** — infallible verification (items above)
- **1d: Modular Architecture** — plugin/module system
- **1e: CLI & Distribution** — npx-runnable, npm installable

## What NOT To Do
- Do NOT use the Session 2 patched pieces data — it has ant-branch text
- Do NOT trust `~/.tweakcc/native-binary.backup` without verifying it's clean
- Do NOT verify with `strings` — use extracted JS
- Do NOT reference ~/.tweakcc/ as a runtime dependency for shipped product
