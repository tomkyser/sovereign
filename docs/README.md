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
# Clone and build
git clone https://github.com/anthropics/claude-code-patches.git
cd claude-code-patches/claude-governance
pnpm install
pnpm build

# Apply governance patches to your local Claude Code binary
node dist/index.mjs -a

# Verify all patches applied
node dist/index.mjs check

# Launch Claude Code (governance shim handles pre-flight automatically)
claude
```

## How to Read These Docs

If you're new, start with **Architecture** to understand how the pieces fit together.
If you're debugging, start with **Verification Engine** to understand the check system.
If you're extending the tool, start with **Binary Patching** and **Tool Injection**.

## Component Override API

User-customizable message and content block rendering. Override any message type
or content block type with custom React components.

### Directory Structure

```
~/.claude-governance/
├── overrides/
│   └── defaults.js          # Registry initializer + component scanner
└── components/
    └── *.js                  # User-defined override handlers
```

### How It Works

1. Binary patches inject override checks before the message renderer (`oOY()`) and
   content renderer (`sOY()`) switch statements
2. On first render, `defaults.js` is lazy-loaded via `require()`
3. `defaults.js` initializes the registries and scans `~/.claude-governance/components/`
4. Each `.js` file in components/ is loaded and its handlers registered

### Handler Signature

```javascript
// Message override: intercepts full message rendering
function messageHandler(message, props, React) {
  // message — the message object with .type ("system", "assistant", "user", etc.)
  // props   — full component props passed to the renderer
  // React   — the React instance from the binary scope
  
  // Return a React element to replace the default rendering
  // Return null to fall through to the default renderer
  return null;
}

// Content block override: intercepts content block rendering
function contentHandler(block, props, React) {
  // block — the content block with .type ("tool_use", "text", "thinking", etc.)
  // props — full component props
  // React — the React instance
  
  return null;
}
```

### Writing a Component Override

Create a `.js` file in `~/.claude-governance/components/`:

```javascript
// ~/.claude-governance/components/my-override.js
(function() {
  var refs = globalThis.__govReactRefs;
  if (!refs || !refs.R) return {};

  var React = refs.R;
  var Text = refs.Text;

  return {
    messageOverrides: {
      // Override system message rendering
      system: function(message, props, R) {
        return React.createElement(Text, { color: "green" }, "SYS: " + message.content);
      }
    },
    contentOverrides: {
      // Override thinking block rendering
      thinking: function(block, props, R) {
        return React.createElement(Text, { color: "magenta" }, block.thinking);
      }
    }
  };
})();
```

### Available React Refs

`globalThis.__govReactRefs` provides:
- `R` — React instance (`createElement`, `useState`, etc.)
- `Box` — Ink Box component (layout)
- `Text` — Ink Text component (styled text output)

### Message Types

| Type | Description |
|------|-------------|
| `system` | System messages |
| `assistant` | Assistant responses |
| `user` | User input |
| `attachment` | File attachments |
| `grouped_tool_use` | Grouped tool calls |
| `collapsed_read_search` | Collapsed read/search results |

### Content Block Types

| Type | Description |
|------|-------------|
| `tool_use` | Individual tool call |
| `text` | Text content |
| `thinking` | Thinking/reasoning block |
| `redacted_thinking` | Redacted thinking |

### Default Overrides

Shipped in `data/components/defaults.js` and deployed to `~/.claude-governance/components/`
during `claude-governance -a`. Edit or replace to customize.

### Error Handling

Each component file is loaded in a try/catch. A failing component will not crash
the renderer — it silently falls through to default rendering. Individual handler
errors are also caught per-invocation.

