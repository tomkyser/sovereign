import { GOVERNANCE_DEFAULTS } from './defaults';

// =============================================================================
// Verification Registry
// =============================================================================

export interface VerificationEntry {
  id: string;
  name: string;
  signature?: string | RegExp;
  antiSignature?: string | RegExp;
  critical: boolean;
  category: 'governance' | 'gate' | 'prompt-override' | 'tool-injection';
  passDetail?: string;
}

export const VERIFICATION_REGISTRY: VerificationEntry[] = [
  // --- Governance patches (direct replacement — anti-signatures reliable) ---
  {
    id: 'disclaimer',
    name: 'Disclaimer Neutralization',
    signature: GOVERNANCE_DEFAULTS.disclaimerReplacement,
    antiSignature: 'may or may not be relevant',
    critical: true,
    category: 'governance',
  },
  {
    id: 'header',
    name: 'Context Header Reframing',
    signature: GOVERNANCE_DEFAULTS.headerReplacement,
    antiSignature:
      "As you answer the user's questions, you can use the following context:",
    critical: true,
    category: 'governance',
  },
  {
    id: 'reminder',
    name: 'System-Reminder Authority Fix',
    signature: GOVERNANCE_DEFAULTS.reminderFramingReplacement,
    antiSignature: 'bear no direct relation',
    critical: true,
    category: 'governance',
  },
  {
    id: 'subagent',
    name: 'Subagent CLAUDE.md Restoration',
    signature: /tengu_slim_subagent_claudemd"[^)]*,\s*(?:!1|false)\)/,
    antiSignature: /tengu_slim_subagent_claudemd"[^)]*,\s*(?:!0|true)\)/,
    critical: true,
    category: 'governance',
    passDetail: 'active (flag=false)',
  },
  // --- Gate resolution ---
  {
    id: 'gates',
    name: 'Embedded Tools Gate Resolution',
    antiSignature: 'USE_EMBEDDED_TOOLS_FN',
    critical: false,
    category: 'gate',
    passDetail: 'all gates resolved',
  },
  // --- Tool injection ---
  {
    id: 'tool-injection',
    name: 'Tool Injection',
    signature: '__claude_governance_tools__',
    critical: false,
    category: 'tool-injection',
    passDetail: 'external tool loader active',
  },
  // --- Embedded tools Glob/Grep exclusion (G11) ---
  {
    id: 'embedded-tools-exclusion',
    name: 'Embedded Tools: Glob/Grep Exclusion',
    signature: /[$\w]+\(\)\?\[\]:\[[$\w]+,[$\w]+\]/,
    critical: false,
    category: 'gate',
    passDetail: 'Glob/Grep excluded when embedded tools active',
  },
  // --- Prompt overrides ---
  {
    id: 'prompt-explore',
    name: 'Prompt Override: Explore',
    signature: 'do not sacrifice completeness for speed',
    critical: false,
    category: 'prompt-override',
  },
  {
    id: 'prompt-general-purpose',
    name: 'Prompt Override: General Purpose',
    signature: 'careful senior developer would do',
    critical: false,
    category: 'prompt-override',
  },
  {
    id: 'prompt-agent-thread-notes',
    name: 'Prompt Override: Agent Thread Notes',
    signature: 'when they provide useful context',
    critical: false,
    category: 'prompt-override',
  },
  {
    id: 'prompt-doing-tasks-no-additions',
    name: 'Prompt Override: No Unnecessary Additions',
    signature: 'adjacent code is broken, fragile, or directly contributes',
    critical: false,
    category: 'prompt-override',
  },
  {
    id: 'prompt-doing-tasks-no-premature-abstractions',
    name: 'Prompt Override: No Premature Abstractions',
    signature: 'duplication causes real maintenance risk',
    critical: false,
    category: 'prompt-override',
  },
  {
    id: 'prompt-doing-tasks-no-error-handling',
    name: 'Prompt Override: Proportional Error Handling',
    signature: 'at real boundaries where failures can realistically occur',
    critical: false,
    category: 'prompt-override',
  },
  {
    id: 'prompt-executing-actions',
    name: 'Prompt Override: Executing Actions',
    signature: 'clearly the right thing to do',
    critical: false,
    category: 'prompt-override',
  },
  {
    id: 'prompt-tone-style',
    name: 'Prompt Override: Tone & Style',
    signature: 'appropriately detailed for the complexity',
    critical: false,
    category: 'prompt-override',
  },
  {
    id: 'prompt-doing-tasks-ambitious',
    name: 'Prompt Override: Ambitious Tasks + REPL',
    signature: 'prefer REPL over individual tool calls',
    critical: false,
    category: 'prompt-override',
  },
  {
    id: 'prompt-bash-reframe',
    name: 'Prompt Override: Bash Prohibition Reframe',
    signature: /Avoid using this tool to run \$\{[$\w]+\} commands, unless/,
    antiSignature: /IMPORTANT: Avoid using this tool to run/,
    critical: false,
    category: 'prompt-override',
    passDetail: 'IMPORTANT prefix removed',
  },
  {
    id: 'repl-tool-guidance',
    name: 'REPL Tool Guidance Injection',
    signature: 'could one REPL call do this',
    critical: false,
    category: 'governance',
    passDetail: 'active in Using your tools',
  },
  // --- Tungsten infrastructure ---
  {
    id: 'tungsten-fs9',
    name: 'Tungsten: bashProvider tmux Activation',
    signature: '__CLAUDE_GOVERNANCE_TMUX_ENV',
    antiSignature: /function FS9\(\)\{return null\}/,
    critical: false,
    category: 'tool-injection',
    passDetail: 'FS9() reads Tungsten socket info',
  },
  {
    id: 'tungsten-panel',
    name: 'Tungsten: Live Panel Injection',
    signature: '__tungsten_panel__',
    critical: false,
    category: 'tool-injection',
    passDetail: 'present (requires live session to verify rendering)',
  },
  {
    id: 'tungsten-tool-guidance',
    name: 'Tungsten: Tool Guidance Injection',
    signature: 'Tungsten session is established at the start of every work session',
    critical: false,
    category: 'governance',
    passDetail: 'active in Using your tools',
  },
  {
    id: 'channel-dialog-bypass',
    name: 'Channel Dialog Bypass',
    signature: '__channel_dialog_bypassed__',
    critical: false,
    category: 'governance',
    passDetail: 'dev channel dialog auto-accepted',
  },
  {
    id: 'tool-visibility',
    name: 'Tool Visibility Patch',
    signature: '__tool_visibility_patched__',
    critical: false,
    category: 'governance',
    passDetail: 'empty-name suppression removed',
  },
  {
    id: 'client-data-cache',
    name: 'Client Data Cache Preservation',
    signature: '__cdc_preserved__',
    critical: false,
    category: 'governance',
    passDetail: 'ms7() skips clientDataCache overwrite',
  },
];
