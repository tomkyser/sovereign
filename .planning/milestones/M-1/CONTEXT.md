# Milestone 1 Context — Core Engine

**READ THIS FIRST.** This is the shared context for all agents working on Milestone 1.

## What We're Building

`claude-governance` — a fork of tweakcc that strips cosmetic patches and adds governance patches + prompt overrides to restore user authority over Claude Code.

**Location:** `/Users/tom.kyser/dev/claude-code-patches/claude-governance/`
**Build:** `pnpm build` → 139KB | **Package:** 2.2MB | **Verify:** `node dist/index.mjs check` → 13/13 SOVEREIGN
**CC Version:** 2.1.101 (native, arm64-darwin, pinned via DISABLE_AUTOUPDATER=1)

## Current State

| Phase | Status |
|-------|--------|
| 1a: Fork & Strip | COMPLETE |
| 1a-gaps: Gap Resolutions | COMPLETE |
| 1a-verification-foundation | COMPLETE |
| 1b: Wrapper Layer | COMPLETE |
| 1c: Verification Engine (1b-informed) | COMPLETE |
| 1d: Modular Architecture | COMPLETE |
| 1e: CLI & Distribution | COMPLETE |

## What's Applied (6/6 SOVEREIGN)

**Governance Patches:** Disclaimer neutralization, context header reframing, subagent CLAUDE.md restoration, system-reminder authority fix
**Gate Resolution:** USE_EMBEDDED_TOOLS_FN → ant branch (0 unresolved)
**Prompt Overrides:** 8 of 9 (output-efficiency removed by Anthropic in 2.1.100)

## Key Files (claude-governance/)

| File | Purpose |
|------|---------|
| `src/index.tsx` | CLI entry — apply (default), check, launch, restore, unpack, repack |
| `src/verification.ts` | Verification API — runVerification(js, registry), read/writeState, deriveStatus |
| `src/modules/` | Module system — types, registry, core module, env-flags module |
| `src/setup.ts` | First-run setup wizard — module selection, apply, verify |
| `scripts/postinstall.mjs` | Postinstall welcome message for global installs |
| `src/patches/index.ts` | Patch orchestrator — prompt overrides → gate resolution → governance |
| `src/patches/governance.ts` | 5 governance patches + `isContentPatched()` + gate resolution |
| `src/config.ts` | Config dir resolution (~/.claude-governance with ~/.tweakcc fallback) |
| `data/prompts/prompts-2.1.101.json` | Pieces data for prompt matching (MUST be unpatched original) |

## Critical Gotchas

1. **Backup contamination:** If `native-binary.backup` contains governance signatures, apply flow auto-removes it. If installed binary is ALSO patched, governance patches report "already active" instead of failing.
2. **`strings` gives false positives:** Always verify against extracted JS (`unpack` command), never `strings` on Mach-O binary.
3. **Pieces data must be original:** `prompts-2.1.101.json` must have the original (unpatched) prompt text. Ant-branch text from a patched binary breaks regex matching.
4. **Gate resolution ordering:** MUST run AFTER prompt system (pieces regex needs ternaries intact) but BEFORE final output.
5. **Apply default action:** Running `node dist/index.mjs` with no args applies governance patches (not interactive TUI — that was stripped).

## External References (not in repo)

- `/Users/tom.kyser/dev/tweakcc/` — Fork source (local checkout)
- `/Users/tom.kyser/dev/cc-source/` — Leaked CC source (internals reference)
- `/Users/tom.kyser/dev/clawback/` — Active hooks project
