# Milestone 3.5 Retrospective — Wire + Message Components Control

Completed: 2026-04-17
Baseline: 32/32 SOVEREIGN on CC 2.1.101

---

## What Was Achieved

M-3.5 delivered two major capabilities: inter-session communication (Wire) and
full user control over message rendering in the TUI. Along the way, it also
produced a bytecode repack pipeline, a pattern migration framework, and the
first production component override.

### Deliverables

| Deliverable | Description |
|-------------|-------------|
| **Wire MCP server** | Channel-based inter-session messaging via CC's live Channels API. Typed protocol with urgency tiers, priority queue, bidirectional send/receive. |
| **Wire relay** | HTTP relay server for cross-session routing. Long-poll, broadcast, port fallback, auto-shutdown, disconnect buffering. |
| **Wire governance integration** | Wire as a module, shim auto-start, PATCH 13 channel dialog bypass, session hooks (verify + cleanup), settings registration. |
| **Tool visibility** | renderToolUseMessage returns visible React elements for all injected tools. Binary patch overrides empty-userFacingName suppression. |
| **Thinking restoration** | 5 suppression points identified and patched: SystemTextMessage dispatch, fullshow guard, assistant thinking guard, streaming auto-hide, transcript hide. |
| **Message override system** | `globalThis.__govMessageOverrides` / `__govContentOverrides` registries, binary injection at oOY/sOY switch dispatchers, lazy-loaded defaults.js, user components directory. |
| **Hidden commands unhide** | 6-location `isHidden` filter bypass. /init, /insights, and other hidden commands visible. |
| **REPL TUI visibility** | isAbsorbedSilently patch in collapseReadSearch (zJ6), transcript transform bypass (D_8). REPL tool calls now visible and persist in --resume. |
| **Env flag hardening** | Three-layer architecture: RECOMMENDED_ENV source of truth, launchEnv merge, dynamic shim exports. 7 mandatory env vars guaranteed at process level. |
| **Component override API** | Verified handler signature, production thinking-marker.js, corrected docs. Users can now write .js files that replace any message or content block renderer. |
| **Bytecode repack pipeline** | fetchNpmSource() + esbuild ESM→CJS transform + clearBytecode + raw overwrite. Future-proofs against Bun bytecode compilation. |
| **Pattern migration** | 13 governance patch regexes migrated from Bun-minified to esbuild CJS patterns. Framework for handling future CC build tool changes. |

### By the Numbers

- **Phases:** 8 (3.5a, 3.5b, 3.5c, 3.5d P0-P3, 3.5d gap phases x3)
- **Tasks:** 34 primary + 15 gap tasks
- **Gap phases:** 4 (P3-GAP-REPL, P3-GAP, P3-GAP-ENV, P1.5 pattern migration)
- **Binary patches added:** 12 new (SOVEREIGN 23→32)
- **Commits:** 28
- **Findings:** 6 new (F30-F35)

---

## Timeline

| Date | Milestone |
|------|-----------|
| 2026-04-12 | Phase 3.5a: Wire MCP server — channel contract established |
| 2026-04-13 | Phase 3.5b: Relay server, cross-session routing, disconnect buffering |
| 2026-04-13 | Phase 3.5c: Governance integration, PATCH 13, hooks, 23/23 SOVEREIGN |
| 2026-04-14 | Phase 3.5d P0: Tool visibility — REPL/Tungsten/Ping visible in TUI |
| 2026-04-14 | Phase 3.5d P1: Thinking restoration — 5 suppression points patched, 27/27 |
| 2026-04-15 | Bytecode repack crisis — 4 sessions to diagnose and fix Bun CJS crash |
| 2026-04-16 | P1.5: Pattern migration — 13 patches migrated for esbuild output, 28/29→32/32 |
| 2026-04-16 | Phase 3.5d P2: Message override system deployed, 29/29 |
| 2026-04-16 | Phase 3.5d P3: User customization — components dir, unhide commands, 30/30 |
| 2026-04-17 | Gap analysis — T18/T20 rubber-stamp discovered, 3 gap phases created |
| 2026-04-17 | P3-GAP-REPL: REPL visibility — 2 binary patches, TUI + resume verified |
| 2026-04-17 | P3-GAP-ENV: 3-layer env flag hardening, all 7 vars verified in live process |
| 2026-04-17 | P3-GAP: Component override verification — handler signature, production override, docs |

---

## Key Decisions

### D1: Wire via Channels API, not UDS Inbox
UDS Inbox was fully DCE'd. The Channels API was live and accessible via MCP server
pattern. This meant no binary patching for the transport layer — a significant
risk reduction.

### D2: esbuild ESM→CJS for repack pipeline
When Bun's bytecode compilation blocked source extraction, we pivoted to fetching
the npm package source and using esbuild to transform ESM→CJS. This added a build
step but eliminated the bytecode dependency entirely.

### D3: Gap phases over forward progress
When rubber-stamped tasks were discovered (T18/T20), we stopped forward progress
and created remediation gap phases. This cost 3 sessions but caught the
module.exports bug and __govReactRefs timing issue before they shipped.

### D4: RECOMMENDED_ENV as single source of truth
Instead of hardcoding env vars in three places, all 7 mandatory vars are defined
once in env-flags.ts and dynamically consumed by settings.json, launchEnv, and
the shim generator.

---

## What Worked

### Behavioral TUI verification
Testing in live Tungsten sessions caught bugs that build checks and SOVEREIGN
counts never would. The module.exports vs IIFE bug, the __govReactRefs timing
issue, the REPL visibility root cause — all discovered by actually running CC
and observing the output.

### Gap phase discipline
The gap phase framework (created in P3-GAP-REPL) proved its value immediately.
Each gap phase has clear scope, exit criteria, and prevents the "mark complete
and move on" failure mode that caused the rubber-stamp problem.

### Single-REPL orchestration
Once the feedback to prefer REPL over individual tool calls was internalized,
session efficiency improved dramatically. Binary analysis, file reading, and
pattern matching in a single JS script instead of 20+ tool calls.

### `script` for TUI capture
Using `script -q /tmp/log claude` solved the tmux scrollback problem where
Ink's terminal cleanup erased output on exit. This pattern should be standard
for TUI verification going forward.

---

## What Didn't Work

### Rubber-stamping completion
T18 (default component overrides) and T20 (API docs) were marked complete
based on build-time checks without behavioral verification. The override
was a skeleton that never rendered. The docs described a pattern that couldn't
work. Three gap phases were needed to fix this.

**Lesson:** Build success and SOVEREIGN count are necessary but not sufficient.
Features that render in the TUI must be tested in the TUI.

### Assuming __govReactRefs availability
The docs and initial override code assumed `globalThis.__govReactRefs` would
be available at component load time. It isn't — tool initialization (qe()) runs
after the first render cycle. Cost: multiple debugging iterations before discovering
that `require("ink")` at render time is the correct pattern.

**Lesson:** Initialization order in patched binaries is non-obvious. Always verify
availability with logging before building on assumptions.

### Progressive tool calls for binary analysis
Early in this milestone, binary analysis used dozens of individual Bash/Read calls
when a single REPL script could accomplish the same work in one call. This burned
context and accelerated compaction.

**Lesson:** REPL is the default for multi-step operations. Individual tools are
for single-file edits where diff visibility matters.

### Tmux capture limitations
Tungsten's `capture` action returns empty after CC exits because Ink clears the
terminal. This made it look like CC was "crashing" when it was actually completing
normally. Several debugging cycles were wasted on this misdiagnosis.

**Lesson:** Use `script` for persistent terminal capture. Don't trust empty
tmux capture as evidence of a crash — check exit codes first.

---

## Findings Impact

| Finding | Impact | Status |
|---------|--------|--------|
| F30: renderToolUseMessage null default | Root cause of invisible tools | Fixed in P0 |
| F31: Three visibility suppression mechanisms | Architectural understanding | Documented |
| F32: Five thinking suppression points | All 5 patched in P1 | Fixed |
| F33: Default effort is medium for Pro | RECOMMENDED_ENV sets max | Mitigated |
| F34: 27 null-rendered attachment types | Visibility toggle patch | Partially addressed |
| F35: Ultrathink hidden | Exposed via env flag | Mitigated |

---

## Pinned Items for Future Work

1. **Component override timing**: `__govReactRefs` should be set during the
   `__govOverridesInit` block (first render) rather than during qe() (tool init).
   This would make refs available to component loaders at load time.

2. **User toggle for Tungsten panel** (carried from M-2): keyboard shortcut or
   config flag to show/hide the live Tungsten panel.

3. **`--apply` should regenerate the shim**: Currently only `setup` regenerates
   the shim. Adding a new env var to RECOMMENDED_ENV requires re-running setup.

4. **Wire relay production hardening**: Auth, rate limiting, message persistence
   across relay restarts. Currently suitable for local dev, not multi-user.

---

## Session Feedback (Behavioral Corrections This Milestone)

These corrections from the user shaped the approach and should persist:

- **Use REPL aggressively** — minimize individual tool calls, batch in single scripts
- **Use Tungsten for TUI verification** — not `claude -p`, which skips the renderer
- **Never hardcode what should be dynamic** — VISION.md principle, violated once with env vars
- **Plan != Build** — state the plan, wait for approval, then execute
- **Behavioral verification is mandatory** — build checks are not done checks

---

## Conclusion

M-3.5 expanded the governance toolkit from infrastructure (patching, prompts, tools)
into user-facing features (Wire communication, custom rendering). The bytecode repack
crisis and rubber-stamp discovery added unplanned work but strengthened the project's
foundations — the repack pipeline handles future CC build changes, and the gap phase
framework prevents premature completion claims.

SOVEREIGN grew from 20/20 (end of M-2) to 32/32. The user now has transparent
thinking, visible tool calls, inter-session messaging, customizable rendering,
and hardened env flags — all running on software Anthropic ships but doesn't
let users control.
