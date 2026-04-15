### Directory Structure

```
.planning/
  ROADMAP.md                          # Global roadmap — living doc, updated per phase
  STATE.md                            # Global state — folds in from phase trackers
  FINDINGS.md                         # Project-level discoveries — goldmine moments
  REFERENCES.md                       # All external references — cite by ID
  BUGTRACKER.md                       # Minor deferrals — user-directed only, NOT gaps
  journals/                           # Session journals — session-YYYY-MM-DD[-suffix].md
  reports/                            # Research reports, analysis docs
  research/                           # Dated research findings, REPL improvements
  specs/                              # Design specs
  artifacts/                          # Retired docs preserved by origin (e.g., M-1-CONTEXT.md)
  milestones/
    M-{n}/                            # One directory per milestone
      BOOTSTRAP.md                    # Bootstrap prompt — scoped to milestone
      IMPACT.md                       # Milestone-scoped impact: created after research, updated on cross-phase impact
      FINDINGS.md                     # Milestone-scoped findings (like project-level but local)
      RETROSPECTIVE.md                # End-of-milestone retrospective
      GAPS.md                         # End-of-milestone gap analysis
      {phaseName}/                    # One directory per phase (e.g., 2b-gaps-3/)
        TRACKER.md                    # Phase PM only — decisions, blockers, status
        CONTEXT.md                    # Phase-scoped shared state (live bridge for agents)
        PLANNING.md                   # Pre-work plan — bidirectional: phase ↔ milestone ↔ project scope
        RESEARCH.md                   # Phase-scoped research with REFERENCES.md citations
        TASKS.md                      # Task breakdown — persistent backing store for TaskCreate
        HANDOFF.md                    # Phase handoff (generated at phase end)
```
