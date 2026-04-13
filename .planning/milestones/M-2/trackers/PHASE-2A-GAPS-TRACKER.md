# Phase 2a-gaps Tracker — Tool Injection Hardening

Status: COMPLETE — 12/12 done
Started: 2026-04-13

## Scope

Fix every issue discovered during first live runtime test of tool injection. Binary management, Zod compatibility, input validation, prompt override verification, and apply-flow corruption.

## Gaps (ordered by priority)

| # | Gap | Severity | Status |
|---|-----|----------|--------|
| G1 | Binary vault architecture — download → verify → lock → work on copy | High | Done |
| G2 | Apply command binary corruption — Node.js fs ops corrupt Mach-O, must use /bin/cp | High | Done |
| G3 | Tool input validation mismatch — Ping tool visible but validation uses Agent schema | High | Done |
| G4 | Zod passthrough shim completeness — borrowed schema from _b[0] may carry wrong validation | High | Done |
| G5 | Prompt override verification on fresh binary — 8 overrides not matching after re-download | Medium | Done |
| G6 | Auto-updater race condition — sessions without DISABLE_AUTOUPDATER overwrite patched binary | Medium | Done |
| G7 | Installer UTF-8 corruption — `claude.ai/install.sh` produces 304MB corrupted binary on macOS | Low | Done |
| G8 | Shim reliability — governance wrapper shim breaks CC launch when system is unhealthy | High | Done |
| G9 | Ensure that tool injection is dynamic** — this feature must survive Claude Code updates - detection must be more robust than just current binary extracted var and fn names. | Medium | Done |
| G10 | System Observability — IF governance wrapper or system breaks CC launch needs visual indication | High | Done |
| G11 | Embedded search tools — verify Glob/Grep exclusion from registry when bfs/ugrep active, confirm tool injection patch preserves exclusion, halt-and-catch-fire if inferior tools leak through | High | Done |
| G12 | Embedded search tools — statusline EMB segment must confirm active tools + absence of inferior Glob/Grep, not just binary existence | Medium | Done |

## Gap Details

### G1: Binary Vault Architecture — DONE
**Problem:** No safe storage for clean binaries.
**Solution:** `src/binaryVault.ts` — full vault module with XDG-based path discovery (matching CC's own `xdg.ts`), GCS download with `manifest.json` SHA256 verification, magic byte checks, immutable locking, binary-safe copies via `/bin/cp` (unix) or `copy /b` (Windows). Musl detection for Linux. `fetchLatestVersion()` via GCS `latest` file. Cross-platform (darwin/linux/win32, arm64/x64).

### G2: Apply Command Binary Corruption — DONE
**Problem:** `backupNativeBinary()` used `fs.copyFile()` which corrupts Mach-O on Node.js v24.
**Fix:** `installationBackup.ts` — both `backupNativeBinary()` and `restoreNativeBinaryFromBackup()` now use `binarySafeCopy()` from the vault module instead of Node.js fs operations.

### G3+G4: Zod Passthrough — DONE
**Problem:** Model sees Ping tool (API schema via `inputJSONSchema` works), but when it calls the tool, `toolExecution.ts:615` runs `tool.inputSchema.safeParse(input)` against the borrowed Agent schema (`_b[0].inputSchema`) which requires `description` and `prompt` fields. Any external tool input fails with `InputValidationError`.
**Root cause:** The Zod shim borrowed `_b[0].inputSchema` — the Agent tool's typed Zod schema, not a passthrough. MCPTool uses `z.object({}).passthrough()` but MCPTools aren't in `getAllBaseTools()` (loaded dynamically by MCP client), so there's nothing to borrow.
**Fix:** Replaced the `_b[0]` borrow with a self-contained passthrough object: `{safeParse:function(d){return{success:!0,data:d}},parse:function(d){return d}}`. No dependency on any existing tool's schema. Both `inputSchema` and `outputSchema` get the passthrough for external tools that don't provide their own Zod schemas. CC source confirms only `.safeParse()` and `.parse()` are called on `inputSchema`.

### G5: Prompt Override Verification — DONE
**Problem:** After apply, 8 prompt overrides showed "replacement text not found" in check. The apply output showed "unchanged" for all prompts.
**Root cause:** The 8 override markdown files lived in the repo's `prompts/` directory but were never copied to `~/.claude-governance/system-prompts/` where the apply flow reads replacement content. The config dir only had stock Anthropic text from the strings JSON sync, so the pieces-based matching replaced binary prompts with identical stock text → "unchanged".
**Fix:** Override files bundled at `data/overrides/` in the npm package. New `deployPromptOverrides()` in `patches/index.ts` copies them to the config dir before `applySystemPrompts` runs. Only writes if content differs. Added `"data/overrides/*.md"` to package.json files array. Result: 14/14 → 15/15 SOVEREIGN.

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

### G9: Dynamic Tool Injection — DONE
**Problem:** Tool injection detection used a single regex for `function XX(){return[` — fragile against minifier changes (arrow functions, body size growth, syntax variations).
**Fix:** Refactored `writeToolInjection()` into `detectToolArray()` with three ordered strategies: (1) function-declaration (current pattern), (2) arrow-function (`const XX=()=>[`), (3) content-based (search for known tool names like "Bash","Read","Agent" then walk backward). Replaced 2000-char search window with `findArrayEnd()` using brace counting up to 8000 chars. Each strategy validates via spread count (10+ for strategies 1-2, 8+ for content-based). On 2.1.101: strategy "function-declaration" matches `Ut()` with 30 spreads.

### G11: Embedded Search Tools — Registry Exclusion — DONE
**Problem:** The existing 8-point hook verified binary existence of bfs/ugrep but not that Glob/Grep are actually excluded from the tool registry when embedded tools are active.
**Fix:** Added verification entry `embedded-tools-exclusion` to `VERIFICATION_REGISTRY` using regex `[$\w]+\(\)\?\[\]:\[[$\w]+,[$\w]+\]` — matches the minified conditional `jD()?[]:[nI,_v]` which is uniquely the Glob/Grep exclusion gate. Confirmed: (a) pattern exists in extracted JS, (b) only one match in entire binary, (c) our tool injection preserves it inside the `_b` array — concat only adds external tools, never Glob/Grep. Updated hook to read governance state.json for this entry. 15/15 SOVEREIGN.

### G12: Embedded Search Tools — Statusline — DONE
**Problem:** EMB statusline segment confirmed tool binary existence but not registry exclusion state. Also, the hook wrote state to `~/.claudemd-governance/` (wrong path) while statusline read from `~/.claude-governance/`.
**Fix:** Fixed hook state dir to use proper config dir resolution (mirrors config.ts). Added `registry_exclusion` check to hook that reads governance state.json for the `embedded-tools-exclusion` entry. Updated statusline EMB segment: shows `EMB:LEAK` (red) when tools work but exclusion pattern is missing.

## Current Binary State

- **Virgin:** `~/.claude-governance/binaries/virgin-2.1.101.bin` — 201MB, `cffaedfe`, immutable
- **Installed:** `~/.local/share/claude/versions/2.1.101` — patched, 15/15 SOVEREIGN
- **Prompt overrides:** 8/8 active (deployed from data/overrides/)
- **Tool injection:** Active, self-contained Zod passthrough shim, validation passes
