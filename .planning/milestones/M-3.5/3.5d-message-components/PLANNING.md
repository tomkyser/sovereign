# Phase 3.5d Planning — Message Components Control

Status: PLANNING COMPLETE
Previous: 3.5c (Governance Integration)
Research: RESEARCH.md (complete)

---

## Scope

Complete message component override and patching capability. Three pillars:
1. Tool visibility — every tool call visible, nothing hidden
2. Thinking/reasoning restoration — all suppressed thinking made visible
3. User-customizable component overrides — governance defaults, user edits

### Scope Relationship
- **Phase → Milestone**: Blocks remaining Wire phases (3.5e/f). Model must see its own
  tool output to coordinate effectively across sessions.
- **Milestone → Project**: Extends M-2's tool injection with rendering. Extends M-3's
  prompt overrides with UI overrides. First binary patching of React components.

## Approach

### P0: Tool Visibility (T1-T6)

**Strategy: Modify tool-injection.ts defaults + add per-tool renderers**

The root cause is tool-injection.ts line:
`if(!_t.renderToolUseMessage)_t.renderToolUseMessage=function(){return null};`

Fix in two layers:
1. **Default renderer (T1-T2):** Change the default `renderToolUseMessage` to produce a
   visible React element using captured binary-scope refs. The tool-injection loader
   already runs in binary scope where React (`b_`), Box (`m`), Text (`L`) are accessible.
   Pattern: render-tree.ts captures refs the same way for Tungsten panel injection.
   The default renderer shows tool name + truncated input.

2. **Per-tool renderers (T3-T4):** Each tool in `~/.claude-governance/tools/` can export
   its own `renderToolUseMessage`. REPL shows script description + operation count.
   Tungsten shows action + session name. These are React element factories that receive
   the same `{input, output, isStreaming}` args CC's native tools get.

3. **Binary patch for empty-name suppression (T5):** Patch the
   `if(userFacingToolName === "") return null` check in AssistantToolUseMessage.
   This is defense-in-depth — our tools already set `userFacingName` to return
   the tool name, but this patch ensures ALL tools are visible regardless.

4. **Verification (T6):** Interactive TUI session confirming REPL, Tungsten, Ping
   all render visually.

**Key implementation detail:** The tool loader code in tool-injection.ts must capture
React/Ink refs at load time and make them available to the default renderer. Add
ref-capture block before the tool loop:
```
var _R=require("react"); // binary scope has react
var _B=null,_T=null; // Box, Text — resolve from Ink
try{var _ink=require("ink");_B=_ink.Box;_T=_ink.Text}catch(_){}
```
If Ink isn't requireable in this scope, fall back to returning a plain string
(CC coerces non-null non-element returns to string display).

### P1: Thinking Restoration (T7-T11)

**Strategy: Binary patch SystemTextMessage dispatch + AssistantThinkingMessage defaults**

Three patches, each independent:

1. **SystemTextMessage thinking dispatch (T7-T8):** Binary offset 8193543 has
   `q.subtype==="thinking")return null`. Replace the `return null` with a call
   to ThinkingMessage (if minified name found) or inline a minimal renderer.
   Detection: multi-detector pattern matching on the string literal `"thinking"`
   adjacent to `return null` — string literals survive minification.

2. **Streaming thinking auto-hide (T9):** REPL.tsx:852 sets a 30-second timeout
   that nulls streaming thinking. Patch: replace the setTimeout callback with a
   no-op. Detection: look for the 30000ms timeout constant near thinking-related
   variable names.

3. **Full thinking by default (T10):** AssistantThinkingMessage shows a stub
   (`"∴ Thinking" + CtrlO`) in non-verbose mode. Patch: force the verbose/transcript
   rendering path. Detection: look for the `hideInTranscript` check or the
   `∴` string literal.

4. **Verification (T11):** Trigger thinking (ultrathink keyword or high effort) and
   confirm blocks render in TUI.

**Risk:** ThinkingMessage's minified function name must be discovered at patch time.
If it can't be reliably detected, inline a minimal renderer:
`b_.createElement(L,{color:"cyan"},"∴ "+q.content.substring(0,200))`

### P2: Override System (T12-T16)

**Strategy: globalThis registry + binary patch injection points**

1. **Registry design (T12):** `globalThis.__govMessageOverrides` — a Map keyed by
   message subtype (for SystemTextMessage) or tool name (for AssistantToolUseMessage).
   Values are React component factories: `(props) => ReactElement | null`.
   Populated at patch time from governance config files.

2. **SystemTextMessage injection (T13):** Before the subtype switch/dispatch,
   inject a check: `if(__govMessageOverrides?.has(subtype)) return __govMessageOverrides.get(subtype)(props)`.
   Detection: find the subtype dispatch block (the chain of `if(subtype===...)` checks).

3. **AssistantToolUseMessage injection (T14):** Before `renderToolUseMessage` call,
   check `__govMessageOverrides?.has("tool:"+toolName)`.

4. **Null-rendered attachments (T15):** The 27 types in nullRenderingAttachments.ts
   are returned as-is to the renderer. Patch: check
   `__govMessageOverrides?.has("attachment:"+type)` and render if override exists.
   User can configure which attachment types to show via governance config.

5. **Verification registry (T16):** Add `message-override-system` entry to
   VERIFICATION_REGISTRY with signature check for `__govMessageOverrides` in binary.

### P3: User Customization (T17-T20)

**Strategy: File-based component loading from governance directory**

1. **Component directory (T17):** `~/.claude-governance/components/` — each .js file
   exports a component factory. Filename convention: `{target}-{name}.js` where target
   is `system-thinking`, `tool-REPL`, `attachment-token_usage`, etc.

2. **Governance defaults (T18):** Ship default component overrides in
   `claude-governance/data/components/` that get copied to user directory on install.
   Defaults: thinking renderer (cyan, full content), tool renderer (name + description),
   select attachment renderers (token_usage, compaction_reminder).

3. **Hidden commands (T19):** Identify the hidden commands list in the binary and
   patch to make all commands visible in /help output.

4. **Documentation (T20):** Component override API docs in `docs/components.md`.

### Verification (T21-T23)

- T21: Each new patch added to VERIFICATION_REGISTRY with unique signature
- T22: Full SOVEREIGN check targeting 23+ (current 23 + new patches)
- T23: Manual interactive TUI verification of restored UI elements

## Deliverables

### P0 (Blocking)
1. Fix external tool rendering — REPL/Tungsten/Ping visible in TUI
2. Full tool visibility — override empty-name suppression check

### P1 (Core)
3. Restore thinking blocks — SystemTextMessage dispatch patch
4. Disable thinking auto-hide — remove 30s streaming timeout
5. Show full thinking by default — skip Ctrl+O stub

### P2 (Extended)
6. Expose null-rendered attachments — user-configurable visibility
7. Build override registry — globalThis component overrides

### P3 (Future)
8. User customization — ~/.claude-governance/components/ file loading
9. Unhide hidden commands — all /commands visible in help

## Risks

1. **React component patching fragility** — function boundaries shift between versions.
   Mitigation: multi-detector pattern matching, string literal anchors.
2. **React Compiler memo cache invalidation** — injected code may break _c() slot indexing.
   Mitigation: inject at dispatch boundaries, not inside memo blocks.
3. **Tool rendering without React access** — CJS tool files can't import React.
   Mitigation: capture refs in loader scope, inject factory functions.

## Dependencies

- Existing: render-tree.ts patch pattern (Tungsten panel injection)
- Existing: tool-injection.ts loader (binary-scope execution context)
- CC source: /Users/tom.kyser/dev/cc-source/.../src/components/messages/

