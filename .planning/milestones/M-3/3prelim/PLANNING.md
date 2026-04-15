# Phase 3prelim Planning — Codebase Reorganization

## Scope

Restructure the codebase for maintainability before M-3 adds features. No new
functionality — just moving code to where it belongs, adding type safety to tools,
and eliminating duplication.

## Approach

### Constraint: Deploy Format Is Fixed

The auto-discovery loader deploys single `.js` files to `~/.claude-governance/tools/`.
This contract stays. The restructuring happens in **source** — TypeScript tool sources
get built/bundled into the single `.js` deploy artifacts. This gives us type checking
and modular source without changing the deployment pipeline.

### Target Architecture

```
claude-governance/
  src/
    tools/                          # NEW — TypeScript tool sources
      ping/
        index.ts                    # tool definition + call()
      repl/
        index.ts                    # tool definition, call() orchestration
        prompt.ts                   # prompt text
        schema.ts                   # inputJSONSchema
        handlers/                   # 9 handler files
          read.ts
          write.ts
          edit.ts
          bash.ts
          grep.ts
          glob.ts
          notebook-edit.ts
          fetch.ts
          agent.ts
        vm.ts                       # VM sandbox, context management
        config.ts                   # REPL config loading/validation
        format.ts                   # result formatting, operation tracking
      tungsten/
        index.ts                    # tool definition, call() dispatch
        prompt.ts                   # prompt text
        schema.ts                   # inputJSONSchema
        actions/                    # 6 action files
          send.ts
          capture.ts
          create.ts
          list.ts
          kill.ts
          interrupt.ts
        tmux.ts                     # tmux command execution
        state.ts                    # AppState + state file management
        validate.ts                 # session name validation
    patches/
      governance/                   # Split from monolithic governance.ts
        index.ts                    # VERIFICATION_REGISTRY + exports
        disclaimer.ts               # PATCH 1
        context-header.ts           # PATCH 2
        system-reminder.ts          # PATCH 3
        subagent-claudemd.ts        # PATCH 4
        embedded-tools-gate.ts      # PATCH 5 (gate resolution)
        glob-grep-exclusion.ts      # PATCH 6
        tool-injection.ts           # PATCH 7
        repl-guidance.ts            # PATCH 8
        fs9.ts                      # PATCH 9
        render-tree.ts              # PATCH 10
        tungsten-guidance.ts        # PATCH 11
      orchestration/                # Split from monolithic index.ts
        index.ts                    # applyPatchImplementations, PATCH_DEFINITIONS
        deploy.ts                   # deployPromptOverrides, deployTools
        validate.ts                 # validateToolDeployment, runFunctionalProbe
      helpers.ts                    # existing — stays
      patchDiffing.ts               # existing — stays
      systemPrompts.ts              # existing — stays
  data/
    overrides/                      # prompt overrides — stays (canonical)
    prompts/                        # versioned prompt JSON — stays
    hooks/                          # hook files — stays (G21 future)
    ui/                             # tungsten-panel.js — stays
    tools/                          # GENERATED — built from src/tools/
      index.js                      # auto-discovery loader — hand-maintained
```

**Deleted:**
- `prompts/` at project root (orphaned duplicate of `data/overrides/`)
- `docs/` (empty)

### Build Pipeline Change

Tools need a build step: `src/tools/{name}/` → `data/tools/{name}.js`. Options:

**Option A: tsdown secondary entry points**
Add tool sources as tsdown entry points. Each tool bundles to a single `.js` file in
`data/tools/`. Pros: uses existing build tool. Cons: tsdown may not handle the
auto-discovery loader pattern well (it expects ESM, loader expects CJS-like exports).

**Option B: esbuild per-tool bundle**
Add a small build script that uses esbuild to bundle each tool directory into a single
`.js` file. Runs as a pre-build or parallel build step. Pros: precise control over
output format. Cons: new dependency.

**Option C: tsc + manual concatenation**
Compile to JS, then a script concatenates each tool's files into a single deploy artifact.
Pros: no new deps. Cons: fragile, order-dependent.

**Recommendation: Option A first, fallback to B.** tsdown already handles the main build.
If it can produce CJS-compatible single-file bundles for tools, we're done. If format
issues arise, esbuild is a clean fallback.

## Verification Protocol — Mandatory After Every Task

No exceptions. Every task in this phase must pass the full verification protocol before
being marked complete. Signature presence is necessary but not sufficient — every layer
must be proven functional. Ignorance of degradation is worse than degradation itself.

### Layer 1: Build Integrity
```bash
cd claude-governance && pnpm build
```
- Must compile with zero errors and zero warnings
- Build size must be within 10% of 170KB baseline (current)
- All entry points must exist in dist/

### Layer 2: Signature Verification
```bash
node dist/index.mjs check
```
- 20/20 SOVEREIGN — every signature present
- All 4 categories pass: Governance Patches, Gate Resolution, Prompt Overrides, Tool Injection
- Tool Deployment section: auto-discovery loader finds 3 tools, all shapes valid

### Layer 3: Clean Apply
```bash
node dist/index.mjs --restore && node dist/index.mjs --apply
```
- Restore succeeds (clean binary recovered)
- Apply succeeds (all patches applied to clean binary)
- Re-run check after apply → still 20/20 SOVEREIGN

### Layer 4: Functional Probe
```bash
node dist/index.mjs check
```
- The check command runs `validateToolDeployment()` — require() + shape check for each tool
- If a runtime probe is available (Ping via `claude -p`), run it
- Every deployed tool must have: name, call, prompt, description, inputJSONSchema

### Layer 5: Hook Integrity
```bash
# SessionStart hooks (alphabetical execution order)
node ~/.claude/hooks/embedded-tools-verify.cjs
node ~/.claude/hooks/governance-verify.cjs
node ~/.claude/hooks/tungsten-verify.cjs

# Stop hooks
node ~/.claude/hooks/tungsten-session-end.cjs
```
- governance-verify: reads state.json, reports SOVEREIGN status
- embedded-tools-verify: 8-point verification
- tungsten-verify: 5 checks (tmux, tool, FS9, panel, guidance)
- tungsten-session-end: exits cleanly when no session active

### Layer 6: Tool Deployment Validation
```bash
ls -la ~/.claude-governance/tools/
node -e "const t = require(process.env.HOME + '/.claude-governance/tools/index.js'); console.log(t.map(x=>x.name))"
```
- All 3 tools present: Ping, REPL, Tungsten
- Auto-discovery loader returns array of 3 tool objects
- Each tool responds to: `.name`, `.call()`, `.prompt()`, `.description`, `.inputJSONSchema`

### Layer 7: Restore Round-Trip
```bash
node dist/index.mjs --restore
claude --version  # binary works unpatched
node dist/index.mjs --apply
node dist/index.mjs check  # 20/20 SOVEREIGN again
```
- Restore produces a clean, unpatched binary
- `claude --version` works on the restored binary
- Re-apply succeeds on the restored binary
- Check confirms 20/20 after round-trip

### When to Run What

| Task | Layers Required |
|------|----------------|
| T1 (cleanup) | 1, 2 (no tool/patch changes) |
| T2 (patch split) | 1, 2, 3, 7 |
| T3 (orchestration split) | 1, 2, 3, 4, 6, 7 |
| T4 (tool pipeline) | 1, 4, 6 |
| T5 (Ping split) | 1, 2, 3, 4, 5, 6 |
| T6 (REPL split) | 1, 2, 3, 4, 5, 6 |
| T7 (Tungsten split) | 1, 2, 3, 4, 5, 6 |
| T8 (final) | **ALL 7 layers** |

If any layer fails at any task, the task is not complete. Fix before proceeding.

## Risks

1. **Silent behavioral regression** — Restructured code passes signatures but behaves
   differently at runtime. Mitigated by Layer 3-7 verification, especially the restore
   round-trip and tool deployment validation.
2. **Tool runtime format mismatch** — Build step produces ESM when loader expects CJS,
   or vice versa. Mitigated by Layer 6 validation (actually require() the built output).
3. **Deploy pipeline break** — `deployTools()` copies from `data/tools/`. If the build
   step doesn't produce files there, deployment breaks silently. Mitigated by Layer 6.
4. **Patch ordering** — Splitting governance.ts into 11 files must preserve the sequential
   application order in PATCH_DEFINITIONS. Mitigated by Layer 3 (clean apply) + Layer 7
   (round-trip).

## Phasing (within this phase)

Given the <=5 files per phase rule, this phase will need sub-phases or careful batching.
The dependency order is:

1. **Cleanup** — Delete orphaned prompts/, empty docs/. Zero risk. (2 operations)
2. **Patch split** — governance.ts → 11 files. index.ts → 3 files. Build, verify. (<=5 new files per batch)
3. **Tool build pipeline** — Set up tsdown/esbuild for src/tools/ → data/tools/. (1-2 files)
4. **Tool split: Ping** — Simplest tool. Validate the pipeline works end-to-end. (1 file)
5. **Tool split: REPL** — Complex. prompt.ts, schema.ts, handlers/, vm.ts, config.ts, format.ts. (<=5 per batch)
6. **Tool split: Tungsten** — Medium. prompt.ts, schema.ts, actions/, tmux.ts, state.ts. (<=5 per batch)
7. **Final verification** — Full build, check, apply, probe.

## Bidirectional Scope

**Phase → Milestone:** This phase unblocks M-3 by establishing proper patterns for
prompt override editing, tool modification, and patch development. Without this, every
M-3 phase fights the monolithic structure.

**Phase → Project:** The tool build pipeline (src/tools/ → data/tools/) becomes the
standard for all future tool development (M-4 REPL re-eval, M-4.5 Wire).

## Out of Scope

- New functionality
- Hooks module deployment (G21 — separate phase)
- Tool behavior changes
- Prompt content changes
