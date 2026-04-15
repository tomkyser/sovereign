# Architecture

claude-governance is a CLI tool that patches the Claude Code (CC) native binary to restore
user authority. It operates on the installed CC binary, modifying its embedded JavaScript to
fix degradation patterns Anthropic ships to paying users.

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Claude Code Native Binary (Bun Mach-O, ~12.8MB JS)             │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │ System Prompt │  │ Tool Registry│  │ bashProvider/FS9   │   │
│  │ (3 pieces)   │  │ getAllBaseTools│ │ (tmux activation)  │   │
│  └──────┬───────┘  └──────┬───────┘  └────────┬───────────┘   │
│         │                  │                    │               │
│  Patches:                  │                    │               │
│  • disclaimer fix          │ Patches:           │ Patches:      │
│  • header reframe          │ • tool-injection   │ • FS9 stub    │
│  • reminder authority      │   (concat external │   replacement │
│  • subagent CLAUDE.md      │    tools onto       │               │
│  • 9 prompt overrides      │    registry array)  │               │
│  • REPL/Tungsten guidance  │                    │               │
│  • tungsten guidance       │                    │               │
│                            │                    │               │
└────────────────────────────┼────────────────────┼───────────────┘
                             │                    │
              ┌──────────────┴────────┐  ┌───────┴──────────────┐
              │ ~/.claude-governance/ │  │ React Render Tree    │
              │   tools/             │  │ Tungsten panel       │
              │     index.js         │  │ injection at DCE'd   │
              │     ping.js          │  │ TungstenLiveMonitor  │
              │     repl.js          │  │ site                 │
              │     tungsten.js      │  └──────────────────────┘
              └──────────────────────┘
```

## CC Binary Structure

The CC native binary is a Bun-compiled Mach-O (macOS) containing:

1. **Bun runtime** — embedded V8-like JS engine
2. **Bundled JS** — ~12.8 million characters, minified by Bun's bundler
3. **Embedded binaries** — bfs 4.1, ugrep 7.5.0, rg 14.1.1 (activated by `EMBEDDED_SEARCH_TOOLS=1`)

The binary is located at: `~/.local/share/claude/versions/{version}/claude`

Extraction: `claude-governance unpack output.js [binary-path]`
Repacking: `claude-governance repack input.js [binary-path]`

The extraction/repacking uses `node-lief` to manipulate the Mach-O binary structure and
`wasmagic` for format detection.

## System Prompt Architecture

CC's system prompt has three pieces (in order):

1. **Billing header** — injected by Anthropic's API proxy, contains subscription/usage info
2. **Static prompt** — the main system prompt, stored as prompt data files in the binary
3. **Dynamic prompt** — assembled at runtime from enabled tools, flags, session state

The static prompt is composed of named sections ("System", "Doing tasks", "Tone and style",
etc.) stored in JSON data files. These are what our prompt overrides target.

A `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` marker separates the static (cached) portion from the
dynamic portion. Anthropic uses this for prompt caching — content before the boundary is
cached across turns, content after is regenerated each turn.

## Data Flow: Apply

```
claude-governance --apply
        │
        ├── 1. Detect CC installation (installationDetection.ts)
        │     └── Searches: Homebrew, npm global, XDG versions dir, direct binary
        │
        ├── 2. Back up original binary (installationBackup.ts)
        │     └── Binary-safe copy to ~/.claude-governance/native-binary.backup
        │     └── Virgin copy to ~/.claude-governance/binaries/virgin-{version}.bin
        │
        ├── 3. Extract JS from binary (nativeInstallation.ts)
        │     └── node-lief Mach-O parsing → raw JS string
        │
        ├── 4. Check contamination (defaults.ts)
        │     └── If backup already patched → vault fallback → clean backup
        │
        ├── 5. Apply governance patches (orchestration/deploy.ts)
        │     └── For each patch in registry:
        │           └── Pattern match → string replace → verify signature present
        │
        ├── 6. Apply prompt overrides (systemPrompts.ts + pieces matching)
        │     └── For each .md file in data/overrides/:
        │           └── Parse frontmatter → find matching section → replace content
        │
        ├── 7. Deploy external tools (orchestration/deploy.ts)
        │     └── Copy data/tools/*.js → ~/.claude-governance/tools/
        │     └── Copy data/ui/*.js → ~/.claude-governance/tools/
        │
        ├── 8. Repack JS into binary (nativeInstallation.ts)
        │     └── node-lief Mach-O manipulation → write modified binary
        │
        ├── 9. Run verification (verification.ts)
        │     └── 20 signature checks against modified JS
        │
        └── 10. Write state.json (verification.ts)
              └── Timestamp, version, per-check results, status
```

## Data Flow: Check

```
claude-governance check
        │
        ├── 1. Detect CC installation
        ├── 2. Extract JS from binary (no backup needed)
        ├── 3. Run 20 verification checks against extracted JS
        ├── 4. Validate tool modules (require + shape check)
        └── 5. Write state.json, display results
```

## Source Code Layout

```
claude-governance/
  src/
    patches/
      governance/          # Individual patch files
        registry.ts        # VERIFICATION_REGISTRY — 20 entries
        defaults.ts        # Replacement text constants
        disclaimer.ts      # Fix dismissive CLAUDE.md framing
        context-header.ts  # Reframe context header
        system-reminder.ts # Fix system-reminder authority
        subagent-claudemd.ts  # Restore CLAUDE.md to subagents
        embedded-tools-gate.ts # Resolve USE_EMBEDDED_TOOLS_FN
        tool-injection.ts  # Patch getAllBaseTools() to load external tools
        fs9.ts             # Patch FS9() stub to read Tungsten socket
        render-tree.ts     # Inject Tungsten panel into React tree
        repl-guidance.ts   # Inject REPL guidance into "Using your tools"
        tungsten-guidance.ts # Inject Tungsten guidance into "Using your tools"
        ismeta-flag.ts     # Fix isMeta/isNonInteractive flags
        types.ts           # GovernancePatch type
        index.ts           # Barrel exports
      orchestration/
        deploy.ts          # applyGovernancePatches(), deployTools(), deployPromptOverrides()
        validate.ts        # validateToolModules()
        index.ts           # Barrel exports
      helpers.ts           # Pattern matching: findChalkVar, getReactVar, etc.
      systemPrompts.ts     # Pieces matching engine for prompt overrides
    tools/
      ping/index.ts        # Ping tool — diagnostic probe
      repl/                # REPL tool — 16 modules
        index.ts           # Tool definition (name, description, schema, call, prompt)
        vm.ts              # Node VM sandbox with persistent context
        config.ts          # Config loading (repl.mode, timeout, maxResultSize)
        format.ts          # Result formatting and truncation
        schema.ts          # Input JSON schema
        prompt.ts          # Model-facing prompt text
        handlers/          # 9 inner tool handlers
          read.ts          # Delegates to CC's Read tool
          write.ts         # Delegates to CC's Write tool
          edit.ts          # Delegates to CC's Edit tool
          bash.ts          # Delegates to CC's Bash tool
          glob.ts          # Constructs find command → Bash
          grep.ts          # Constructs grep command → Bash
          fetch.ts         # Delegates to CC's WebFetch tool
          agent.ts         # Delegates to CC's Agent tool
          notebook_edit.ts # Delegates to CC's NotebookEdit tool
          index.ts         # Handler registry
      tungsten/            # Tungsten tool — 12 modules
        index.ts           # Tool definition
        tmux.ts            # tmux process management
        state.ts           # State file I/O (tungsten-state.json)
        validate.ts        # Input validation
        schema.ts          # Input JSON schema
        prompt.ts          # Model-facing prompt text
        actions/           # 6 action handlers
          create.ts        # Create named tmux session
          send.ts          # Execute command in session
          capture.ts       # Read terminal output
          list.ts          # List active sessions
          kill.ts          # End session, cleanup
          interrupt.ts     # Send Ctrl-C
    modules/
      registry.ts          # Module registry
      core.ts              # Core module (wraps VERIFICATION_REGISTRY)
      env-flags.ts         # Env flags module (6 recommended vars)
      types.ts             # GovernanceModule interface
      index.ts             # Barrel exports
    lib/                   # Shared library
      detection.ts         # CC installation detection
      backup.ts            # Binary backup/restore
      content.ts           # Binary content read/write
      config.ts            # Config helpers
      types.ts             # Installation type
      index.ts             # Public API barrel
    verification.ts        # Verification engine
    config.ts              # Config dir resolution, read/write
    commands.ts            # CLI subcommands (unpack, repack, adhoc-patch)
    startup.ts             # CLI entry point, commander setup
    setup.ts               # First-run setup wizard
    shim.ts                # Transparent claude shim
    binaryVault.ts         # Binary vault (virgin backup management)
    installationBackup.ts  # Backup/restore with contamination detection
    installationDetection.ts # Multi-strategy CC binary detection
    installationPaths.ts   # Search paths for CC installations
    nativeInstallation.ts  # Native binary extraction/repacking
    nativeInstallationLoader.ts # Lazy loading for native deps
    systemPromptSync.ts    # Prompt data sync and hash tracking
    systemPromptDownload.ts # Download older prompt versions from GitHub
    systemPromptHashIndex.ts # Hash-based change detection
    utils.ts               # Shared utilities
    version.ts             # Package version
    types.ts               # Config types (TweakccConfig, Settings, etc.)
  data/
    overrides/             # 9 prompt override .md files (see prompt-overrides.md)
    tools/                 # Built tool implementations deployed to ~/.claude-governance/tools/
      index.js             # Auto-discovery tool loader
      package.json         # { "type": "commonjs" }
      ping.js              # Built from src/tools/ping/
      repl.js              # Built from src/tools/repl/ (33KB)
      tungsten.js          # Built from src/tools/tungsten/ (17KB)
    ui/
      tungsten-panel.js    # Live monitor panel component (3KB)
    prompts/               # CC system prompt data files (JSON, per-version)
  dist/                    # Build output
    index.mjs              # CLI entry point
    lib/                   # Library exports (index.mjs, index.d.ts)
```

## Build Pipeline

Two build steps configured in `package.json`:

1. **Main build:** `tsc --noEmit && tsdown --minify --dts src/index.tsx src/lib/index.ts`
   - TypeScript type checking (no emit)
   - tsdown bundles to ESM (`dist/index.mjs`, `dist/lib/index.mjs`)
   - DTS generation for library consumers

2. **Tool build:** `tsdown --config tsdown.tools.config.ts`
   - Builds each tool (ping, repl, tungsten) to CJS (`data/tools/*.cjs`)
   - Post-build renames `.cjs` → `.js` (CC's `require()` expects .js)
   - No shared chunks — each tool is self-contained

## Runtime Directories

| Path | Purpose |
|------|---------|
| `~/.claude-governance/` | Config directory (primary) |
| `~/.claude-governance/config.json` | User configuration |
| `~/.claude-governance/state.json` | Verification state (written by check/apply) |
| `~/.claude-governance/tools/` | Deployed tool implementations |
| `~/.claude-governance/binaries/` | Binary vault (virgin backups) |
| `~/.claude-governance/system-prompts/` | Extracted prompt data |
| `~/.claude-governance/native-binary.backup` | Last-good binary backup |
| `~/.claude/hooks/` | CC session hooks |
| `~/.claude/settings.json` | CC settings (env vars injected here) |

## Module System

Governance modules implement the `GovernanceModule` interface:

```typescript
interface GovernanceModule {
  id: string;
  name: string;
  description: string;
  required: boolean;       // Cannot be disabled
  defaultEnabled: boolean;
  verificationEntries: VerificationEntry[];
  apply(context: ModuleContext): Promise<ModuleApplyResult>;
  getStatus(context: ModuleContext): Promise<ModuleStatus>;
}
```

Current modules:
- **core** (required) — 20 verification entries covering all governance patches
- **env-flags** (default enabled) — 6 recommended CC environment variables

Module enable/disable via `config.json`:
```json
{
  "modules": {
    "core": true,
    "env-flags": true
  }
}
```
