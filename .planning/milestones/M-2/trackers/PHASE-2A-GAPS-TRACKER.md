# Phase 2a-gaps Tracker — Tool Injection Hardening

Status: IN PROGRESS — 6/12 done
Started: 2026-04-13

## Scope

Fix every issue discovered during first live runtime test of tool injection. Binary management, Zod compatibility, input validation, prompt override verification, and apply-flow corruption.

## Gaps (ordered by priority)

| # | Gap | Severity | Status |
|---|-----|----------|--------|
| G1 | Binary vault architecture — download → verify → lock → work on copy | High | Done |
| G2 | Apply command binary corruption — Node.js fs ops corrupt Mach-O, must use /bin/cp | High | Done |
| G3 | Tool input validation mismatch — Ping tool visible but validation uses Agent schema | High | Pending |
| G4 | Zod passthrough shim completeness — borrowed schema from _b[0] may carry wrong validation | High | Pending |
| G5 | Prompt override verification on fresh binary — 8 overrides not matching after re-download | Medium | Pending |
| G6 | Auto-updater race condition — sessions without DISABLE_AUTOUPDATER overwrite patched binary | Medium | Done |
| G7 | Installer UTF-8 corruption — `claude.ai/install.sh` produces 304MB corrupted binary on macOS | Low | Done |
| G8 | Shim reliability — governance wrapper shim breaks CC launch when system is unhealthy | High | Done |
| G9 | Ensure that tool injection is dynamic** — this feature must survive Claude Code updates - detection must be more robust than just current binary extracted var and fn names. | Medium | Pending |
| G10 | System Observability — IF governance wrapper or system breaks CC launch needs visual indication | High | Done |
| G11 | Embedded search tools — verify Glob/Grep exclusion from registry when bfs/ugrep active, confirm tool injection patch preserves exclusion, halt-and-catch-fire if inferior tools leak through | High | Pending |
| G12 | Embedded search tools — statusline EMB segment must confirm active tools + absence of inferior Glob/Grep, not just binary existence | Medium | Pending |

## Gap Details

### G1: Binary Vault Architecture — DONE
**Problem:** No safe storage for clean binaries.
**Solution:** `src/binaryVault.ts` — full vault module with XDG-based path discovery (matching CC's own `xdg.ts`), GCS download with `manifest.json` SHA256 verification, magic byte checks, immutable locking, binary-safe copies via `/bin/cp` (unix) or `copy /b` (Windows). Musl detection for Linux. `fetchLatestVersion()` via GCS `latest` file. Cross-platform (darwin/linux/win32, arm64/x64).

### G2: Apply Command Binary Corruption — DONE
**Problem:** `backupNativeBinary()` used `fs.copyFile()` which corrupts Mach-O on Node.js v24.
**Fix:** `installationBackup.ts` — both `backupNativeBinary()` and `restoreNativeBinaryFromBackup()` now use `binarySafeCopy()` from the vault module instead of Node.js fs operations.

### G3: Tool Input Validation Mismatch
**Problem:** Model sees Ping tool (API schema via `inputJSONSchema` works), but when it calls the tool, validation fails with `InputValidationError: Ping failed — description and prompt required`. Those are Agent tool params, not Ping tool params.
**Root cause:** The Zod passthrough schema borrowed from `_b[0]` (Agent tool) may be carrying the Agent tool's validation schema. The 10+ callsites that call `.inputSchema.safeParse()` parse against the Agent tool's schema instead of a true passthrough.
**Fix:** Need a genuine `z.object({}).passthrough()` Zod schema, not a reference to a specific tool's schema. Options: (a) find the Zod library reference in the binary and create one, (b) find the MCPTool passthrough schema (`wj1()`) instead of using `_b[0]`.

### G4: Zod Passthrough Shim Completeness
**Problem:** The current shim borrows `inputSchema` from `_b[0]` (first tool in base array). This is the Agent tool, which has a complex typed schema — not a passthrough. The MCPTool base uses `z.object({}).passthrough()` which is what we actually need.
**Fix:** Change the shim to find the MCPTool passthrough schema. Options:
- Find `wj1()` (the lazy passthrough schema) by walking the tool array for `isMcp: true`
- Or find a tool with `.inputSchema` that is a passthrough (check `.shape` is empty)
- Or create one from the binary's Zod reference (`h.object({}).passthrough()` where `h` is Zod)

### G5: Prompt Override Verification
**Problem:** After fresh download + apply, 8 prompt overrides show as "replacement text not found" in check. The prompt pieces-based matching may depend on prompt data file hashes that differ between the previously-patched binary and this clean download.
**Investigate:** Compare prompt data files, check if the pieces matching pipeline is version-sensitive.

### G6: Auto-Updater Race Condition — DONE
**Problem:** Running Claude sessions without `DISABLE_AUTOUPDATER=1` continuously re-download and overwrite the binary at `~/.local/share/claude/versions/2.1.101`. The launch pre-flight checked state.json for version changes and SOVEREIGN status, but if the auto-updater overwrites with the same version, state.json still says SOVEREIGN — governance doesn't re-check.
**Fix:** Binary fingerprint (size + mtimeMs) captured in state.json after every apply/check. `handleLaunch` pre-flight compares current binary fingerprint against stored — if size or mtime changed, forces live re-verification and reapply. Three-layer detection: (1) version change, (2) status degradation, (3) fingerprint mismatch. All `writeVerificationState` callsites updated to capture fingerprint. Functions: `getBinaryFingerprint()`, `fingerprintChanged()` in `binaryVault.ts`.

### G7: Installer UTF-8 Corruption — DONE
**Problem:** `curl -fsSL https://claude.ai/install.sh | bash -s -- 2.1.101` produces a 304MB binary with `ef bf bd` corruption. Direct `curl -o` to the GCS bucket URL produces a clean 201MB binary.
**Root cause:** The install script pipes binary data through shell operations that treat it as text, replacing non-UTF-8 bytes with U+FFFD replacement characters.
**Fix:** `detectCorruption()` in `binaryVault.ts` — two detection methods: (1) size heuristic (>30% larger than expected = likely inflated by replacement chars), (2) header scan for U+FFFD sequences in first 4KB (>10 occurrences = corrupted). Both `handleCheck` and `handleLaunch` pre-flight call this before extraction — user gets red CORRUPTED BINARY DETECTED warning with actionable fix instructions pointing to `claude-governance setup` or direct GCS download.

### G8: Shim Reliability — DONE
**Problem:** Shim used hard `exec` — if governance failed, CC couldn't launch at all.
**Fix:** Sentinel exit code architecture. `handleLaunch` uses exit code 111 (`GOVERNANCE_FAIL_EXIT`) for governance-specific failures (can't find CC, can't spawn). The shim script runs governance without `exec`, checks the exit code — if 111 or 127, falls through to find and launch the real claude binary directly. Finds real binary by: (1) searching PATH excluding the shim dir, (2) scanning XDG versions directory for highest version. User always gets CC, even if governance is broken.

### G10: System Observability — DONE
**Problem:** When governance fails and the shim falls through, the user and Claude have no indication that the session is running unprotected.
**Fix:** Two-part signal chain. (1) Shim writes `shim-fallback.json` marker to config dir before fallback launch, containing timestamp, exit code, and reason. (2) Session-start hook (`governance-verify.cjs`) checks for marker on every session start — if found, renders red `UNPROTECTED` banner to stderr (user sees) and emits `[GOVERNANCE CRITICAL]` to stdout (Claude sees in system-reminder). Marker is consumed (deleted) after reading so it doesn't persist across sessions.

### G11: Embedded Search Tools — Registry Exclusion Verification
**Problem:** When `EMBEDDED_SEARCH_TOOLS=1` and bfs/ugrep are active, CC's `getAllBaseTools()` is supposed to exclude the inferior `Glob` and `Grep` tools from the registry. But: (a) we haven't verified this works in the minified binary, (b) our tool injection patch modifies `getAllBaseTools()` — we may have broken the exclusion logic, (c) the existing 8-point verification hook only checks that bfs/ugrep/rg binaries respond to argv0 dispatch, not that Glob/Grep are actually absent from the tool list Claude sees.
**CC source evidence:** `embeddedTools.ts` — `hasEmbeddedSearchTools()` checks `EMBEDDED_SEARCH_TOOLS` env + entrypoint. `primitiveTools.ts:25-26` confirms `getAllBaseTools()` excludes Glob/Grep when true. Multiple agent prompts adjust guidance based on this flag.
**Fix:** (a) Verify in extracted JS that the conditional exclusion survives minification. (b) Verify our tool injection patch preserves the exclusion branch — the `concat` we append should not re-add Glob/Grep. (c) Add a runtime verification check: after tools are loaded, confirm Glob/Grep are NOT in the tool list when embedded tools are active. Halt and catch fire if they leak through.

### G12: Embedded Search Tools — Statusline Verification
**Problem:** The EMB statusline segment confirms tool binaries exist but doesn't verify that the inferior tools are actually excluded from the registry. A session could show "EMB 8/8" while still offering Glob/Grep to Claude.
**Fix:** Extend the embedded tools hook and statusline segment to check tool registry state, not just binary availability. If bfs/ugrep are active but Glob/Grep are still in the registry, show EMB:LEAK warning.

## Current Binary State

- **Virgin:** `~/.claude-governance/binaries/virgin-2.1.101.bin` — 201MB, `cffaedfe`, immutable
- **Installed:** `~/.local/share/claude/versions/2.1.101` — patched, 6/14 (governance + gate + tool injection)
- **Prompt overrides:** 0/8 matching (G5)
- **Tool injection:** Active, Zod shim present, but tool call validation fails (G3/G4)
