# Phase 3prelim Research — Codebase Reorganization

## Reference Pattern: CC BashTool Structure

CC's own tool organization (from leaked source `src/tools/BashTool/`):

```
BashTool/
  toolName.ts              — exports BASH_TOOL_NAME constant (breaks circular deps)
  prompt.ts                — prompt generation (getSimplePrompt, getDefaultTimeoutMs, etc.)
  BashTool.tsx             — tool definition (buildTool), call() implementation, schema
  UI.tsx                   — renderToolUseMessage, renderToolResultMessage, etc.
  BashToolResultMessage.tsx — React component for result display
  bashPermissions.ts       — permission checks, wildcard matching
  bashSecurity.ts          — security validation
  commandSemantics.ts      — command interpretation
  destructiveCommandWarning.ts
  modeValidation.ts
  pathValidation.ts
  readOnlyValidation.ts
  sedEditParser.ts / sedValidation.ts
  shouldUseSandbox.ts
  utils.ts
```

**Key pattern:** Each tool is a directory. Prompt, schema, implementation, permissions,
and UI are separate files. Domain-specific logic (sed parsing, sandbox decisions,
destructive command detection) gets its own module.

## Current State Assessment

### What's Wrong

**1. Monolithic tools (data/tools/)**
- `repl.js` (919 lines) — prompt string, JSON schema, VM sandbox, 9 handler functions,
  console capture, operation tracking, result formatting, config loading, error handling,
  state management. All in one file.
- `tungsten.js` (565 lines) — prompt string, JSON schema, 6 action handlers, tmux
  management, AppState communication, state file management, session validation. All in
  one file.
- These are plain `.js` files deployed by copying. No TypeScript, no type checking, no
  build step.

**2. Monolithic patches (src/patches/)**
- `governance.ts` (1184 lines) — 11 patch implementation functions + VERIFICATION_REGISTRY.
  Each patch is an independent transformation but they all live in one file.
- `index.ts` (955 lines) — PATCH_DEFINITIONS array, patchImplementations map,
  applyPatchImplementations orchestrator, deployPromptOverrides, deployTools,
  validateToolDeployment, runFunctionalProbe, module integration.

**3. Orphaned/duplicate content**
- `prompts/` at project root — 9 .md files, original reference copies. Fork's
  `data/overrides/` is canonical. They've diverged (ambitious vs output-efficiency).
- `docs/` — empty directory.

**4. No build step for tools**
- Tools are `.js` files copied directly to deployment. No TypeScript checking, no import
  resolution, no dead code elimination. Bugs are caught at runtime in production.

### What's Right (Don't Break)

- Auto-discovery loader (`data/tools/index.js`) — scans dir for `.js` files. Simple, reliable.
- `deployTools()` copies from `data/tools/` to `~/.claude-governance/tools/`. Works.
- Build pipeline (`pnpm build` → tsdown) — compiles src/ into dist/. Clean, fast.
- Binary vault, verification pipeline, module system — all sound.
- 20/20 SOVEREIGN baseline — must be preserved through reorg.

## References

- CC BashTool: `/Users/tom.kyser/dev/cc-source/.../src/tools/BashTool/` [ccSource1]
- CC REPLTool (partial): `/Users/tom.kyser/dev/cc-source/.../src/tools/REPLTool/` — only constants.ts and primitiveTools.ts (F9: implementation not in leaked source)
