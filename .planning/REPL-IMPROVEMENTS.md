# REPL Tool — Improvement Observations

Living document. Every session and agent MUST log observations here per the
CLAUDE.md directive. No filtering — raw feedback, ideas, friction points, and
enhancement opportunities. User will deliberate on these independently.

## Format

Each entry: date, context (what you were doing), observation. One line or a short
paragraph. Tag with a category if obvious.

### Categories
- **friction** — something that slowed you down or required workarounds
- **missing** — capability you wished existed
- **prompt** — improvement to REPL's prompt text or guidance
- **error** — error handling or recovery that could be better
- **pattern** — a usage pattern that should be documented or made easier
- **perf** — performance observation
- **ux** — output formatting, result presentation, developer experience
- **delegation** — issues with how REPL delegates to native tools
- **idea** — general enhancement idea

---

## Observations

**2026-04-13 | Binary analysis — grep on 12MB file** | friction, perf
grep -o with broad context patterns (.\{0,80\}) on the 12MB JS file takes 12-96 seconds per call. Byte-offset approach (grep -ob + dd) is instant. REPL could benefit from a documented pattern or helper for large-file binary analysis — "use grep -ob for offset, dd for extraction."

**2026-04-13 | Agent delegation absent in replace mode** | prompt, pattern
Full session of research/planning work — zero agent() calls despite CLAUDE.md directive to use sub-agents for >5 independent files. Replace mode filters Agent from direct tool visibility. REPL prompt mentions agent() in the Available Functions list but doesn't frame it as a parallelization strategy the way the native system prompt's "Sub-Agent Swarming" section does. The replace prompt may be suppressing agent delegation behavior by not promoting it.

**2026-04-13 | REPL as sole interface for all operations** | ux, pattern
In replace mode, REPL handles everything — file reads, searches, shell commands, analysis. This is powerful but creates a pattern where all operations are scripted JavaScript. Some tasks (like "read this one file") have unnecessary ceremony. The model writes `await read(path)` instead of just using Read. Trade-off is intentional but worth noting: replace mode optimizes for batch efficiency at the cost of single-operation simplicity.

**2026-04-13 | fetch() in REPL returns AI-summarized content** | ux, delegation
Used fetch() to grab the Haseeb gist. Got a useful AI summary. But if you need exact quotes or specific sections, the summarization lossy-compresses them. The prompt documents this and suggests bash('curl -s ...') for raw HTTP, but in practice the summarized version was sufficient. The fetch/curl distinction is well-documented but could be more prominent in the replace prompt.


