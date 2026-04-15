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

import { applySystemPrompts } from './systemPrompts';
import {
  writeDisclaimerNeutralization,
  writeContextHeaderReframing,
  writeSubagentClaudeMdRestoration,
  writeReminderAuthorityFix,
  writeIsMetaFlagRemoval,
  writeEmbeddedToolsGateResolution,
  writeToolInjection,
  writeReplToolGuidance,
  writeTungstenFs9Patch,
  writeTungstenPanelInjection,
  writeTungstenToolGuidance,
  GOVERNANCE_DEFAULTS,
  isContentPatched,
} from './governance';
import {
  restoreNativeBinaryFromBackup,
  restoreClijsFromBackup,
  backupNativeBinary,
} from '../installationBackup';
import {
  createWorkingCopy,
  deployToInstallPath,
  downloadVirginBinary,
  getVirginPath,
} from '../binaryVault';

import {
  PatchGroup,
  PatchResult,
  applyPatchImplementations,
} from './orchestration';
import type { PatchId, PatchImplementation } from './orchestration';
import {
  deployTools,
  deployUiComponents,
  deployPromptOverrides,
} from './orchestration/deploy';

// =============================================================================
// Re-exports — Orchestration modules
// =============================================================================

export { PatchGroup, getAllPatchDefinitions } from './orchestration';

export type { PatchResult, PatchId, PatchDefinition } from './orchestration';

export {
  validateToolDeployment,
  runFunctionalProbe,
} from './orchestration/validate';

export type {
  ToolValidationResult,
  ToolDeploymentValidation,
  SingleProbeResult,
  FunctionalProbeResult,
} from './orchestration/validate';

// =============================================================================
// Re-exports — Patch utilities
// =============================================================================

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

// =============================================================================
// Local Types
// =============================================================================

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

export interface ApplyCustomizationResult {
  config: TweakccConfig;
  results: PatchResult[];
}

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

    if (backupExists) {
      debug('Checking backup for governance contamination...');
      const probe = await extractClaudeJsFromNativeInstallation(
        NATIVE_BINARY_BACKUP_FILE
      );
      if (probe && isContentPatched(probe.toString('utf8'))) {
        console.log(
          chalk.yellow(
            '⚠ Backup is contaminated (contains governance patches). Removing stale backup.'
          )
        );
        await fs.unlink(NATIVE_BINARY_BACKUP_FILE);
        backupExists = false;
      }
    }

    let pathToExtractFrom: string;

    if (backupExists) {
      await restoreNativeBinaryFromBackup(ccInstInfo);
      pathToExtractFrom = NATIVE_BINARY_BACKUP_FILE;
    } else {
      const version = ccInstInfo.version;
      const virginPath = getVirginPath(version);
      let virginAvailable = fsSync.existsSync(virginPath);

      if (!virginAvailable) {
        debug(
          `No virgin binary for ${version} in vault, attempting download`
        );
        try {
          await downloadVirginBinary(version);
          virginAvailable = true;
        } catch (err) {
          debug(
            `Virgin download failed: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      if (virginAvailable) {
        console.log(
          chalk.blue('Recovering clean binary from virgin vault.')
        );
        createWorkingCopy(version);
        deployToInstallPath(
          version,
          ccInstInfo.nativeInstallationPath
        );
        await backupNativeBinary(ccInstInfo);
        pathToExtractFrom = ccInstInfo.nativeInstallationPath;
      } else {
        debug(
          'No vault available, extracting from installed binary'
        );
        pathToExtractFrom = ccInstInfo.nativeInstallationPath;
      }
    }

    debug(
      `Extracting claude.js from: ${pathToExtractFrom}`
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

  const toolsDeployed = await deployTools();
  if (toolsDeployed > 0) {
    debug(`Deployed ${toolsDeployed} tool file(s)`);
  }

  const uiDeployed = await deployUiComponents();
  if (uiDeployed > 0) {
    debug(`Deployed ${uiDeployed} UI component(s)`);
  }

  const overridesDeployed = await deployPromptOverrides();
  if (overridesDeployed > 0) {
    debug(`Deployed ${overridesDeployed} prompt override(s)`);
  }

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

  const govConfig = (config.settings as unknown as Record<string, unknown>)
    .governance as Record<string, unknown> | undefined;

  const disclaimerMode =
    (govConfig?.disclaimerMode as 'strip' | 'replace') ?? 'replace';
  const enableIsMetaRemoval =
    (govConfig?.enableIsMetaRemoval as boolean) ?? false;

  const disclaimerSig =
    (govConfig?.disclaimerText as string | undefined) ??
    GOVERNANCE_DEFAULTS.disclaimerReplacement;
  const headerSig =
    (govConfig?.headerText as string | undefined) ??
    GOVERNANCE_DEFAULTS.headerReplacement;
  const reminderSig =
    (govConfig?.reminderFramingText as string | undefined) ??
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
    'tool-injection': {
      fn: c => writeToolInjection(c),
      signature: '__claude_governance_tools__',
    },
    'repl-tool-guidance': {
      fn: c => writeReplToolGuidance(c),
      signature: 'could one REPL call do this',
    },
    'tungsten-fs9': {
      fn: c => writeTungstenFs9Patch(c),
      signature: '__CLAUDE_GOVERNANCE_TMUX_ENV',
    },
    'tungsten-panel': {
      fn: c => writeTungstenPanelInjection(c),
      signature: '__tungsten_panel__',
    },
    'tungsten-tool-guidance': {
      fn: c => writeTungstenToolGuidance(c),
      signature:
        'Tungsten session is established at the start of every work session',
    },
  };

  const { content: patchedContent, results: patchResults } =
    applyPatchImplementations(content, patchImplementations, patchFilter);
  content = patchedContent;
  allResults.push(...patchResults);

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
