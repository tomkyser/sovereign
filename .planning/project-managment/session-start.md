0. **Understand and embrace the project vision** `.planning/VISION.md` is what we are working toward and why, this is the critical and load bearing context for what it is that we are building and what it must do.
1. **Check git state.** Run `git status`, `git log --oneline -5`, and `ls` in the
   working directory. Do not trust compaction summaries about what exists or what's done.
2. **Read the project state.** `.planning/STATE.md` is the source of truth for where we are at overall.
3. **Read the roadmap.** `.planning/ROADMAP.md` is the source of truth for what's complete
   and what's next. If the compaction summary disagrees, the roadmap wins.
4. **Read phase CONTEXT.md.** The active phase's `CONTEXT.md` (at `.planning/milestones/M-{n}/{phaseName}/CONTEXT.md`) has shared state. If starting a new phase, read the milestone `IMPACT.md` instead.
5. **Read the latest handoff.** The previous phase's `HANDOFF.md` (at `.planning/milestones/M-{n}/{phaseName}/HANDOFF.md`, listed in `BOOTSTRAP.md`) has what was built, key decisions, and gotchas.
6. **Verify before building.** If the roadmap says something is "COMPLETE," verify it
   actually exists and works before building on top of it. Check git history, run the
   tool, inspect the output. Claims of completion are hypotheses until verified.
7. **Read findings.** `.planning/FINDINGS.md` (project-level) and milestone `FINDINGS.md` have architecture-informing discoveries. Check before designing.
8. **Read references.** `.planning/REFERENCES.md` has the canonical external resource index. Use identifiers when citing in planning docs.
