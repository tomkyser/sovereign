# Prompt Overrides

claude-governance replaces specific sections of CC's system prompt with improved versions.
The override pipeline uses a "pieces matching" engine that finds named prompt sections
in CC's prompt data files and replaces their content.

## How Pieces Matching Works

CC stores its system prompt as named sections in JSON data files:
```
data/prompts/prompts-2.1.101.json
```

Each section has a name (e.g., "Doing tasks") and content. The pieces matching engine
(`src/patches/systemPrompts.ts`) matches override files to sections by name and replaces
the section content.

Override files are stored in `data/overrides/` as Markdown with YAML-like frontmatter:

```markdown
<!--
name: 'System Prompt: Doing tasks (ambitious tasks)'
description: 'Allow ambitious tasks; defer to user judgement; REPL for batch operations'
ccVersion: 2.1.53
-->

The replacement text goes here.
```

The `name` field is used to match against prompt section names in the data files.
The matching is fuzzy — it finds the best section match based on the override name.

## Current Overrides (9 files)

### System Prompt Overrides (7)

| File | Target Section | What It Changes |
|------|---------------|----------------|
| `system-prompt-doing-tasks-ambitious.md` | Doing tasks | Removes "too complex" hedging. Adds: defer to user judgment, REPL for batch operations. Signature: `prefer REPL over individual tool calls` |
| `system-prompt-doing-tasks-no-additions.md` | Doing tasks | Stops gratuitous improvements. Keeps: fix adjacent broken code if it contributes to the problem. Signature: `adjacent code is broken, fragile, or directly contributes` |
| `system-prompt-doing-tasks-no-premature-abstractions.md` | Doing tasks | Stops premature abstractions. Extract only when duplication causes real maintenance risk. Signature: `duplication causes real maintenance risk` |
| `system-prompt-doing-tasks-no-unnecessary-error-handling.md` | Doing tasks | Proportional error handling. Only validate at real boundaries. Signature: `at real boundaries where failures can realistically occur` |
| `system-prompt-executing-actions-with-care.md` | Executing actions with care | Recalibrates risk assessment. Match scope to request, but fix related issues when clearly right. Signature: `clearly the right thing to do` |
| `system-prompt-tone-concise-output-short.md` | Tone and style | Replaces "short and concise" with "appropriately detailed for the complexity." Signature: `appropriately detailed for the complexity` |
| `system-prompt-agent-thread-notes.md` | Agent thread notes | Behavioral guidelines for agent threads. Signature: `when they provide useful context` |

### Agent Prompt Overrides (2)

| File | Target | What It Changes |
|------|--------|----------------|
| `agent-prompt-explore.md` | Explore subagent prompt | Thoroughness: don't sacrifice completeness for speed. Signature: `do not sacrifice completeness for speed` |
| `agent-prompt-general-purpose.md` | General-purpose subagent prompt | Quality: work like a careful senior developer. Signature: `careful senior developer would do` |

## What We Currently Fix

| Anthropic Default | Our Override | Impact |
|-------------------|-------------|--------|
| "Your responses should be short and concise" | "appropriately detailed for the complexity" | Removes compound brevity pressure |
| Hedging about "too complex" tasks | "defer to user judgement about whether a task is too large" | Enables ambitious work |
| No REPL batch guidance | "prefer REPL over individual tool calls" for 3+ operations | Better tool efficiency |
| Silent scope creep | "Don't add unrelated features" but "fix adjacent broken code" | Disciplined improvements |
| Over-cautious risk assessment | "Match the scope of your actions to what was actually requested" | Proportional caution |
| Over-engineering from abstractions | "Only extract when duplication causes real maintenance risk" | Practical code |
| Defensive coding everywhere | "Only validate at real boundaries" | Proportional error handling |

## What We Don't Yet Fix (Planned P1)

These overrides are planned but not yet implemented:

| ID | Override | Source Text |
|----|---------|-------------|
| I-054 | Communication Style — replace "Output efficiency" with professional prose guidance | `extracted-prompts/wjh-communication-style.md` |
| I-003 | Misconception correction — "If you notice the user's request is based on a misconception, say so" | `extracted-prompts/dce-misconception-correction.md` |
| I-004 | False-claims mitigation — "Report outcomes faithfully..." | `extracted-prompts/dce-false-claims-mitigation.md` |
| I-005 | Thoroughness counterweight — "Before reporting a task complete, verify it actually works" | `extracted-prompts/dce-thoroughness-counterweight.md` |
| I-092 | Context decay awareness — new section | PA-009 analysis |
| I-094 | Priority hierarchy clarification — new section | PA-012 analysis |

Source text for these planned overrides is in `extracted-prompts/`.

## Verification

Each override has a unique **signature phrase** registered in the `VERIFICATION_REGISTRY`.
The `check` command verifies each signature is present in the extracted binary JS:

```
Prompt Overrides:
  ✓ Prompt Override: Explore
  ✓ Prompt Override: General Purpose
  ✓ Prompt Override: Agent Thread Notes
  ✓ Prompt Override: No Unnecessary Additions
  ✓ Prompt Override: No Premature Abstractions
  ✓ Prompt Override: Proportional Error Handling
  ✓ Prompt Override: Executing Actions
  ✓ Prompt Override: Tone & Style
  ✓ Prompt Override: Ambitious Tasks + REPL
```

## Adding a New Override

1. Create a `.md` file in `data/overrides/` with frontmatter:
   ```markdown
   <!--
   name: 'System Prompt: Section Name'
   description: 'What this override does'
   ccVersion: 2.1.101
   -->
   
   Your replacement text here.
   ```

2. Add a verification entry to `VERIFICATION_REGISTRY` in `src/patches/governance/registry.ts`:
   ```typescript
   {
     id: 'prompt-your-override',
     name: 'Prompt Override: Your Override',
     signature: 'a unique phrase from your override text',
     critical: false,
     category: 'prompt-override',
   }
   ```

3. Build and verify:
   ```bash
   pnpm build
   node dist/index.mjs --apply
   node dist/index.mjs check
   ```

## Prompt Data Files

CC's prompt data is stored as versioned JSON files in `data/prompts/`:
- `prompts-2.1.101.json` — current version
- Older versions downloaded on demand from GitHub via `systemPromptDownload.ts`

These files contain the raw prompt text that the pieces matching engine targets.
They're also used by the `check` command to verify overrides are applied.
