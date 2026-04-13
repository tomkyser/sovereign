import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';

import {
  CONFIG_DIR,
  NATIVE_BINARY_BACKUP_FILE,
  updateConfigFile,
} from '../config';
import { ClaudeCodeInstallationInfo, TweakccConfig } from '../types';
import { debug, replaceFileBreakingHardLinks } from '../utils';
import {
  extractClaudeJsFromNativeInstallation,
  repackNativeInstallation,
} from '../nativeInstallationLoader';

// Notes to patch-writers:
//
// - Always use [$\w]+ instead of \w+ to match identifiers (variable/function names), because at
//   least in Node.js's regex engine, \w+ does not include $, so ABC$, which is a perfectly valid
//   identifier, would not be matched.  The way cli.js is minified, $ frequently appears in global
//   identifiers.
//
// - When starting a regular expression with an identifier name, for example if you're matching a
//   string of the form "someVarName = ...", make sure to put some kind of word boundary at the
//   beginning, e.g. `,` `;` `}` or `{`.  This can **SIGNIFICANTLY** speed up matching, easily
//   bringing a 1.5s search down to 30ms.  **DO NOT** use `\b`, because it doesn't properly treat
//   `$`, which appears in identifiers often, as a word character, so `\b[$\w]+` will NOT match `,$=`.
//

import { applySystemPrompts } from './systemPrompts';
import {
  writeDisclaimerNeutralization,
  writeContextHeaderReframing,
  writeSubagentClaudeMdRestoration,
  writeReminderAuthorityFix,
  writeIsMetaFlagRemoval,
  writeEmbeddedToolsGateResolution,
  GOVERNANCE_DEFAULTS,
  isContentPatched,
} from './governance';
import {
  restoreNativeBinaryFromBackup,
  restoreClijsFromBackup,
} from '../installationBackup';

export { showDiff, showPositionalDiff, globalReplace } from './patchDiffing';
export {
  findChalkVar,
  getModuleLoaderFunction,
  getReactModuleNameNonBun,
  getReactModuleFunctionBun,
  getReactVar,
  clearReactVarCache,
  findRequireFunc,
  getRequireFuncName,
  clearRequireFuncNameCache,
  findTextComponent,
  findBoxComponent,
} from './helpers';

export interface LocationResult {
  startIndex: number;
  endIndex: number;
  identifiers?: string[];
}

export interface ModificationEdit {
  startIndex: number;
  endIndex: number;
  newContent: string;
}

// =============================================================================
// Patch Group and Result Types
// =============================================================================

export enum PatchGroup {
  SYSTEM_PROMPTS = 'System Prompts',
  GOVERNANCE = 'Governance',
  // Kept for Ink UI compatibility (no patches use these anymore)
  ALWAYS_APPLIED = 'Always Applied',
  MISC_CONFIGURABLE = 'Misc Configurable',
  FEATURES = 'Features',
}

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

export interface ApplyCustomizationResult {
  config: TweakccConfig;
  results: PatchResult[];
}

// =============================================================================
// Patch Definitions — Governance Only
// =============================================================================

const PATCH_DEFINITIONS = [
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

interface PatchImplementation {
  fn: (content: string) => string | null;
  condition?: boolean;
  signature?: string;
}

// =============================================================================
// Legacy types (for backward compatibility)
// =============================================================================

export interface PatchApplied {
  newContent: string;
  items: string[];
}

// =============================================================================
// Helper Functions
// =============================================================================

export const escapeIdent = (ident: string): string => {
  return ident.replace(/\$/g, '\\$');
};

const applyPatchImplementations = (
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

    // If a signature is defined and already present, the patch is already active
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

// =============================================================================
// Main Apply Function
// =============================================================================

export const applyCustomization = async (
  config: TweakccConfig,
  ccInstInfo: ClaudeCodeInstallationInfo,
  patchFilter?: string[] | null
): Promise<ApplyCustomizationResult> => {
  let content: string;

  if (ccInstInfo.nativeInstallationPath) {
    let backupExists = false;
    try {
      await fs.stat(NATIVE_BINARY_BACKUP_FILE);
      backupExists = true;
    } catch {
      // Backup doesn't exist
    }

    // Contamination check: if backup exists, verify it's from a clean binary.
    // If contaminated, delete it — the normal no-backup flow will extract from
    // the installed binary directly. If THAT is also patched, the "already applied"
    // detection in the governance patch loop handles it.
    if (backupExists) {
      debug('Checking backup for governance contamination...');
      const probe = await extractClaudeJsFromNativeInstallation(NATIVE_BINARY_BACKUP_FILE);
      if (probe && isContentPatched(probe.toString('utf8'))) {
        console.log(
          chalk.yellow('⚠ Backup is contaminated (contains governance patches). Removing stale backup.')
        );
        await fs.unlink(NATIVE_BINARY_BACKUP_FILE);
        backupExists = false;
      }
    }

    if (backupExists) {
      await restoreNativeBinaryFromBackup(ccInstInfo);
    }

    const pathToExtractFrom = backupExists
      ? NATIVE_BINARY_BACKUP_FILE
      : ccInstInfo.nativeInstallationPath;

    debug(
      `Extracting claude.js from ${backupExists ? 'backup' : 'native installation'}: ${pathToExtractFrom}`
    );

    const claudeJsBuffer =
      await extractClaudeJsFromNativeInstallation(pathToExtractFrom);

    if (!claudeJsBuffer) {
      throw new Error('Failed to extract claude.js from native installation');
    }

    const origPath = path.join(CONFIG_DIR, 'native-claudejs-orig.js');
    fsSync.writeFileSync(origPath, claudeJsBuffer);
    debug(`Saved original extracted JS from native to: ${origPath}`);

    content = claudeJsBuffer.toString('utf8');
  } else {
    await restoreClijsFromBackup(ccInstInfo);

    if (!ccInstInfo.cliPath) {
      throw new Error('cliPath is required for NPM installations');
    }

    content = await fs.readFile(ccInstInfo.cliPath, { encoding: 'utf8' });
  }

  const allResults: PatchResult[] = [];

  // ==========================================================================
  // Apply system prompt customizations (prompt overrides)
  // ==========================================================================
  const systemPromptsResult = await applySystemPrompts(
    content,
    ccInstInfo.version,
    undefined,
    patchFilter
  );
  content = systemPromptsResult.newContent;

  const sortedSystemPromptResults = [...systemPromptsResult.results].sort(
    (a, b) => a.name.localeCompare(b.name)
  );
  allResults.push(...sortedSystemPromptResults);

  // ==========================================================================
  // Post-prompts: resolve USE_EMBEDDED_TOOLS_FN gates
  // Runs AFTER prompt system so pieces regex can match the original ternaries,
  // then cleans up any remaining unresolved gates.
  // ==========================================================================
  const gateResult = writeEmbeddedToolsGateResolution(content);
  if (gateResult !== null) {
    content = gateResult;
    allResults.push({
      id: 'embedded-tools-gate',
      name: 'USE_EMBEDDED_TOOLS_FN Gate Resolution',
      group: PatchGroup.GOVERNANCE,
      applied: true,
      description: 'Resolved embedded tools conditionals to ant branch',
    });
  }

  // ==========================================================================
  // Apply governance patches
  // ==========================================================================

  // Read governance config (governance section)
  const govConfig = (config.settings as unknown as Record<string, unknown>)
    .governance as Record<string, unknown> | undefined;

  const disclaimerMode =
    (govConfig?.disclaimerMode as 'strip' | 'replace') ?? 'replace';
  const enableIsMetaRemoval =
    (govConfig?.enableIsMetaRemoval as boolean) ?? false;

  const disclaimerSig = (govConfig?.disclaimerText as string | undefined) ??
    GOVERNANCE_DEFAULTS.disclaimerReplacement;
  const headerSig = (govConfig?.headerText as string | undefined) ??
    GOVERNANCE_DEFAULTS.headerReplacement;
  const reminderSig = (govConfig?.reminderFramingText as string | undefined) ??
    GOVERNANCE_DEFAULTS.reminderFramingReplacement;

  const patchImplementations: Record<PatchId, PatchImplementation> = {
    'disclaimer-neutralization': {
      fn: c =>
        writeDisclaimerNeutralization(
          c,
          disclaimerMode,
          govConfig?.disclaimerText as string | undefined
        ),
      signature: disclaimerSig,
    },
    'context-header-reframing': {
      fn: c =>
        writeContextHeaderReframing(
          c,
          govConfig?.headerText as string | undefined
        ),
      signature: headerSig,
    },
    'subagent-claudemd-restoration': {
      fn: c => writeSubagentClaudeMdRestoration(c),
      signature: 'tengu_slim_subagent_claudemd",!1)',
    },
    'reminder-authority-fix': {
      fn: c =>
        writeReminderAuthorityFix(
          c,
          govConfig?.reminderFramingText as string | undefined
        ),
      signature: reminderSig,
    },
    'ismeta-flag-removal': {
      fn: c => writeIsMetaFlagRemoval(c),
      condition: enableIsMetaRemoval,
    },
  };

  const { content: patchedContent, results: patchResults } =
    applyPatchImplementations(content, patchImplementations, patchFilter);
  content = patchedContent;
  allResults.push(...patchResults);

  // ==========================================================================
  // Write the modified content back
  // ==========================================================================
  if (ccInstInfo.nativeInstallationPath) {
    debug(
      `Repacking modified claude.js into native installation: ${ccInstInfo.nativeInstallationPath}`
    );

    const patchedPath = path.join(CONFIG_DIR, 'native-claudejs-patched.js');
    fsSync.writeFileSync(patchedPath, content, 'utf8');
    debug(`Saved patched JS from native to: ${patchedPath}`);

    const modifiedBuffer = Buffer.from(content, 'utf8');
    await repackNativeInstallation(
      ccInstInfo.nativeInstallationPath,
      modifiedBuffer,
      ccInstInfo.nativeInstallationPath
    );
  } else {
    if (!ccInstInfo.cliPath) {
      throw new Error('cliPath is required for NPM installations');
    }

    await replaceFileBreakingHardLinks(ccInstInfo.cliPath, content, 'patch');
  }

  const updatedConfig = await updateConfigFile(cfg => {
    cfg.changesApplied = true;
  });

  return {
    config: updatedConfig,
    results: allResults,
  };
};
