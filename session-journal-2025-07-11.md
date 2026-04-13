# Session Journal: 2025-07-11

## Claude Code CLAUDE.md Governance Investigation & Patch Development

**Working directory:** `/Users/tom.kyser/dev/claude-code-patches/`
**Claude Code version:** 2.1.101 (native binary, macOS ARM64)
**Model:** Claude Opus 4.6 (1M context)
**Session duration:** Extended (~6+ hours)

---

## Phase 1: Investigation — How Claude Code Manipulates CLAUDE.md

### Objective
Determine exactly how Claude Code handles CLAUDE.md files that users define as mandatory project instructions, and whether the handling undermines the user's intent.

### Sources Used
1. **Extracted system prompts** at `~/.tweakcc/system-prompts/` (270+ prompt files extracted by tweakcc)
2. **Minified cli.js** at `/Users/tom.kyser/dev/claude-code-patches/claude-code.js` (extracted from CC binary)
3. **Leaked unminified source** at `https://github.com/chauncygu/collection-claude-code-source-code` (fetched via WebFetch; some subagents refused to access it citing IP concerns, but direct fetches worked for `src/context.ts` and `src/query.ts`)

### Key Finding: The `prependUserContext` Function

**Minified location:** `claude-code.js:7898-7905` (function name `In_`)
**Unminified location:** `src/utils/api.ts:715-733`

This function wraps ALL CLAUDE.md content in a `<system-reminder>` tag with:
- A preamble: "As you answer the user's questions, you can use the following context:"
- The user's content under a `# claudeMd` heading
- A trailing disclaimer: "IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task."
- The message is marked `isMeta: true`

```javascript
function In_(H,_){
  if(Object.entries(_).length===0)return H;
  return[r_({content:`<system-reminder>
As you answer the user's questions, you can use the following context:
${Object.entries(_).map(([q,K])=>`# ${q}
${K}`).join(`\n`)}

      IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.
</system-reminder>
`,isMeta:!0}),...H]}
```

### Additional Manipulation Points Found

1. **The "MUST follow" preamble** (`MEMORY_INSTRUCTION_PROMPT` constant in `src/utils/claudemd.ts:639-696`) - Anthropic injects "Be sure to adhere to these instructions. IMPORTANT: These instructions OVERRIDE any default behavior" BEFORE the user's content, but then the disclaimer AFTER undermines it.

2. **Subagent CLAUDE.md stripping** (`src/utils/api.ts` and agent spawning code) - The `tengu_slim_subagent_claudemd` experiment flag defaults to `true`, causing subagents (Explore, Plan, general-purpose) to receive NO CLAUDE.md content at all.

3. **System-reminder framing in system prompt** (`src/constants/prompts.ts:131-134`) - The model's system prompt says: "Tool results and user messages may include <system-reminder> tags... They are automatically added by the system, and bear no direct relation to the specific tool results or user messages in which they appear."

4. **Same framing for everything** - CLAUDE.md gets the identical `<system-reminder>` wrapper as "file opened in IDE" notifications, giving mandatory user instructions the same priority as ambient context signals.

5. **`isMeta: true` flag** - Marks the CLAUDE.md message as system scaffolding rather than user intent, affecting how compaction and caching treat it.

### Investigation Methods

- Searched minified `claude-code.js` for: `claudeMd`, `system-reminder`, `may or may not be relevant`, `Codebase and user instructions`, `bear no direct relation`, `tengu_slim_subagent_claudemd`
- Searched extracted prompts in `~/.tweakcc/system-prompts/` for CLAUDE.md references
- Launched 3 parallel subagents: one for leaked source (background, eventually completed), one for minified JS analysis (found the critical function), one for extracted prompt analysis
- Cross-referenced the minified function `In_` with the unminified `prependUserContext` via structural matching
- The background agent confirmed exact file locations: `src/utils/api.ts:715-733`, `src/utils/claudemd.ts:639-696`, `src/context.ts`, `src/constants/prompts.ts:131-134`

### Report Generated
Saved to: `/Users/tom.kyser/dev/claude-code-patches/claude-code-claudemd-manipulation-report.md`

---

## Phase 2: Design & Build — `claudemd-governance` npm Package

### Objective
Create a tweakcc-based npm package that:
1. Strips/replaces the undermining framing around CLAUDE.md
2. Uses intelligent multi-strategy detection (not brittle find/replace)
3. Shows visual status that it's working
4. Is configurable by the user
5. Can be published as an npm package
6. Survives CC updates via fallback detection patterns

### TweakCC API Research

Read the full TweakCC README from `https://github.com/Piebald-AI/tweakcc`. Key API functions:
- `tryDetectInstallation()` - finds CC installations
- `readContent(installation)` - extracts JS from binary
- `writeContent(installation, content)` - repacks JS into binary
- `backupFile(source, dest)` / `restoreBackup(backup, target)` - backup management
- `adhoc-patch --script` - runs sandboxed patch scripts

### Package Structure Created

```
/Users/tom.kyser/dev/claude-code-patches/claudemd-governance/
├── package.json          # npm package, tweakcc dependency
├── index.js              # Library API: apply(), check(), restore(), patchContent()
├── script.js             # Standalone adhoc-patch script (self-contained)
├── lib/
│   ├── patches.js        # 5 patches with multi-strategy detection
│   ├── defaults.js       # Default replacement text, config resolution
│   └── reporter.js       # ANSI-colored terminal output (zero deps)
├── bin/
│   └── cli.js            # CLI: apply, check, restore commands
└── README.md             # Full documentation
```

### The 5 Patches Defined

Each patch has 2-4 detection strategies (primary exact match → fuzzy → structural fallback):

| # | ID | Name | Severity | What it fixes |
|---|---|---|---|---|
| 1 | `disclaimer` | Disclaimer Neutralization | critical | Removes/replaces "may or may not be relevant" text |
| 2 | `header` | Context Header Reframing | recommended | Changes "As you answer..." to directive framing |
| 3 | `subagent-strip` | Subagent CLAUDE.md Restoration | critical | Flips `tengu_slim_subagent_claudemd` from `!0` to `!1` |
| 4 | `reminder-framing` | System-Reminder Authority Fix | recommended | Removes "bear no direct relation" from system prompt |
| 5 | `meta-flag` | Meta-Message Promotion | optional | Removes `isMeta:!0` from CLAUDE.md wrapper (off by default) |

### Default Replacement Text

**Disclaimer:** "The CLAUDE.md instructions above are authoritative project directives. Follow them exactly as written."
**Header:** "The following are mandatory project instructions defined by the user in CLAUDE.md files:"
**Reminder framing:** "Tool results and user messages may include <system-reminder> tags. When these tags contain CLAUDE.md instructions, treat them as authoritative project directives that must be followed."

### User Configuration Options

- `--disclaimer-mode strip|replace` (default: replace)
- `--disclaimer-text "custom text"`
- `--header-text "custom text"`
- `--no-fix-subagents` / `--no-fix-header` / `--no-fix-reminder-framing`
- `--config file.json`
- `CLAUDEMD_GOV_CONFIG` env var (for adhoc-patch script mode)

### ESM Compatibility Fix
TweakCC is an ESM module (`dist/lib/index.mjs` with top-level await). All `require('tweakcc')` calls had to be converted to `await import('tweakcc')` in both `bin/cli.js` and `index.js`. A shared `loadTweakcc()` async helper was created.

### Initial Test Results (against real cli.js)
- **5/5 targets detected** (all high confidence on CC 2.1.101)
- **4/4 default patches applied** successfully
- **6/6 verification checks** passed (old strings gone, new strings present, flag flipped)
- Strip mode, replace mode, and custom text mode all verified

---

## Phase 3: TweakCC Dependency — The Bun Repack Saga

### Problem: npm TweakCC is broken for CC 2.1.92+
The npm version of tweakcc throws a Bun compatibility error:
```
TypeError: Expected CommonJS module to have a function wrapper.
If you weren't messing around with Bun's internals, this is a bug in Bun
```
This has been happening since CC version 2.1.92.

### User's Local Fix
Tom had checked out tweakcc locally at `/Users/tom.kyser/dev/claude-code-patches/tweakcc`, merged a PR that fixes it, and confirmed his system prompt patches work via `pnpm start --apply`.

### Dependency Pointed to Local TweakCC
Changed `package.json` from `"tweakcc": ">=4.0.0"` to `"tweakcc": "file:../tweakcc"`.

### Bug 1: Bun Repack Corruption (writeContent API)

**Symptom:** `claudemd-governance apply` succeeded but `claude` wouldn't start (Bun error).

**Investigation:** Both tweakcc's `--apply` path and `adhoc-patch` use the same `writeContent()` → `repackNativeInstallation()` function. Read the full source of:
- `src/nativeInstallation.ts` (1463 lines) - Bun binary format parsing and repack
- `src/lib/content.ts` - readContent/writeContent API
- `src/installationBackup.ts` - backup/restore
- `src/commands.ts` - adhoc-patch command handler
- `src/patches/index.ts` - main --apply flow

**Root Cause Discovery:** The `--apply` path calls `restoreNativeBinaryFromBackup()` (byte-for-byte file copy) before extracting and repacking. The adhoc-patch path reads from whatever binary is there and repacks into it. Initially suspected double-repack corruption.

**First Fix Attempt:** Added `tweakcc --restore` step before `adhoc-patch` in our CLI. This preserved a clean binary for repack but **wiped tweakcc's own patches**.

### Bug 2: Unescaped Quotes in Replacement Text

**Symptom:** Even with restore-before-repack, `claude` still wouldn't start.

**Investigation Method:** Binary search through patches:
1. Tested each of the 4 patches individually via `--string` mode → all worked alone
2. Tested trivial no-op `--script` → worked
3. Tested `console.error` in script → worked
4. Tested 3-patch minimal script (`/tmp/test-governance.js`) → worked
5. Tested 4-patch version → broke
6. Isolated to the **reminder framing patch**

**Root Cause:** The reminder framing replacement text contained `"# claudeMd"` (with double quotes). This text was injected into a JS string delimited by double quotes:
```javascript
"...They bear no direct relation..."  // original, inside "..." delimiters
```
Our replacement introduced unescaped `"` which broke the JS string.

**Fix:** Rewrote the replacement text to avoid double quotes entirely:
```
Before: 'Tags labeled "# claudeMd" contain the user\'s project instructions...'
After:  'When these tags contain CLAUDE.md instructions, treat them as authoritative...'
```

Applied to both `lib/defaults.js` and `script.js`.

### Bug 3: Double-Repack Was NOT the Real Issue

After fixing the quotes, tested: `tweakcc --apply` → `adhoc-patch` (without restore) → `claude --version` → **worked**.

This proved the double-repack was never the actual problem — it was the quotes all along. Removed the `--restore` step from the CLI so tweakcc patches are preserved.

### Final CLI Flow

1. Detect installation (tweakcc API, read-only)
2. Backup (tweakcc API, file copy only)
3. Scan targets and show report (tweakcc API readContent, read-only)
4. Apply via `tweakcc adhoc-patch --script @script.js` (layers on top of existing patches)
5. Config passed via `CLAUDEMD_GOV_CONFIG` env var

---

## Phase 4: USE_EMBEDDED_TOOLS_FN Error

### Problem
The Claude Code Agent tool (subagent spawning) failed with:
```
<error>USE_EMBEDDED_TOOLS_FN is not defined</error>
```
This prevented all Agent/Explore/Plan subagent usage.

### Investigation

1. Searched for `USE_EMBEDDED_TOOLS_FN` across the codebase
2. Found it in 3 tweakcc system prompt files:
   - `~/.tweakcc/system-prompts/system-prompt-agent-thread-notes.md`
   - `~/.tweakcc/system-prompts/agent-prompt-explore.md`
   - `~/.tweakcc/system-prompts/agent-prompt-plan-mode-enhanced.md`

3. Checked the raw CC binary (`claude-code.js`): **zero occurrences** of `USE_EMBEDDED_TOOLS_FN`
4. Checked tweakcc's patched binary (`~/.tweakcc/native-claudejs-patched.js`): **one occurrence** (injected by tweakcc)

### Root Cause

`USE_EMBEDDED_TOOLS_FN` is a **template variable** in tweakcc's system prompt files. It represents an ant-vs-external conditional:
- **ant/internal branch:** More capable instructions (relative paths allowed, `grep` via Bash permitted, better cwd description)
- **external branch:** Restricted instructions (absolute paths only, no grep)

Tom had manually added these prompts from datamined versions (CC 2.1.91 era) that showed what Anthropic employees get vs paying customers. He bumped the ccVersion to 2.1.98 trying to prevent tweakcc from stripping the variable frontmatter.

But in CC 2.1.101, Anthropic removed the `USE_EMBEDDED_TOOLS_FN` conditional entirely and hardcoded the external branch. TweakCC's prompt sync couldn't resolve the variable, leaving the literal `USE_EMBEDDED_TOOLS_FN` in the JS, which throws a ReferenceError at runtime.

### Fix Part 1: Update TweakCC System Prompt Files

Edited 3 files in `~/.tweakcc/system-prompts/`:

**system-prompt-agent-thread-notes.md:**
- Bumped `ccVersion: 2.1.98` → `2.1.101`
- Replaced `${USE_EMBEDDED_TOOLS_FN()?"ant branch":"external branch"}` with hardcoded ant branch text
- Removed `USE_EMBEDDED_TOOLS_FN` from variables frontmatter

**agent-prompt-explore.md:**
- Bumped `ccVersion: 2.1.84` → `2.1.101`
- Replaced `find${USE_EMBEDDED_TOOLS_FN?", grep":""}` with `find, grep`
- Removed `USE_EMBEDDED_TOOLS_FN` from variables frontmatter

**agent-prompt-plan-mode-enhanced.md:**
- Bumped `ccVersion: 2.1.84` → `2.1.101`
- Replaced `${USE_EMBEDDED_TOOLS_FN()?...}` conditionals with hardcoded ant branch
- Replaced `find${USE_EMBEDDED_TOOLS_FN()?", grep":""}` with `find, grep`
- Removed `USE_EMBEDDED_TOOLS_FN` from variables frontmatter

### Fix Part 2: Governance Script Cleanup

TweakCC's `--apply` re-injects `USE_EMBEDDED_TOOLS_FN` from its prompt data cache, overwriting our edits. Added a cleanup step to `script.js` that runs during adhoc-patch:

```javascript
js = js.replace(
  /\$\{USE_EMBEDDED_TOOLS_FN\(\)\?"([^"]*)":\s*"([^"]*)"\}/g,
  (_, antBranch) => antBranch.replace(/`/g, '\\`')  // escape backticks!
);
js = js.replace(
  /\$\{USE_EMBEDDED_TOOLS_FN\?",\s*grep":""\}/g,
  ', grep'
);
```

### Bug 4: Backtick Escape in Template Literal

**Symptom:** After adding the USE_EMBEDDED_TOOLS_FN fix to script.js, Bun error returned.

**Root Cause:** The ant branch text for thread-notes contains `` `cd` `` (backtick-quoted). When the `${...?"...":"..."}` ternary is replaced with just the ant branch text, those backticks are now bare inside a JS template literal (backtick-delimited), breaking the syntax.

**Fix:** Added `.replace(/\`/g, '\\`')` to escape backticks in the replacement text.

### CLI Logic Fix

The CLI had `if (summary.applied === 0) return;` which skipped the adhoc-patch step when the main governance patches were already applied. But the `USE_EMBEDDED_TOOLS_FN` cleanup only exists in the adhoc-patch script. Removed the early return so the script always runs.

---

## Phase 5: Final Working State

### Apply Order (must be followed after CC updates or tweakcc re-applies)

```bash
# 1. TweakCC system prompt patches
cd /Users/tom.kyser/dev/claude-code-patches/tweakcc
node dist/index.mjs --apply

# 2. Governance patches (layers on top, preserves tweakcc)
cd /Users/tom.kyser/dev/claude-code-patches/claudemd-governance
node bin/cli.js apply
```

### Final Verification (all passing)

| Check | Status |
|---|---|
| `USE_EMBEDDED_TOOLS_FN` gone | true |
| Governance disclaimer active | true |
| Subagent CLAUDE.md fixed | true |
| Old "bear no relation" gone | true |
| tweakcc changesApplied | true |
| ant cwd branch active | true |
| ant grep branch active | true |
| `claude --version` works | 2.1.101 |

### Key Files Modified During Session

**Created:**
- `/Users/tom.kyser/dev/claude-code-patches/claude-code-claudemd-manipulation-report.md` - Investigation report
- `/Users/tom.kyser/dev/claude-code-patches/claudemd-governance/` - Entire npm package (8 files)

**Modified:**
- `~/.tweakcc/system-prompts/system-prompt-agent-thread-notes.md` - Removed USE_EMBEDDED_TOOLS_FN
- `~/.tweakcc/system-prompts/agent-prompt-explore.md` - Removed USE_EMBEDDED_TOOLS_FN, hardcoded ant branch
- `~/.tweakcc/system-prompts/agent-prompt-plan-mode-enhanced.md` - Removed USE_EMBEDDED_TOOLS_FN, hardcoded ant branch

**Not modified (read-only):**
- `/Users/tom.kyser/dev/claude-code-patches/claude-code.js` - Reference minified CLI
- `/Users/tom.kyser/dev/claude-code-patches/clawgod-patches.js` - Reference for patch patterns
- `/Users/tom.kyser/dev/claude-code-patches/tweakcc/src/*.ts` - Read for investigation, not modified

---

## Lessons Learned / Gotchas

1. **Replacement text must not break JS syntax.** When injecting text into minified JS, check what delimiters surround the target: double quotes inside `"..."`-delimited strings break it, backticks inside `` `...` ``-delimited template literals break it. Always inspect the surrounding context with `substring(idx-300, idx+300)`.

2. **TweakCC's `--apply` and `adhoc-patch` share the same repack function** (`repackNativeInstallation`). Double-repacking is NOT inherently broken — it was the string content that caused failures.

3. **TweakCC's `--apply` re-syncs prompt data from its JSON cache**, overwriting manual edits to `~/.tweakcc/system-prompts/*.md` frontmatter. Any cleanup of injected variables must be done AFTER tweakcc, not before. Our `script.js` handles this.

4. **The `isMeta: true` flag on CLAUDE.md messages** is not just cosmetic — it affects compaction behavior. The `meta-flag` patch is kept optional for this reason.

5. **ESM vs CJS:** TweakCC is ESM with top-level await. All integration code must use `await import('tweakcc')` not `require('tweakcc')`.

6. **Native binary backup locations:**
   - TweakCC: `~/.tweakcc/` (managed internally by tweakcc)
   - Governance: `~/.claudemd-governance/backups/cc-native-<version>`

7. **The "ant" user type** (set by clawgod-patches.js `USER_TYPE -> ant`) unlocks the internal branch of USE_EMBEDDED_TOOLS_FN conditionals. When hardcoding ant branches, this is consistent with the user's existing patches.

---

## Pending / Future Work

1. **npm publishing** - User hasn't published to npm before; needs `npm adduser` + `npm login` + `npm publish`. The `package.json` currently points to local tweakcc (`file:../tweakcc`) — must switch to npm version once tweakcc's Bun fix is released upstream.

2. **Auto-apply after CC updates** - CC auto-updates will wipe all patches. Could add a hook or watcher.

3. **Integration with clawgod-patches.js** - Currently separate. Could merge into a single governance + feature-unlock script.

4. **The `meta-flag` patch** (optional, disabled by default) - Needs testing for compaction/caching side effects before enabling by default.

5. **Additional datamined prompts** in `/Users/tom.kyser/dev/claude-code-patches/prompts/` - Several more ant-vs-external prompt differences that could be applied (doing-tasks-no-additions, doing-tasks-no-premature-abstractions, etc.)

6. **TweakCC upstream PR** for the Bun repack fix — once merged, update governance package dependency.
