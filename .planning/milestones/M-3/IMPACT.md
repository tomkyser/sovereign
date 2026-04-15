# Milestone 3 Impact — System Prompt Control

## Milestone Scope

Full extraction, editing, version control, and targeted degradation fixes for CC's
system prompt. Preceded by codebase reorganization (3prelim) to establish proper
patterns before adding features.

**Core research question (GP3):** Anthropic withholds quality-of-output improvements
from paying users via `USER_TYPE === 'ant'` gating. Which of these can we replicate
via prompt overrides, which require binary patches, and which inform new governance patches?

## References

- [haseebAnalysis1] — Ant vs external divergence analysis (6+ identified divergences)
- [ccPrompts1] — CC prompts project (system prompt extraction)
- [ccLeaks1] — CC leaks site (prompt visibility)
- [promptLeaks1] — Prompt leak aggregation
- [tweakccCustom1] — TweakCC custom models (prompt editing reference)
- [promptAnalysis1] — Prompt analysis tooling

## Known Divergences (from [haseebAnalysis1])

| Divergence | Type | Preliminary Assessment |
|------------|------|----------------------|
| Misconception correction | Prompt addition | Likely replicable via prompt override |
| Hallucination prevention | Prompt addition | Likely replicable via prompt override |
| Conciseness enforcement | Prompt addition (A/B tested) | Likely replicable; backed by "~1.2% output token reduction" |
| Adversarial review (VERIFICATION_AGENT) | Feature-flagged subagent | May require binary patch or hook-based implementation |
| Prompt A/B infrastructure | Build pipeline | Informational — understand their methodology |
| isUndercover() mode | Runtime mode | Informational — strips model identifiers |

## Phase Structure (from ROADMAP.md)

| Phase | Scope | Status |
|-------|-------|--------|
| 3prelim | Codebase reorganization — separation of concerns, tool restructuring, non-fork code extraction | NOT STARTED |
| 3a | Full system prompt extraction with version tracking | NOT STARTED |
| 3b | Prompt diff tool (compare across CC versions) | NOT STARTED |
| 3c | Targeted fixes for specific degradation prompts | NOT STARTED |
| 3d | User-editable prompt overrides with merge-on-update | NOT STARTED |
| 3e | Prompt version control (git-style diffing) | NOT STARTED |
| 3f | Canary prompts — runtime verification of override effectiveness | NOT STARTED |
| 3g | Clawback integration module | NOT STARTED |
| 3h | Cross-project impact assessment | NOT STARTED |

## Cross-Milestone Dependencies

- **From M-2:** 20/20 SOVEREIGN baseline, tool injection framework, binary vault, verification pipeline
- **From M-2 GAPS:** BT1 (SOVEREIGN banner UX) should be addressed alongside prompt verification work
- **To M-4:** REPL prompt improvements, replace mode testing informed by prompt control findings
- **To M-4.5:** Wire integration may benefit from prompt-level agent coordination guidance

## Phase Impact

*Updated as phases complete.*
