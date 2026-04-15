# claude-governance Developer Documentation

Complete technical documentation for the claude-governance toolkit.
Every claim in these docs is verified against the actual codebase at the stated version.

**Verified against:** claude-governance v0.1.0, CC v2.1.101

## Documents

| Document | What it covers |
|----------|---------------|
| [Architecture](architecture.md) | System components, data flow, file layout, build pipeline |
| [Binary Patching](binary-patching.md) | How patches work, the verification registry, patch lifecycle |
| [Prompt Overrides](prompt-overrides.md) | The 9 prompt override files, pieces matching, override pipeline |
| [Tool Injection](tool-injection.md) | REPL, Tungsten, Ping — how tools are loaded into CC's runtime |
| [Verification Engine](verification-engine.md) | The 20-point check system, state.json, SOVEREIGN status |
| [Session Hooks](session-hooks.md) | governance-verify, tungsten-verify, statusline, embedded-tools |
| [Configuration](configuration.md) | Config directory, config.json, modules, env flags, REPL modes |
| [CLI Reference](cli-reference.md) | All commands: apply, check, restore, launch, setup, modules, unpack, repack |
| [Env Flags](env-flags.md) | The 6 recommended CC environment variables and what they unlock |

## Quick Start

```bash
# Install
npm install -g claude-governance

# First-run setup (interactive)
claude-governance setup

# Apply patches
claude-governance --apply

# Verify everything
claude-governance check

# Launch CC with pre-flight verification
claude-governance launch
```

## How to Read These Docs

If you're new, start with **Architecture** to understand how the pieces fit together.
If you're debugging, start with **Verification Engine** to understand the check system.
If you're extending the tool, start with **Binary Patching** and **Tool Injection**.
