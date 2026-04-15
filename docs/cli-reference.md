# CLI Reference

All commands available via `claude-governance` (or `npx claude-governance`).

## Global Options

| Option | Description |
|--------|-------------|
| `-V, --version` | Output version number |
| `-d, --debug` | Enable debug mode (shows internal operations) |
| `-v, --verbose` | Enable verbose debug mode (includes diffs) |
| `--show-unchanged` | Show unchanged diffs (requires --verbose) |
| `-h, --help` | Display help |

## Commands

### `--apply` (or `-a`)

Apply governance patches and prompt overrides to the CC binary.

```bash
claude-governance --apply
claude-governance -a
```

**Flow:**
1. Detect CC installation
2. Back up original binary
3. Extract JS from binary
4. Apply governance patches (string replacements)
5. Apply prompt overrides (pieces matching)
6. Deploy external tools to `~/.claude-governance/tools/`
7. Repack JS into binary
8. Run verification
9. Write state.json

**Options:**
- `--patches <ids>` — Apply only specific patch IDs (comma-separated)

### `--restore` / `--revert`

Restore CC to its original (unpatched) state.

```bash
claude-governance --restore
```

**Flow:**
1. Check for backup at `~/.claude-governance/native-binary.backup`
2. Check backup for contamination (governance signatures)
3. If contaminated → fall back to binary vault (`~/.claude-governance/binaries/virgin-*.bin`)
4. If no clean backup available → attempt download
5. Restore binary

### `check [binary-path]`

Verify governance patches are applied. Does NOT modify the binary.

```bash
claude-governance check
claude-governance check /path/to/custom/binary
```

**Output:**
```
Governance:
  ✓ Disclaimer Neutralization
  ✓ Context Header Reframing
  ✓ System-Reminder Authority Fix
  ✓ Subagent CLAUDE.md Restoration — active (flag=false)

Gate:
  ✓ Embedded Tools Gate Resolution — all gates resolved
  ✓ Embedded Tools: Glob/Grep Exclusion — Glob/Grep excluded when embedded tools active

Tool Injection:
  ✓ Tool Injection — external tool loader active
  ✓ Tungsten: bashProvider tmux Activation — FS9() reads Tungsten socket info
  ✓ Tungsten: Live Panel Injection — present
  ✓ REPL Tool Guidance Injection — active in Using your tools
  ✓ Tungsten: Tool Guidance Injection — active in Using your tools

Prompt Overrides:
  ✓ Prompt Override: Explore
  ✓ Prompt Override: General Purpose
  ✓ Prompt Override: Agent Thread Notes
  ✓ Prompt Override: No Unnecessary Additions
  ✓ Prompt Override: No Premature Abstractions
  ✓ Prompt Override: Proportional Error Handling
  ✓ Prompt Override: Executing Actions
  ✓ Prompt Override: Tone & Style
  ✓ Prompt Override: Ambitious Tasks + REPL

  SOVEREIGN — 20/20 signatures present
```

### `launch [args...]`

Launch CC with pre-flight governance verification.

```bash
claude-governance launch
claude-governance launch -- --model opus
```

**Pre-flight:**
1. Read state.json
2. Compare binary fingerprint (size, mtime)
3. If mismatch → auto re-check (CC was updated)
4. If CC version changed → auto re-apply
5. Inject environment variables
6. Spawn CC with inherited stdio, signal forwarding, exit code propagation

**Options:**
- `--no-verify` — Skip pre-flight verification
- `--force-apply` — Reapply even if state shows current

### `setup`

Interactive first-run setup wizard.

```bash
claude-governance setup
```

**Steps:**
1. Detect CC installation
2. Show available modules
3. Interactive module selection
4. Apply governance patches
5. Apply prompt overrides
6. Deploy tools
7. Run runtime probe (Ping via `claude -p`)
8. Write state.json
9. Display results

### `modules`

List governance modules and their status.

```bash
claude-governance modules
```

### `--list-patches`

List all available patches with their IDs.

```bash
claude-governance --list-patches
```

### `--list-system-prompts [version]`

List available system prompt data files.

```bash
claude-governance --list-system-prompts
claude-governance --list-system-prompts 2.1.101
```

### `unpack <output-js> [binary-path]`

Extract JS from a native CC binary.

```bash
claude-governance unpack extracted.js
claude-governance unpack extracted.js ~/.local/share/claude/versions/2.1.101/claude
```

Produces a single JS file containing the full bundled code from the binary.
Useful for analysis, diffing between versions, or manual patching.

### `repack <input-js> [binary-path]`

Embed modified JS back into a native CC binary.

```bash
claude-governance repack modified.js
```

### `adhoc-patch`

Apply an ad-hoc patch to the CC binary (for development/testing).

```bash
claude-governance adhoc-patch
```

Interactive diff-based patching for one-off changes.

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 111 | Shim failsafe (sentinel code, triggers fallback to direct CC launch) |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CLAUDE_GOVERNANCE_CONFIG_DIR` | Override config directory path |
| `CLAUDE_GOVERNANCE_CC_PATH` | Override CC binary path |
| `CLAUDE_GOVERNANCE_DEBUG` | Enable debug output |
