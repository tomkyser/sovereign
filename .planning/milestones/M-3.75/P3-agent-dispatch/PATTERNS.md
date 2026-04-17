# RALPH Agent Dispatch Patterns

## When to Dispatch Agents

Use agent() when Tier 3 unknowns require investigation that:
- Spans many files or directories (broader than a single REPL read)
- Involves a different domain than the current work
- Would benefit from parallel investigation
- Requires focused attention without polluting main context

For simple unknowns (check if a file exists, verify a function signature),
resolve directly in the current REPL call. Don't spawn agents for grep.

## Research Agent Template

```javascript
const findings = await agent(
  `You are a research agent. Answer these specific questions by reading
  source code. Return ONLY factual answers — no suggestions, no modifications.

  Questions:
  1. [specific question about code structure/behavior]
  2. [specific question about data flow/consumers]

  Search scope: [directory or file pattern]
  Do not modify any files. Read only.`,
  {
    description: 'Research: [topic]',
    model: 'sonnet'
  }
);
```

## Scoping Rules

| Rule | Why |
|------|-----|
| One concern per agent | Prevents scope creep and context decay |
| Read-only mandate | Research agents must not mutate state |
| Structured questions | Facts feed RALPH, not prose exploration |
| Explicit search scope | Prevents unbounded file traversal |
| Use sonnet model | Faster, cheaper for targeted reads |

## Anti-Patterns

- **Don't dispatch for trivial lookups.** If `grep` or `read` can answer it, don't spawn an agent.
- **Don't ask open-ended questions.** "Explore the auth system" is bad. "What files call `validateToken()`?" is good.
- **Don't dispatch without a return contract.** The agent must return facts that convert [U] items to [F] items in your DELTA.
- **Don't dispatch sequentially when parallel is possible.** Independent questions go to separate agents.

## Integration with RALPH

When L (Learn) in the RALPH loop surfaces unknowns:

1. Categorize each unknown: can I resolve it with a read/grep, or does it need an agent?
2. For agent-worthy unknowns: formulate specific questions, define search scope
3. Dispatch agent(s), await results
4. Convert [U] → [F] in DELTA
5. Re-enter RALPH with updated facts
6. If new unknowns surface in A (Abduct), loop back to step 1
