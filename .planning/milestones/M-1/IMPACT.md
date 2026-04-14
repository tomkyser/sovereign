# Milestone 1 Impact — Core Engine

Retroactively created during Phase 2-PM-update.

## Milestone Scope

Build the governance engine: fork tweakcc, strip cosmetics, add governance patches
and prompt overrides, create verification pipeline, wrapper layer, module system,
and npm distribution.

## References

- [tweakcc1] — Fork source
- [ccPrompts1] — Prompt text source of truth
- [clawgod1] — Wrapper architecture reference (Phase 1b)
- [clawback1] — Hooks-based governance, active on Tom's setup
- [nanoclaw1] — Minimal patching reference
- [stellaraccident1] — Degradation analysis
- [promethean1] — CLAUDE.md dismissal evidence

## Phase Impact

| Phase | Key Impact |
|-------|-----------|
| 1a | Fork established, 5 governance patches, 8 prompt overrides, 6/6 SOVEREIGN |
| 1a-gaps | Backup contamination, already-applied detection, dead file cleanup |
| 1a-verification-foundation | 13-entry registry, per-override verification, state.json |
| 1b | Wrapper layer, pre-flight verification, process control |
| 1c | Verification API extraction, hooks rewrite, status line fix |
| 1d | Module system, core + env-flags modules |
| 1e | NPM packaging, setup wizard, postinstall |
