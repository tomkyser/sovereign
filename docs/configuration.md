# Configuration

claude-governance uses two configuration systems: its own `config.json` and CC's
`settings.json` (for environment variables).

## Config Directory

Resolution order (first match wins):
1. `CLAUDE_GOVERNANCE_CONFIG_DIR` environment variable
2. `~/.claude-governance/` (default)
3. `~/.tweakcc/` (legacy migration path from tweakcc)
4. `$XDG_CONFIG_HOME/claude-governance`

Source: `src/config.ts:getConfigDir()`

## config.json

Located at `~/.claude-governance/config.json`. Created by `setup` or `apply`.

### Governance-Relevant Fields

```json
{
  "ccVersion": "2.1.101",
  "ccInstallationPath": "/Users/.../.local/share/claude/versions/2.1.101",
  "changesApplied": true,
  "lastModified": "2026-04-15T02:28:48.652Z",

  "repl": {
    "mode": "coexist",
    "timeout": 120000,
    "maxResultSize": 100000
  },

  "modules": {
    "core": true,
    "env-flags": true
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `ccVersion` | string | CC version last applied against |
| `ccInstallationPath` | string\|null | Path to CC installation directory |
| `changesApplied` | boolean | Whether pending changes are applied |
| `repl.mode` | `"coexist"\|"replace"` | REPL operating mode (see below) |
| `repl.timeout` | number | VM execution timeout in ms (default: 120000) |
| `repl.maxResultSize` | number | Max result chars before truncation (default: 100000) |
| `modules` | object | Module enable/disable overrides |

### REPL Modes

**coexist** (default): REPL is available alongside all primitive tools (Read, Write, Edit,
Bash, Glob, Grep, Agent, NotebookEdit). The model can choose REPL for batch operations
or individual tools for single operations.

**replace**: Primitive tools are filtered from the tool registry. Only REPL (plus Ping and
Tungsten) is visible to the model. Filtered tools are stashed internally so REPL can still
delegate to them. The model's "Using your tools" prompt is adjusted accordingly.

### Inherited Fields (from tweakcc fork)

The config also contains fields inherited from the tweakcc fork that are not governance-related:

- `settings.themes` — UI color themes
- `settings.thinkingVerbs` — Thinking animation verbs
- `settings.thinkingStyle` — Thinking animation style
- `settings.userMessageDisplay` — User message formatting
- `settings.misc` — Various toggles (expand thinking blocks, etc.)
- `settings.toolsets` — Custom tool configurations
- `settings.inputPatternHighlighters` — Input highlighting rules

These are preserved from the fork but not actively used by governance features.

## CC Settings (settings.json)

Located at `~/.claude/settings.json`. The `env-flags` module writes environment variables
here via the `env` key.

### Recommended Environment Variables

Set by the `env-flags` module (`src/modules/env-flags.ts`):

| Variable | Value | Purpose |
|----------|-------|---------|
| `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING` | `1` | Prevents automatic thinking depth reduction |
| `MAX_THINKING_TOKENS` | `128000` | Maximum thinking budget per turn |
| `CLAUDE_CODE_EFFORT_LEVEL` | `max` | Prevents effort level reduction |
| `DISABLE_AUTOUPDATER` | `1` | Prevents CC from auto-updating (would overwrite patches) |
| `ENABLE_LSP_TOOL` | `1` | Activates the LSP (Language Server Protocol) tool |
| `EMBEDDED_SEARCH_TOOLS` | `1` | Activates embedded bfs/ugrep/rg binaries |

The module checks `settings.json` for missing vars and adds them. It never overwrites
existing values — if the user has set a different value, it's preserved.

### How env vars reach CC

CC reads `~/.claude/settings.json` at startup. The `env` object becomes `process.env`
entries for the session. Our `launch` command also injects them via the wrapper process.

## Module System

Modules implement the `GovernanceModule` interface:

```typescript
interface GovernanceModule {
  id: string;
  name: string;
  description: string;
  required: boolean;
  defaultEnabled: boolean;
  verificationEntries: VerificationEntry[];
  apply(context: ModuleContext): Promise<ModuleApplyResult>;
  getStatus(context: ModuleContext): Promise<ModuleStatus>;
}
```

### Current Modules

| Module | Required | Default | Description |
|--------|----------|---------|-------------|
| `core` | Yes | Enabled | All 20 governance verification entries |
| `env-flags` | No | Enabled | 6 recommended CC environment variables |

### Checking Module Status

```bash
claude-governance modules
```

Output:
```
Modules:
  ● core          Core governance patches (required)         6/6 env vars set
  ● env-flags     Environment Flags                          6/6 env vars set
```

### Disabling a Module

In `config.json`:
```json
{
  "modules": {
    "env-flags": false
  }
}
```

The `core` module cannot be disabled (`required: true`).

## Remote Configuration

config.json supports fetching settings from a URL:

```bash
claude-governance --apply --config-url https://example.com/config.json
```

The remote config is cached locally under the `remoteConfig` field. Machine-specific
fields (ccInstallationPath, ccVersion) always come from the local config.
