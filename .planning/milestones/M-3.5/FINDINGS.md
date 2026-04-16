

## Phase 3.5d Findings — Message Components Control

### F30: REPL Tool Invisible Due to renderToolUseMessage Default
tool-injection.ts defaults renderToolUseMessage to `function(){return null}`.
CC's AssistantToolUseMessage returns null for the entire message when this returns null.
Root cause of "REPL tool use not appearing in TUI" issue.

### F31: Three Tool Visibility Suppression Mechanisms in CC
1. Empty userFacingName → return null (ToolSearchTool, TaskStopTool/ant, BriefTool)
2. renderToolUseMessage returns null → return null (external tools)
3. isTransparentWrapper → only progress shown (defined but unused)

### F32: Five Thinking Suppression Points
1. SystemTextMessage:122 — subtype==="thinking" → return null (offset 8193543)
2. AssistantThinkingMessage:36 — hideInTranscript
3. REPL.tsx:852 — streaming thinking auto-hides after 30s
4. betas.ts:270 — REDACT_THINKING_BETA_HEADER replaces thinking with opaque stubs
5. AssistantThinkingMessage:42 — non-verbose shows only stub

### F33: Default Opus 4.6 Effort is Medium for Pro Users
utils/effort.ts: getDefaultEffortForModel returns 'medium' for Pro subscribers on Opus 4.6.
Users on the most capable model receive reduced reasoning unless they explicitly escalate.

### F34: 27 Null-Rendered Attachment Types
nullRenderingAttachments.ts lists 27 types that are invisible in the TUI but present in context.
Includes critical_system_reminder, token_usage, output_token_usage, compaction_reminder.

### F35: Ultrathink System Hidden
Ultrathink effort attachment is null-rendered. The keyword triggers effort escalation
but the mechanism is invisible to the user.
