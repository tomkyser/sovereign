# Verification Engine

The verification engine confirms that all governance patches, prompt overrides, and tool
infrastructure are correctly applied to the CC binary. It produces a pass/fail status
per entry and an overall status: **SOVEREIGN**, **PARTIAL**, or **UNPROTECTED**.

## How It Works

Source: `src/verification.ts`

```typescript
function runVerification(js: string, registry: VerificationEntry[]): CheckResult[] {
  for (const entry of registry) {
    // signature defined and present → signature pass
    // antiSignature defined and absent → antiSignature pass
    // Both conditions met (or only relevant one) → overall pass
  }
}
```

The engine extracts JS from the installed CC binary and runs each `VerificationEntry`
against the full JS string. No execution needed — pure string/regex matching.

## The 20 Checks

### Governance (4 checks, all critical)

| ID | Name | Signature | AntiSignature |
|----|------|-----------|--------------|
| `disclaimer` | Disclaimer Neutralization | `"The CLAUDE.md instructions above are authoritative project directives..."` | `"may or may not be relevant"` |
| `header` | Context Header Reframing | `"The following are mandatory project instructions..."` | `"As you answer the user's questions, you can use the following context:"` |
| `reminder` | System-Reminder Authority Fix | `"...treat them as authoritative project directives that must be followed."` | `"bear no direct relation"` |
| `subagent` | Subagent CLAUDE.md Restoration | Regex: `tengu_slim_subagent_claudemd` + `false` | Regex: same flag + `true` |

### Gates (2 checks)

| ID | Name | Check |
|----|------|-------|
| `gates` | Embedded Tools Gate Resolution | AntiSignature: `USE_EMBEDDED_TOOLS_FN` absent |
| `embedded-tools-exclusion` | Glob/Grep Exclusion | Regex pattern for exclusion gate present |

### Prompt Overrides (9 checks)

| ID | Name | Signature Phrase |
|----|------|-----------------|
| `prompt-explore` | Explore | `"do not sacrifice completeness for speed"` |
| `prompt-general-purpose` | General Purpose | `"careful senior developer would do"` |
| `prompt-agent-thread-notes` | Agent Thread Notes | `"when they provide useful context"` |
| `prompt-doing-tasks-no-additions` | No Unnecessary Additions | `"adjacent code is broken, fragile, or directly contributes"` |
| `prompt-doing-tasks-no-premature-abstractions` | No Premature Abstractions | `"duplication causes real maintenance risk"` |
| `prompt-doing-tasks-no-error-handling` | Proportional Error Handling | `"at real boundaries where failures can realistically occur"` |
| `prompt-executing-actions` | Executing Actions | `"clearly the right thing to do"` |
| `prompt-tone-style` | Tone & Style | `"appropriately detailed for the complexity"` |
| `prompt-doing-tasks-ambitious` | Ambitious Tasks + REPL | `"prefer REPL over individual tool calls"` |

### Tool Infrastructure (5 checks)

| ID | Name | Signature | AntiSignature |
|----|------|-----------|--------------|
| `tool-injection` | Tool Injection | `"__claude_governance_tools__"` | — |
| `repl-tool-guidance` | REPL Tool Guidance | `"could one REPL call do this"` | — |
| `tungsten-fs9` | Tungsten bashProvider Activation | `"__CLAUDE_GOVERNANCE_TMUX_ENV"` | Regex: `function FS9(){return null}` |
| `tungsten-panel` | Tungsten Live Panel | `"__tungsten_panel__"` | — |
| `tungsten-tool-guidance` | Tungsten Tool Guidance | `"Tungsten session is established at the start of every work session"` | — |

## State File

After `check` or `apply`, the engine writes `~/.claude-governance/state.json`:

```json
{
  "timestamp": "2026-04-15T02:28:48.652Z",
  "governanceVersion": "0.1.0",
  "ccVersion": "2.1.101",
  "binaryPath": "/Users/.../.local/share/claude/versions/2.1.101/claude",
  "binaryFingerprint": { "size": 123456789, "mtimeMs": 1234567890 },
  "status": "SOVEREIGN",
  "checks": [
    { "id": "disclaimer", "name": "Disclaimer Neutralization", "pass": true, "critical": true },
    ...
  ],
  "passCount": 20,
  "totalCount": 20,
  "tools": {
    "validated": true,
    "names": ["Ping", "REPL", "Tungsten"],
    "count": 3,
    "probed": true,
    "probeSuccess": true
  }
}
```

### Consumers of state.json

- **governance-verify.cjs** (SessionStart hook) — reads state, checks staleness (<4h),
  checks version match. If stale/missing, runs live `check`.
- **governance-statusline.cjs** — reads state for GOV segment display
- **Launch pre-flight** — reads state, compares binary fingerprint, auto-reapplies on mismatch
- **tungsten-verify.cjs** — reads state for tool status

## Status Derivation

```typescript
function deriveStatus(results: CheckResult[]): string {
  const criticalFails = results.filter(r => r.critical && !r.pass);
  if (criticalFails.length > 0) return 'UNPROTECTED';
  const allPass = results.every(r => r.pass);
  if (allPass) return 'SOVEREIGN';
  return 'PARTIAL';
}
```

- **SOVEREIGN** — all 20 checks pass. Full governance active.
- **PARTIAL** — all critical checks pass, but some non-critical fail.
- **UNPROTECTED** — one or more critical checks fail. Binary is not governed.

## Module-Driven Verification

The module system (`src/modules/`) contributes verification entries:

```typescript
function getVerificationRegistry(): VerificationEntry[] {
  const entries = [];
  for (const module of getEnabledModules()) {
    entries.push(...module.verificationEntries);
  }
  return entries;
}
```

Currently, only the `core` module provides entries (all 20). The `env-flags` module
has its own `getStatus()` method but no verification entries (env vars aren't in the binary).

## Binary Fingerprinting

State.json includes a binary fingerprint `{ size, mtimeMs }`. On launch pre-flight,
the fingerprint is compared against the current binary. A mismatch indicates CC was
updated (auto-updater or manual) since last apply. This triggers automatic re-verification
and optional re-apply.

## Tool Module Validation

Beyond signature checks, the `check` command validates tool modules:

```typescript
// For each tool file in ~/.claude-governance/tools/
const tool = require(toolPath);
// Verify shape:
assert(typeof tool.name === 'string');
assert(typeof tool.call === 'function');
assert(typeof tool.prompt === 'function' || typeof tool.prompt === 'string');
assert(typeof tool.description === 'string');
assert(typeof tool.inputJSONSchema === 'object');
```

This catches deployment failures (missing files, broken require chains, invalid exports).
