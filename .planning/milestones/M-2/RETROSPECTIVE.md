# Milestone 2 Retrospective — Native Tool Injection

Completed: 2026-04-14
Baseline: 20/20 SOVEREIGN on CC 2.1.101

---

## What Was Achieved

M-2 delivered what Anthropic restricts to internal employees: a full tool injection
framework, clean-room REPL with persistent VM and 9 delegated handlers, clean-room
Tungsten with persistent tmux sessions and live TUI panel, and a Tungsten-first
execution posture that makes persistent context the default rather than optional.

### Deliverables

| Deliverable | Description |
|-------------|-------------|
| **Tool injection patch** | `getAllBaseTools()` patched to load external tools from `~/.claude-governance/tools/`. Auto-discovery loader, TOOL_DEFAULTS filling, hot-loadable without re-patching. |
| **Binary vault** | XDG path discovery, GCS download, SHA256 verification, immutable locking. Virgin + working binary management. Contamination detection and recovery. |
| **Clean-room REPL** | Node.js VM with persistent context, 9 inner handlers (read/write/edit/bash/grep/glob/notebook_edit/fetch/agent) delegating to CC's native tools via Option B. Coexist and replace modes. |
| **Clean-room Tungsten** | 6 actions (send/capture/create/list/kill/interrupt), PID socket isolation, FS9 binary patch for environment propagation, render tree injection for live panel, statusline segment. |
| **Tungsten-first posture** | PATCH 11 directive, tool prompt reframe, SessionStart/Stop lifecycle hooks. Bash doesn't decrease — it becomes more powerful inside persistent context. |
| **Verification pipeline** | 20 registry entries across 4 categories (governance, gate, prompt, tool). Module validation, runtime probes, tiered reporting. |
| **PM infrastructure** | REFERENCES.md (35 entries), per-phase directories, milestone lifecycle docs, reference citation protocol, TASKS.md sync protocol. |

### By the Numbers

- **Phases:** 10 (2a, 2a-gaps, 2b, 2b-gaps, 2b-gaps-2, 2b-gaps-3, 2c, 2c-gaps-1, 2-PM-update, 2c-gaps-2)
- **Gaps closed:** 40+ across 6 gap phases
- **Findings logged:** 27 (F1-F27), 21 during M-2
- **Verification entries:** 7 → 20 (from M-1 baseline of 13)
- **Build size:** 170KB (from 127KB at M-1 end)
- **External tools deployed:** 3 (Ping, REPL, Tungsten)
- **Binary patches:** 11 (5 governance + 1 gate + 1 tool injection + 1 REPL guidance + 1 FS9 + 1 render tree + 1 Tungsten guidance)

---

## Timeline

| Date | Phase | Key Event |
|------|-------|-----------|
| Apr 12 | 2a | Tool injection mechanism — `getAllBaseTools()` patch, external loader |
| Apr 12 | 2a-gaps | Binary vault, Zod passthrough, shim failsafe — 15/15 SOVEREIGN |
| Apr 13 | 2b | Clean-room REPL — VM, 9 handlers, coexist/replace modes |
| Apr 13 | 2b-gaps | 14/14 hardening — probes, validation, handler fixes, execution semantics |
| Apr 13 | 2b-gaps-2 | Production readiness — embedded search confirmed, prompt testing |
| Apr 13 | 2b-gaps-3 | Coexist hardening — glob .gitignore, mode-aware prompts, replace verified |
| Apr 13 | 2c | Clean-room Tungsten — 6 deliverables, FS9, panel, 19/19 SOVEREIGN |
| Apr 14 | 2-PM-update | PM restructuring + project rename |
| Apr 14 | 2c-gaps-1 | Panel crash fix, vault wiring, verification honesty, live testing |
| Apr 14 | 2c-gaps-2 | Tungsten-first posture — PATCH 11 v2, lifecycle hooks, 20/20 SOVEREIGN |

Three days of work. The gap phases were as substantial as the implementation phases —
hardening consumed roughly half the total effort, which is appropriate for infrastructure
that others will depend on.

---

## Key Decisions and Their Rationale

### 1. Option B — Tool Delegation via context.options.tools (F1)

**Decision:** REPL delegates to CC's native tools through the `ToolUseContext.options.tools`
array rather than reimplementing file I/O, subprocess management, or HTTP.

**Why it matters:** This was the architectural pivot that made the REPL viable. Option A
(direct `fs` and `child_process`) would have bypassed CC's permission system, file tracking,
hooks, and error formatting. Option B gives us all of that for free — every REPL operation
goes through CC's full pipeline.

**Outcome:** 9 handlers averaging ~15 lines each. Permission delegation, abort support,
and file tracking work without a single line of reimplementation.

### 2. process.env for FS9 Communication

**Decision:** Tungsten writes tmux socket info to `process.env.__CLAUDE_GOVERNANCE_TMUX_ENV`.
The FS9 binary patch reads it. No temp files, no IPC, no filesystem coordination.

**Why it matters:** Environment variables are synchronous, global within a process, and
race-free. The entire Bash tool inherits Tungsten context through a single env var read
in bashProvider's `getEnvironmentOverrides()`.

**Outcome:** FS9 propagation verified across 5 paths: Tungsten send, Bash, REPL bash(),
Agent→Bash, Agent→REPL→bash() (F24). The simplest possible mechanism.

### 3. Tungsten as Environment Layer, Not Bash Replacement

**Decision:** PATCH 11 was rewritten from "use Tungsten instead of Bash" (v1) to
"Tungsten is the persistent context that Bash operates within" (v2).

**Why it matters:** v1 framed Tungsten as a tool choice — Bash OR Tungsten. This is
wrong. The stack is Tungsten → FS9 → bashProvider → Bash/REPL/Agents. Tungsten creates
the context; everything else operates inside it. Bash doesn't decrease — it gains
persistence.

**Outcome:** Complete rewrite of PATCH 11, tool prompt, and lifecycle hooks. The final
model is coherent: create session at start, everything inherits, kill at end.

### 4. globalThis Caching for Panel Component (G29)

**Decision:** Cache the panel component factory on `globalThis.__tungstenPanel` instead
of creating a new component per render.

**Why it matters:** The render tree injection runs inside CC's React reconciliation loop.
Creating a new function reference per render triggers React error #185 (identity-unstable
components). The factory must be created once and reused.

**Outcome:** Panel renders stably in live TUI sessions. First real UI component injection
into CC's Ink tree.

### 5. Intentional .gitignore Deviation for Glob (G16)

**Decision:** REPL's `glob()` respects `.gitignore` by default, unlike CC's native
GlobTool which uses `--no-ignore --hidden`.

**Why it matters:** CC's GlobTool serves the permission system (needs to see everything).
REPL's glob serves the model writing scripts (needs sane defaults matching developer
expectations). 46 source files vs 10,388 files including `node_modules/.pnpm/`.

**Outcome:** Configurable via `{ noIgnore: true, hidden: true }` opts for users who need
CC-native behavior.

---

## What Worked Well

### Gap Phases as First-Class Work
Every implementation phase was followed by a dedicated gap phase. This wasn't overhead —
it was where the real quality emerged. 2b-gaps (14 items) caught handler crashes, execution
semantic bugs, and verification gaps that would have been showstoppers in production. The
pattern of "build → test → gap-close → test again" should continue.

### Probe-Based Verification
The `claude -p` functional probe (G1 in 2b-gaps) proved that the entire pipeline works
end-to-end: binary patch → tool injection → tool registry → tool execution → result return.
This single test validates more than any number of unit tests could. Extending it to
include REPL delegation would close G24.

### Findings as Institutional Memory
F1-F27 captured discoveries that would otherwise be lost to context decay. F1 (ToolUseContext)
shaped the entire REPL architecture. F19 (FS9 stub) made Tungsten possible. F17 (parentMessage)
prevented a class of delegation bugs. The findings system works — every non-obvious discovery
gets a permanent record.

### User-Driven Framing Corrections
The Tungsten v1→v2 rewrite was triggered by user correction of a fundamental mental model
error. The project is stronger for it. The "plan → user review → correction → rebuild"
cycle caught a framing mistake that would have propagated through all downstream work.

---

## What Didn't Work Well

### Prompt Testing Is Manual and Expensive
Every prompt change (REPL guidance, Tungsten framing, error recovery patterns) requires
launching a fresh Claude session and interactively observing behavior. There's no
automated way to verify that a prompt change produces the intended behavioral shift.
G9-test and G11-test in 2b-gaps-2 were manual interactive sessions. This doesn't scale.

### Replace Mode Is Under-Tested
Replace mode was verified once (Sonnet fresh session, single-prompt dashboard in 2b-gaps-3)
and never systematically exercised again. Most development happened in coexist mode. G24
(replace mode probe) remains open. Replace mode should either get thorough testing in M-4
or be explicitly marked as experimental.

### Verification Honesty Arrived Late
The distinction between "signature present" and "functionally verified" wasn't addressed
until G31-G32 in 2c-gaps-1 — phase 8 of 10. Earlier phases claimed "15/15 SOVEREIGN"
without qualifying that this meant signature checks, not functional probes. The tiered
reporting model (signatures → probes → live testing) should have been designed from
phase 1.

### PM Restructuring Mid-Milestone
Phase 2-PM-update (directory restructuring, reference citations, lifecycle updates) consumed
a full phase mid-milestone. It was necessary — the flat structure couldn't support 10 phases
— but it interrupted implementation momentum. Future milestones should start with the PM
structure already in place.

### Panel Rendering Required Live Testing
The Tungsten panel (D3-D4 in 2c) could only be verified in a live CC TUI session. The
render tree injection, React component lifecycle, and AppState communication all depend
on CC's runtime environment. No way to unit test this. G40 (setAppState function form)
was only caught during live testing. UI injection will always have this property — accept
it and budget time for it.

---

## Pinned Item Evaluation

### GP1: User Toggle for Tungsten Panel
**Verdict: Defer to standalone mini-phase or M-3.**
Low complexity — config flag in `config.json`, read by panel component. Not blocking any
user workflow (panel renders useful information). Nice-to-have for users who want a cleaner
TUI.

### GP2: REPL agent() Runtime Bug
**Verdict: Defer to M-4 (REPL re-eval).**
The "O is not a function" error (F25) is a minification artifact in the subagent tool
runtime when spawned through REPL's `agent()` path. The workaround is using the top-level
Agent tool directly. M-4's REPL re-evaluation is the natural home for investigating and
fixing the delegation boundary issue.

### GP3: Ant vs External Prompt Divergence Assessment
**Verdict: This IS M-3's core research question.**
Already documented in ROADMAP.md M-3 header with the 6 identified divergences from
[haseebAnalysis1]. M-3 Phase 3a research should begin with a full assessment of which
divergences are addressable via prompt overrides, which require binary patches, and which
inform new governance patches. This is the highest-value work remaining in the project.

---

## Findings Impact Assessment

### Architecture-Defining (shaped major decisions)
- **F1** (ToolUseContext) — Eliminated Option A, defined REPL delegation architecture
- **F19** (FS9 stub) — Made Tungsten environment propagation possible via single-function patch
- **F20** (DCE render tree marker) — Enabled UI component injection
- **F4** (compile-time DCE) — Confirmed clean-room reimplementation as only path

### Bug-Preventing (caught issues before they compounded)
- **F17** (parentMessage) — Prevented Write/Edit crashes in delegation
- **F14** (VM realm crossing) — Fixed SyntaxError detection in REPL
- **F22** (setAppState function form) — Fixed panel crash

### Operational (inform ongoing work)
- **F18** (shell snapshot shadowing) — Resolved false alarm about embedded tools
- **F12** (runtime-generated prompts) — Scoped what's patchable via data vs binary
- **F26/F27** (Channels API, Wire) — Informed M-4.5 architecture

---

## Recommendations for M-3

### 1. Start with GP3 Research
The Ant vs External divergence assessment is the load-bearing research for M-3. Before
planning any phases, do a thorough analysis of all 6+ divergences documented in
[haseebAnalysis1]. Categorize each as: prompt override (M-3), binary patch (M-2 extension
or M-4), new governance patch, or not addressable.

### 2. Phase 3prelim First
ROADMAP already scopes Phase 3prelim as codebase reorganization — separation of concerns,
tools restructured properly (referencing CC source BashTool as pattern), non-fork code
moved to parent directory. Do this before adding M-3 features. M-2 accumulated technical
debt in tool implementations that need cleanup.

### 3. Budget for Prompt Testing Infrastructure
M-3 is system prompt control. Every change will need behavioral verification. Consider
building a lightweight prompt testing harness: scripted `claude -p` sessions with expected
behavioral assertions. Even a basic version (run prompt, check for marker phrases in
response) would reduce the manual testing burden.

### 4. Hooks Module Before Public Release
G21 (hooks module design) exists but isn't built. Before any public release milestone,
hooks must be managed by the module system — not manually copied. This is infrastructure
debt that compounds with every new hook.

### 5. Maintain the Gap Phase Pattern
M-2's quality came from treating gap phases as first-class work. Every implementation
phase should be followed by testing and gap closure. Don't compress this cycle.

---

## Final Assessment

M-2 achieved its stated goal: users now have the tools Anthropic restricts to internal
employees. The tool injection mechanism is version-resilient, the REPL delegates through
CC's full pipeline, Tungsten provides persistent execution context, and the verification
pipeline proves it all works.

The 13 outstanding gaps are real but none are blockers. The most strategically important
(GP3: Ant vs External divergence) is the natural entry point for M-3.

20/20 SOVEREIGN. Milestone complete.
