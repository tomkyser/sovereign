# How Claude Code Manipulates CLAUDE.md Instructions

**Investigation Date:** 2025-07-11
**Claude Code Version:** 2.1.101 (Build: 2026-04-10)
**Sources:** Minified `cli.js` binary extraction, extracted system prompts, leaked unminified source code

---

## Executive Summary

Claude Code wraps user-authored CLAUDE.md instructions in a `<system-reminder>` tag that appends a disclaimer telling the model the content "may or may not be relevant" and that it "should not respond to this context unless it is highly relevant." This directly contradicts Anthropic's documentation, which presents CLAUDE.md as the authoritative place for mandatory project-level instructions.

---

## The Core Mechanism: `prependUserContext`

### Minified Source (cli.js:7898-7905)

```javascript
function In_(H,_){
  if(Object.entries(_).length===0)return H;
  return[r_({
    content:`<system-reminder>
As you answer the user's questions, you can use the following context:
${Object.entries(_).map(([q,K])=>`# ${q}
${K}`).join(`
`)}

      IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context unless it is highly relevant to your task.
</system-reminder>
`,
    isMeta:!0
  }),...H]
}
```

### Deobfuscated Logic

```typescript
function prependUserContext(messages, userContext) {
  if (Object.entries(userContext).length === 0) return messages;
  
  return [
    createUserMessage({
      content: `<system-reminder>
As you answer the user's questions, you can use the following context:
${Object.entries(userContext).map(([key, value]) => `# ${key}
${value}`).join('\n')}

      IMPORTANT: this context may or may not be relevant to your tasks. 
      You should not respond to this context unless it is highly relevant to your task.
</system-reminder>`,
      isMeta: true
    }),
    ...messages
  ];
}
```

### Unminified Source Location

| Function | File | Lines |
|---|---|---|
| `prependUserContext()` | `src/utils/api.ts` | 715-733 |
| `getClaudeMds()` | `src/utils/claudemd.ts` | 639-696 |
| `getMemoryFiles()` | `src/utils/claudemd.ts` | 291-478 |
| `getUserContext()` | `src/context.ts` | -- |
| `getSystemContext()` | `src/context.ts` | -- |
| System prompt framing | `src/constants/prompts.ts` | 131-134 |

---

## What Happens Step by Step

### 1. CLAUDE.md Content Is Loaded

`getUserContext()` calls `getClaudeMds()` which discovers and reads CLAUDE.md files from the hierarchy:

1. **Managed files** (`/etc/claude-code/CLAUDE.md`) - Global system instructions
2. **User memory** (`~/.claude/CLAUDE.md`) - User's global instructions for all projects
3. **Project memory** (walking up from CWD):
   - `./CLAUDE.md`
   - `./.claude/CLAUDE.md`
   - `./.claude/rules/*.md`
4. **Local memory** (`./CLAUDE.local.md`) - Private project-specific instructions
5. **Additional directories** (via `--add-dir`)
6. **AutoMem** (`MEMORY.md`) - Auto-generated memory if enabled

### 2. Content Processing Pipeline

Before reaching the model, CLAUDE.md content passes through:

1. **Frontmatter parsing** - YAML frontmatter is extracted and stripped
2. **HTML comment stripping** - `<!-- -->` blocks are removed (preserving code blocks)
3. **@include directive processing** - `@./path` references are resolved and inlined
4. **Truncation** - MEMORY.md files are truncated to line and byte limits
5. **Deduplication** - Circular includes are prevented
6. **Preamble injection** - The "MUST follow" text is prepended (see below)
7. **system-reminder wrapping** - The full disclaimer wrapper is applied
8. **Meta-message marking** - Marked `isMeta: true` (system scaffolding, not user input)

### 3. The Injected Preamble

The constant `MEMORY_INSTRUCTION_PROMPT` prepends this to the assembled CLAUDE.md content:

> "Codebase and user instructions are shown below. Be sure to adhere to these instructions. IMPORTANT: These instructions OVERRIDE any default behavior and you MUST follow them exactly as written."

This is **not written by the user** -- it is injected by the harness.

### 4. The Disclaimer Wrapper

The full assembled content is then wrapped in the `<system-reminder>` tag with the "may or may not be relevant" disclaimer appended after the user's content.

### 5. The Result

The model receives this structure:

```xml
<system-reminder>
As you answer the user's questions, you can use the following context:
# claudeMd

  +-- INJECTED PREAMBLE (supportive framing) ---------------------+
  | "Be sure to adhere to these instructions. IMPORTANT:          |
  |  These instructions OVERRIDE any default behavior and you     |
  |  MUST follow them exactly as written."                        |
  +---------------------------------------------------------------+

  +-- ACTUAL USER CONTENT ----------------------------------------+
  | Contents of /home/user/.claude/CLAUDE.md:                     |
  | [whatever the user actually wrote]                            |
  +---------------------------------------------------------------+

  +-- INJECTED DISCLAIMER (undermining framing) ------------------+
  | "IMPORTANT: this context may or may not be relevant to your   |
  |  tasks. You should not respond to this context unless it is   |
  |  highly relevant to your task."                               |
  +---------------------------------------------------------------+
</system-reminder>
```

The user's instructions are caught between two competing signals -- one saying "MUST follow" and the other saying "may not be relevant."

---

## The System Prompt Also Softens system-reminder Tags

In `src/constants/prompts.ts`, the model's system prompt contains this instruction about how to interpret `<system-reminder>` tags:

> "Tool results and user messages may include `<system-reminder>` tags. `<system-reminder>` tags contain useful information and reminders. They are automatically added by the system, and bear no direct relation to the specific tool results or user messages in which they appear."

The model is told these are automatic system additions that "bear no direct relation" to the context they appear in -- further diluting the authority of anything wrapped in these tags.

---

## Subagents Strip CLAUDE.md Entirely

In the agent spawning code (`runAgent`), CLAUDE.md is conditionally removed:

```javascript
let omitClaudeMd = agentDefinition.omitClaudeMd && 
                    !override?.userContext && 
                    getExperiment("tengu_slim_subagent_claudemd", true);

const { claudeMd: removedClaudeMd, ...rest } = userContextResult;
const effectiveUserContext = omitClaudeMd ? rest : userContextResult;
```

When `omitClaudeMd` is true (controlled by the experiment flag `tengu_slim_subagent_claudemd`, **defaulting to `true`**), subagents receive **no CLAUDE.md content at all**. User instructions are invisible to the agents doing the actual work.

---

## The Framing Is Identical for All Contextual Injections

The same `<system-reminder>` + disclaimer pattern is used for:

- CLAUDE.md content (user's mandatory instructions)
- Git status information
- Files opened in IDE
- Memory file contents
- Lines selected in IDE

This means CLAUDE.md instructions receive **the same priority framing** as "the user opened a file in their editor" -- treating explicit user rules as ambient context signals.

---

## Feature Flags That Control Loading

| Env Variable / Flag | Effect |
|---|---|
| `CLAUDE_CODE_DISABLE_CLAUDE_MDS` | Disables all CLAUDE.md loading entirely |
| `tengu_slim_subagent_claudemd` (default: `true`) | Strips CLAUDE.md from subagents |
| `tengu_moth_copse` | Controls AutoMem/TeamMem filtering |
| `tengu_paper_halyard` | Controls whether project-level files are skipped |
| `--bare` mode | Skips auto-discovery |

---

## Impact Summary

| What users think | What actually happens |
|---|---|
| CLAUDE.md = mandatory instructions | Wrapped as optional "context" |
| "Always follow these rules" | "may or may not be relevant" |
| All Claude instances see rules | Subagents often get no CLAUDE.md at all |
| Instructions override defaults | Framed at same priority as "file opened in IDE" |
| User controls their instructions | Harness injects both a supportive preamble AND a dismissive disclaimer |

---

## Conclusion

The architecture reveals a tension in Claude Code's design. Anthropic markets CLAUDE.md as the place to put authoritative project rules. But the implementation:

1. **Wraps** those rules as ambient context, not directives
2. **Tells** the model the content "may or may not be relevant"
3. **Instructs** the model not to respond "unless highly relevant"
4. **Strips** the content entirely from subagents by default
5. **Labels** it with `isMeta: true`, categorizing it as system scaffolding rather than user intent

The practical effect is that CLAUDE.md instructions are treated as suggestions, not rules -- despite Anthropic's documentation implying otherwise.
