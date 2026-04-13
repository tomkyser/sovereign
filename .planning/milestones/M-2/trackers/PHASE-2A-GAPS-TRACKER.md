# Phase 2a-gaps Tracker — Tool Injection Hardening

Status: IN PROGRESS
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
| G6 | Auto-updater race condition — sessions without DISABLE_AUTOUPDATER overwrite patched binary | Medium | Pending |
| G7 | Installer UTF-8 corruption — `claude.ai/install.sh` produces 304MB corrupted binary on macOS | Low | Pending |
| G8 | Shim reliability — governance wrapper shim breaks CC launch when system is unhealthy | High | Pending |

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

### G6: Auto-Updater Race Condition
**Problem:** Running Claude sessions without `DISABLE_AUTOUPDATER=1` continuously re-download and overwrite the binary at `~/.local/share/claude/versions/2.1.101`. Race window between our write and their overwrite is sub-millisecond.
**Fix:** Binary vault (G1) solves the source problem. For the installed path, consider locking after patching, or accepting that re-apply is needed when other sessions overwrite.

### G7: Installer UTF-8 Corruption
**Problem:** `curl -fsSL https://claude.ai/install.sh | bash -s -- 2.1.101` produces a 304MB binary with `ef bf bd` corruption. Direct `curl -o` to the GCS bucket URL produces a clean 201MB binary.
**Root cause:** The install script likely pipes through a shell operation that treats the binary as text.
**Workaround:** Download directly from GCS: `curl -fsSL -o $TARGET "$GCS_BUCKET/2.1.101/darwin-arm64/claude"`
**GCS bucket:** `https://storage.googleapis.com/claude-code-dist-86c565f3-f756-42ad-8dfa-d59b1c096819/claude-code-releases`

### G8: Shim Reliability
**Problem:** The transparent claude shim at `~/.claude-governance/bin/claude` wraps every `claude` invocation through `claude-governance launch`. If the governance tool fails for ANY reason (bad build, missing deps, corrupted state, port exhaustion, etc.), the user cannot launch CC at all. Tom had to manually comment out the shim PATH entry and clean-install CC just to get a working session.
**Root cause:** The shim is a hard gate with no bypass. If `claude-governance launch` errors, the error propagates and CC never starts.
**Fix:** The shim must have a failsafe — if governance pre-flight fails, it should log a warning and fall through to launch CC directly. Never block the user from running CC. Options: (a) try-catch in shim with direct exec fallback, (b) timeout on governance check, (c) `--no-governance` flag that bypasses entirely.

## Current Binary State

- **Virgin:** `~/.claude-governance/binaries/virgin-2.1.101.bin` — 201MB, `cffaedfe`, immutable
- **Installed:** `~/.local/share/claude/versions/2.1.101` — patched, 6/14 (governance + gate + tool injection)
- **Prompt overrides:** 0/8 matching (G5)
- **Tool injection:** Active, Zod shim present, but tool call validation fails (G3/G4)
