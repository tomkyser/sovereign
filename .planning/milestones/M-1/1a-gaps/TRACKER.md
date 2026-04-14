# Phase 1a-gaps Tracker — Gap Resolutions

Started: 2026-04-12
Status: COMPLETE

## Steps

### 1. Backup Contamination Detection
- [x] Added `isContentPatched()` to governance.ts — checks for governance signatures
- [x] Apply flow scans backup before use — if contaminated, removes stale backup
- [x] Falls through to installed binary when backup removed

### 2. "Already Applied" Detection
- [x] Added `signature` field to `PatchImplementation` interface
- [x] Apply loop checks signature before running detector
- [x] Reports "already active" (✓) instead of failed (✗) when signature present
- [x] All 4 governance patches declare signatures

### 3. Dead Cosmetic Patch Cleanup
- [x] Removed 50 dead .ts files from src/patches/
- [x] Removed 3 dead test files from src/tests/
- [x] Removed dead `CUSTOM_MODELS` import from utils.ts
- [x] Build: 126KB (down from 128KB)

### 4. Prompt Sync Warning Suppression
- [x] "Could not find system prompt" → debug-level only
- [x] "WARNING: Conflicts detected" → debug-level only
- [x] Clean CLI output on apply and check

### 5. communication-style Override Evaluation
- [x] Found prompt in extracted JS — gated behind Opus 4.6 + `quiet_salted_ember` flag
- [x] Content promotes concise updates, no narration — aligned with governance goals
- [x] Decision: No override needed
