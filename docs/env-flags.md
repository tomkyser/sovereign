# Environment Flags

The `env-flags` module sets 6 recommended CC environment variables in `~/.claude/settings.json`.
These unlock capabilities and prevent quality degradation.

## The 6 Flags

### CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING=1

**What it does:** Prevents CC from automatically reducing thinking depth on subsequent turns.

**Why it matters:** Without this, CC's adaptive thinking system progressively reduces the
thinking budget after the first few turns. Community research (F-031) measured a 67% drop in
thinking depth, correlating with increased "simplest approach" usage, reduced read-before-edit
behavior, and more hallucinations. This is the single largest quality lever available.

**Source:** CC's thinking configuration checks this env var to decide whether to adapt.

### MAX_THINKING_TOKENS=128000

**What it does:** Sets the maximum thinking token budget per turn to 128K.

**Why it matters:** The default budget is lower. With Opus 4.6's extended thinking capability,
higher budgets enable deeper reasoning chains for complex tasks.

**Interaction:** Works with `DISABLE_ADAPTIVE_THINKING` — the budget is the ceiling, but
adaptive thinking can reduce the effective budget below the ceiling if not disabled.

### CLAUDE_CODE_EFFORT_LEVEL=max

**What it does:** Sets CC's effort level to maximum, preventing automatic effort reduction.

**Why it matters:** CC can reduce effort level based on task complexity assessment. With
`max`, it always applies full effort. Combined with disabled adaptive thinking, this ensures
consistent quality across all turns.

### DISABLE_AUTOUPDATER=1

**What it does:** Prevents CC from automatically downloading and installing new versions.

**Why it matters:** A CC auto-update overwrites the patched binary with an unpatched one,
silently removing all governance protections. With the auto-updater disabled, updates are
manual and governance can be re-applied immediately after.

**The launch pre-flight detects version mismatches** even with the auto-updater disabled,
so if the user manually updates CC, governance catches it on next session start.

### ENABLE_LSP_TOOL=1

**What it does:** Activates the Language Server Protocol tool in CC.

**Why it matters:** The LSP tool provides IDE-like code intelligence (go-to-definition,
find-references, symbol search) using the project's language server. It's compiled into
the binary but gated behind this flag for external users.

### EMBEDDED_SEARCH_TOOLS=1

**What it does:** Activates three compiled-in search binaries: bfs 4.1, ugrep 7.5.0, rg 14.1.1.

**Why it matters:** Without this flag, CC uses system `find`, `grep`, and `rg` (which may
not be installed or may be older versions). With the flag:
- `find` → bfs 4.1 (breadth-first search, faster for large trees)
- `grep` → ugrep 7.5.0 (respects .gitignore, hidden files, binary detection)
- `rg` → ripgrep 14.1.1 (fast parallel search)

14 callsites in the binary respond to this flag. The binaries are already in every native
CC installation — no downloads needed.

**How it works:** CC's `ShellSnapshot.ts` generates shell functions that shadow `find` and
`grep` commands. The functions set `ARGV0` and invoke the CC binary itself, which dispatches
to the embedded tool based on argv[0].

## Checking Status

```bash
claude-governance modules
```

Shows whether all 6 vars are set. Missing vars are listed by name.

## Manual Verification

```bash
cat ~/.claude/settings.json | grep -A 10 '"env"'
```

Expected:
```json
{
  "env": {
    "CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING": "1",
    "MAX_THINKING_TOKENS": "128000",
    "CLAUDE_CODE_EFFORT_LEVEL": "max",
    "DISABLE_AUTOUPDATER": "1",
    "ENABLE_LSP_TOOL": "1",
    "EMBEDDED_SEARCH_TOOLS": "1"
  }
}
```

## What the Module Does NOT Do

- It does not overwrite existing values. If you've set `MAX_THINKING_TOKENS=64000`,
  the module will not change it to 128000.
- It does not remove vars. Disabling the module leaves existing vars in place.
- It does not modify any file other than `~/.claude/settings.json`.
