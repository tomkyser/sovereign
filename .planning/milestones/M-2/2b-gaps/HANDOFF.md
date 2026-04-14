# Phase 2b-gaps Handoff — REPL Hardening + Functional Verification

Written: 2026-04-13
Status: COMPLETE (14/14 gaps)

## What Was Built

Closed all 14 gaps identified during Phase 2b testing. The REPL tool now has full functional verification, handler correctness, targeted execution semantics, and config validation.

### Functional Verification (G1-G6)

The entire verification story was rebuilt from file-existence checks to real validation:

1. **Module validation** — `validateToolDeployment()` uses `createRequire()` to load `index.js`, verify array return, check each tool's shape (name/call/prompt/description/inputJSONSchema). Runs in `check`, `launch`, and `apply` flows.

2. **Runtime probe** — `runFunctionalProbe()` spawns `claude -p` with a Ping marker after every `apply` and `setup`. Proves binary patch → tool injection → tool registry → tool execution end-to-end. Network/auth errors are inconclusive (not failures).

3. **State persistence** — `state.json` now carries `tools: { validated, names, count, probed, probeSuccess }`. Written by check/apply/launch.

4. **Hook awareness** — SOVEREIGN banner shows `Tools: Ping, REPL probe:✓`. Statusline shows `TOOLS:2` (green) or `TOOLS:!` (red).

### Handler Correctness (G7-G9)

- **notebook_edit** — probed CC source for schema. Added `source→new_source` normalization, required field validation, error surfacing from CC's response.
- **agent** — confirmed schema, added full option passthrough (model, name, mode, isolation, run_in_background), auto-generated description.
- **fetch** — prompt now explicitly documents AI-summarized output, recommends `bash('curl ...')` for raw HTTP.

### Execution Semantics (G10-G11)

- **IIFE targeting** — only `await` and `Illegal return` SyntaxErrors trigger IIFE wrapper. Genuine syntax errors (typos, missing braces) are reported directly with the original error.
- **Prompt accuracy** — persistence docs now correctly note `return` triggers async wrapping. Bare expressions documented as always working.

### Resilience (G12-G14)

- **Config validation** — validates `repl.mode` (coexist/replace), `timeout` (number >= 1000), `maxResultSize` (number >= 1000). Warns to stderr on invalid values.
- **Truncation** — code-reviewed, logic correct.
- **Prompt noise** — assessed acceptable, no action needed.

## Verification Pattern Established

Every future tool phase (2c Tungsten, 2d Context Snip) must include:
1. Runtime functional probe via `claude -p` in apply/setup
2. Module validation (require + shape) in check/launch
3. Tool name in SOVEREIGN banner and statusline
4. Tool state in state.json

## Post-Testing Fixes

User benchmark testing (Tom) revealed **write(), edit(), and read() were all crashing** — `TypeError: undefined is not an object (evaluating '$?.message.id')`. Root cause: CC's `FilePersistence` feature accesses `parentMessage.message.id` via optional chaining. Our mock parentMessage had `uuid` but not `message`. When parentMessage is `undefined` (not passed), the chain short-circuits safely. When it's a non-null object missing `.message`, it crashes. Fix: `{ uuid, message: { id, role, content } }`. See F17.

Also fixed: G10 IIFE targeting — `for await` produced "Unexpected reserved word" which the error-message regex missed. Switched to script-source checking (`/\bawait\b/` in script text) which is robust to V8 message wording changes.

## Remaining → Phase 2b-gaps-2

- **G15:** grep/glob use system `/usr/bin/grep` and `/usr/bin/find`, not embedded ugrep/bfs
- **G9-test / G11-test:** Prompt effectiveness testing (interactive observation required)

## What's Next

**Phase 2b-gaps-2** — close remaining gaps before moving to 2c.

**Then: Phase 2c: Clean-Room Tungsten** — tmux session management tool. Spec at `.planning/specs/tungsten-clean-room.md` (v0.2). Uses same auto-discovery loader and tool injection mechanism. Must follow the verification pattern established here.
