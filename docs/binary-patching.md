# Binary Patching

claude-governance modifies the CC native binary's embedded JavaScript to fix degradation
patterns. All patches use string-based pattern matching — no hardcoded byte offsets.

## How It Works

1. **Extract** — `node-lief` parses the Mach-O binary, extracts the embedded JS (~12.8M chars)
2. **Match** — Each patch finds its target via unique string patterns or regex
3. **Replace** — String replacement (no AST, the JS is minified)
4. **Verify** — Signature check confirms the replacement landed
5. **Repack** — Modified JS is embedded back into the binary via `node-lief`

## Patch Types

### Governance Patches (direct string replacement)

These replace specific text in the system prompt or binary JS:

| Patch ID | What it fixes | Method |
|----------|--------------|--------|
| `disclaimer` | CLAUDE.md wrapped in "may or may not be relevant" | Replace disclaimer text with authoritative framing |
| `header` | Context header says "you can use the following context" | Replace with "mandatory project instructions" |
| `reminder` | system-reminder tags described as "bear no direct relation" | Replace with "authoritative project directives" |
| `subagent` | `tengu_slim_subagent_claudemd` defaults to `true` (strip CLAUDE.md) | Flip flag to `false` |
| `gates` | `USE_EMBEDDED_TOOLS_FN` gates unresolved | Resolve gate checks |

### Tool Infrastructure Patches

| Patch ID | What it does | Method |
|----------|-------------|--------|
| `tool-injection` | Load external tools into CC's tool registry | Patch `getAllBaseTools()` to concat `require('~/.claude-governance/tools/index.js')` |
| `tungsten-fs9` | Activate tmux environment propagation | Replace `function FS9(){return null}` with function that reads `__CLAUDE_GOVERNANCE_TMUX_ENV` |
| `tungsten-panel` | Inject live monitor into TUI | Replace DCE'd `!1,null` at TungstenLiveMonitor site with `require()` of panel component |
| `embedded-tools-exclusion` | Verify Glob/Grep exclusion when embedded tools active | Pattern check (verification only, no modification) |

### Prompt Injection Patches

| Patch ID | What it does | Method |
|----------|-------------|--------|
| `repl-tool-guidance` | Add REPL usage guidance to "Using your tools" section | Append text via pieces matching |
| `tungsten-tool-guidance` | Add Tungsten usage guidance to "Using your tools" section | Append text via pieces matching |

## The Verification Registry

All patches are registered in `src/patches/governance/registry.ts` as `VERIFICATION_REGISTRY`:

```typescript
interface VerificationEntry {
  id: string;           // Unique identifier
  name: string;         // Human-readable name
  signature?: string | RegExp;     // Must be PRESENT after patching
  antiSignature?: string | RegExp; // Must be ABSENT after patching
  critical: boolean;    // Blocks SOVEREIGN status if failed
  category: 'governance' | 'gate' | 'prompt-override' | 'tool-injection';
  passDetail?: string;  // Additional pass message
}
```

There are currently **20 entries** across 4 categories:
- 4 governance patches (disclaimer, header, reminder, subagent)
- 2 gate checks (embedded-tools-gate, embedded-tools-exclusion)
- 9 prompt overrides
- 5 tool infrastructure (tool-injection, fs9, panel, repl-guidance, tungsten-guidance)

A check passes when:
- `signature` is present in the extracted JS (if defined)
- `antiSignature` is absent from the extracted JS (if defined)
- Both conditions met = pass

Status levels:
- **SOVEREIGN** — all 20 checks pass
- **PARTIAL** — some checks pass, some fail
- **UNPROTECTED** — critical checks fail

## Pattern Matching Strategy

Patches use **structural patterns**, not byte offsets or minified symbol names.

For example, the tool injection patch in `src/patches/governance/tool-injection.ts`:

1. Finds the `getAllBaseTools()` function by matching a structural pattern in the return statement
2. Uses the `getRequireFuncName()` helper to find the minified name of `require()`
3. Appends `.concat(require('~/.claude-governance/tools/index.js'))` to the tools array
4. Handles both coexist mode (append) and replace mode (filter + append + stash)

The pattern matching helpers in `src/patches/helpers.ts` include:
- `getRequireFuncName()` — finds the minified `require` function
- `findChalkVar()` — finds chalk module reference
- `getReactVar()` — finds React createElement reference
- `findTextComponent()` — finds Ink Text component
- `findBoxComponent()` — finds Ink Box component
- `getModuleLoaderFunction()` — finds the module loader wrapper
- `clearCaches()` — resets memoized pattern results between runs

All helpers use `RegExp` with structural context, not offset-based matching.

## Version Resilience

When Anthropic updates CC (new version), minified symbol names change. Our patches are designed
to survive this:

1. **Governance patches** match on English text in the prompt, not minified code
2. **Tool injection** matches on the return-array structure of `getAllBaseTools()`
3. **FS9 patch** matches on the function stub pattern `function FS9(){return null}` (actually
   a regex pattern that accounts for minification variants)
4. **Panel injection** matches on the unique DCE site signature in the render tree

If a pattern fails to match, the patch reports failure — it never silently degrades. The
`check` command detects any regression immediately after a CC update.

## Contamination Detection

The backup system includes contamination detection (`src/patches/governance/defaults.ts`):

```typescript
export const isContentPatched = (js: string): boolean => {
  return (
    js.includes(GOVERNANCE_DEFAULTS.disclaimerReplacement) ||
    js.includes(GOVERNANCE_DEFAULTS.headerReplacement) ||
    js.includes(GOVERNANCE_DEFAULTS.reminderFramingReplacement)
  );
};
```

If a backup contains governance signatures, it's contaminated (patched binary was backed up).
The system falls back to the binary vault (`~/.claude-governance/binaries/virgin-{version}.bin`)
which stores the original unmodified binary.

## Replace Mode vs Coexist Mode

The REPL tool has two operating modes configured via `config.json`:

- **coexist** (default) — REPL is added alongside primitive tools (Read, Write, Edit, Bash, etc.)
- **replace** — Primitive tools are filtered from the registry; only REPL is visible to the model

In replace mode, the tool injection patch:
1. Stashes filtered tools on the REPL tool object (`_stashedTools`)
2. Removes them from the returned array
3. REPL's `findTool()` checks stashed tools first, then `context.options.tools`

This ensures REPL can still delegate to tools the model can't directly see.
