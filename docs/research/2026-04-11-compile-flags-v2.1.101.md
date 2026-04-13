# Compile-Time Flag Audit: Claude Code v2.1.101

Date: 2026-04-11
Binary: `~/.local/share/claude/versions/2.1.101` (191MB, Mach-O arm64)
Source: `~/.tweakcc/native-claudejs-orig.js` (extracted JS bundle)

## Method

Searched extracted JS for tool registrations, feature implementations, and telemetry
strings. The tool registry function `Ut()` contains 15 null-assigned slots (DCE'd
features) and active tool assignments.

## Results

| Flag | Status | Implementation Notes |
|------|--------|---------------------|
| MONITOR_TOOL | ENABLED | Full MonitorTool — persistent/timeout shell watchers, rate limiting |
| CONTEXT_COLLAPSE | UNCERTAIN | No CtxInspectTool; agent summary infra exists |
| HISTORY_SNIP | DISABLED | No trace in binary |
| WEB_BROWSER_TOOL | ENABLED | Full computer-use GUI automation (click, type, screenshot, scroll) |
| WORKFLOW_SCRIPTS | DISABLED | No trace in binary |
| KAIROS | ENABLED | Cron scheduling, durable cron, auto-dream, loop dynamic, brief mode |
| PROACTIVE | ENABLED | ScheduleWakeupTool, SendUserMessage |
| UDS_INBOX | ENABLED | SendMessage with UDS/bridge routing |
| AGENT_TRIGGERS | ENABLED | CronCreate/Delete/List + RemoteTrigger |
| TERMINAL_PANEL | UNCERTAIN | tengu_terminal_sidebar flag exists |
| ULTRAPLAN | ENABLED | Planning mode with approval workflows, timeout config |
| ULTRATHINK | ENABLED | Extended thinking, alwaysThinkingEnabled config |
| TOKEN_BUDGET | ENABLED | Message-level tool result budget enforcement |
| VERIFICATION_AGENT | UNCERTAIN | No standalone tool found |
| FORK_SUBAGENT | ENABLED | Core subagent forking infrastructure |
| REACTIVE_COMPACT | ENABLED | Auto/micro/partial/cold compact, rapid-refill breaker |
| TORCH | UNCERTAIN | No feature-level match |
| QUICK_SEARCH | DISABLED | No trace in binary |
| FILE_PERSISTENCE | ENABLED | File checkpointing + /rewind capability |
| VOICE_MODE | ENABLED | Hold-to-talk dictation (requires Claude.ai OAuth) |

Score: 14 ENABLED, 3 DISABLED, 3 UNCERTAIN

## 15 Null Tool Slots

The tool registry has 15 variables assigned to `null` (dead-code-eliminated):
`jn_`, `vA7`, `CA7`, `bA7`, `IA7`, `xA7`, `uA7`, `mA7`, `pA7`, `BA7`, `FA7`,
`gA7`, `VA7`, `SA7`, `EA7`

Known disabled tools that map to some of these slots:
- SnipTool (HISTORY_SNIP)
- WorkflowTool (WORKFLOW_SCRIPTS)
- REPLTool (USER_TYPE gate, not feature flag)
- TungstenTool (USER_TYPE gate)
- ConfigTool (USER_TYPE gate)
- CtxInspectTool (CONTEXT_COLLAPSE, if disabled)

## Governance-Relevant Findings

1. **Kairos/Auto-Dream**: Background agent that reviews sessions and modifies files
   autonomously. `autoDreamEnabled` config setting controls it. Monitor this.

2. **Durable Cron**: Persists scheduled tasks to `.claude/scheduled_tasks.json`.
   Tasks survive across sessions.

3. **WebBrowserTool**: Full computer-use present. Additional runtime gates likely.

4. **Token Budget Enforcement**: Active at message/tool-result level. May affect
   how much context our CLAUDE.md instructions consume.

5. **File Persistence**: `/rewind` capability is active. Could be used for
   governance recovery.
