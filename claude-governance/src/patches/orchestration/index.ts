import { debug } from '../../utils';

// =============================================================================
// Patch Group Enum
// =============================================================================

export enum PatchGroup {
  SYSTEM_PROMPTS = 'System Prompts',
  GOVERNANCE = 'Governance',
  ALWAYS_APPLIED = 'Always Applied',
  MISC_CONFIGURABLE = 'Misc Configurable',
  FEATURES = 'Features',
}

// =============================================================================
// Patch Definitions — Governance Only
// =============================================================================

export const PATCH_DEFINITIONS = [
  {
    id: 'disclaimer-neutralization',
    name: 'CLAUDE.md Disclaimer Neutralization',
    group: PatchGroup.GOVERNANCE,
    description:
      'Removes/replaces the "may or may not be relevant" disclaimer after CLAUDE.md content',
  },
  {
    id: 'context-header-reframing',
    name: 'Context Header Reframing',
    group: PatchGroup.GOVERNANCE,
    description:
      'Replaces ambient "use the following context" with directive framing',
  },
  {
    id: 'subagent-claudemd-restoration',
    name: 'Subagent CLAUDE.md Restoration',
    group: PatchGroup.GOVERNANCE,
    description:
      'Flips tengu_slim_subagent_claudemd from true to false so subagents receive CLAUDE.md',
  },
  {
    id: 'reminder-authority-fix',
    name: 'System-Reminder Authority Fix',
    group: PatchGroup.GOVERNANCE,
    description:
      'Fixes system prompt text that says system-reminder tags "bear no direct relation" to context',
  },
  {
    id: 'ismeta-flag-removal',
    name: 'isMeta Flag Removal',
    group: PatchGroup.GOVERNANCE,
    description:
      'Changes isMeta:!0 to isMeta:!1 on CLAUDE.md messages (optional — affects compaction)',
  },
  {
    id: 'tool-injection',
    name: 'Tool Registry Injection',
    group: PatchGroup.GOVERNANCE,
    description:
      'Patches getAllBaseTools() to load external tools from ~/.claude-governance/tools/',
  },
  {
    id: 'repl-tool-guidance',
    name: 'REPL Tool Guidance',
    group: PatchGroup.GOVERNANCE,
    description:
      'Injects REPL batch-operation guidance into the Using your tools section',
  },
  {
    id: 'tungsten-fs9',
    name: 'Tungsten bashProvider Activation',
    group: PatchGroup.GOVERNANCE,
    description:
      'Patches FS9() stub so Bash commands inherit tmux environment after Tungsten creates a session',
  },
  {
    id: 'tungsten-panel',
    name: 'Tungsten Live Panel',
    group: PatchGroup.GOVERNANCE,
    description:
      "Injects live terminal panel component into CC render tree at DCE'd TungstenLiveMonitor site",
  },
  {
    id: 'tungsten-tool-guidance',
    name: 'Tungsten Tool Guidance',
    group: PatchGroup.GOVERNANCE,
    description:
      'Injects Tungsten guidance into the Using your tools section (after REPL guidance)',
  },
  {
    id: 'channel-dialog-bypass',
    name: 'Channel Dialog Bypass',
    group: PatchGroup.GOVERNANCE,
    description:
      'Auto-accepts dev channel dialog for OAuth users (skips interactive confirmation)',
  },
  {
    id: 'tool-visibility',
    name: 'Tool Visibility Patch',
    group: PatchGroup.GOVERNANCE,
    description:
      'Removes empty-userFacingName suppression so all tools are visible in TUI',
  },
  {
    id: 'client-data-cache',
    name: 'Client Data Cache Preservation',
    group: PatchGroup.GOVERNANCE,
    description:
      'Patches ms7() bootstrap to preserve clientDataCache values (quiet_salted_ember, coral_reef_sonnet)',
  },
] as const;

export type PatchId = (typeof PATCH_DEFINITIONS)[number]['id'];

export interface PatchDefinition {
  id: PatchId;
  name: string;
  group: PatchGroup;
  description: string;
}

export const getAllPatchDefinitions = (): PatchDefinition[] => {
  return [...PATCH_DEFINITIONS];
};

export interface PatchImplementation {
  fn: (content: string) => string | null;
  condition?: boolean;
  signature?: string;
}

// =============================================================================
// Patch Application Orchestrator
// =============================================================================

export interface PatchResult {
  id: string;
  name: string;
  group: PatchGroup;
  applied: boolean;
  failed?: boolean;
  skipped?: boolean;
  details?: string;
  description?: string;
}

export const applyPatchImplementations = (
  content: string,
  implementations: Record<PatchId, PatchImplementation>,
  patchFilter?: string[] | null
): { content: string; results: PatchResult[] } => {
  const results: PatchResult[] = [];

  for (const def of PATCH_DEFINITIONS) {
    const impl = implementations[def.id];

    if (patchFilter && !patchFilter.includes(def.id)) {
      results.push({
        id: def.id,
        name: def.name,
        group: def.group,
        applied: false,
        skipped: true,
        description: def.description,
      });
      continue;
    }

    if (impl.condition === false) {
      results.push({
        id: def.id,
        name: def.name,
        group: def.group,
        applied: false,
        skipped: true,
        description: def.description,
      });
      continue;
    }

    // DUAL DETECTION CONTRACT (G34):
    // Layer 1 (here): Orchestrator checks signature presence in the full JS.
    //   If found → patch is complete, skip. This is the fast path.
    // Layer 2 (inside impl.fn): Individual patch functions run runDetectors()
    //   to find the original unpatched pattern for replacement.
    //   These are never called if layer 1 matches.
    // Contract: signature presence ≡ patch complete. Signatures are chosen to
    // be unique strings that only exist after successful full application.
    // Risk: if a signature string appears without the full patch (e.g. partial
    // application), layer 1 short-circuits and the incomplete patch persists.
    // Mitigation: signatures use multi-token strings unlikely to appear naturally.
    if (impl.signature && content.includes(impl.signature)) {
      results.push({
        id: def.id,
        name: def.name,
        group: def.group,
        applied: true,
        description: def.description,
        details: 'already active',
      });
      continue;
    }

    debug(`Applying patch: ${def.name}`);
    const result = impl.fn(content);
    const failed = result === null;
    const applied = !failed && result !== content;

    if (!failed) {
      content = result;
    }

    results.push({
      id: def.id,
      name: def.name,
      group: def.group,
      applied,
      failed,
      description: def.description,
    });
  }

  return { content, results };
};
