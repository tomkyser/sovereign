#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';

import {
  CONFIG_DIR,
  CONFIG_FILE,
  readConfigFile,
  updateConfigFile,
  fetchConfigFromUrl,
} from './config';
import {
  enableDebug,
  enableVerbose,
  enableShowUnchanged,
  isShowUnchanged,
} from './utils';
import {
  applyCustomization,
  PatchResult,
  PatchGroup,
  getAllPatchDefinitions,
} from './patches/index';
import {
  preloadStringsFile,
  getSystemPromptDefinitions,
} from './systemPromptSync';
import { migrateConfigIfNeeded } from './migration';
import { startupCheck } from './startup';
import {
  formatNotFoundError,
  InstallationDetectionError,
} from './installationDetection';
import { handleUnpack, handleRepack, handleAdhocPatch } from './commands';
import {
  restoreClijsFromBackup,
  restoreNativeBinaryFromBackup,
} from './installationBackup';
import { clearAllAppliedHashes } from './systemPromptHashIndex';
import { extractClaudeJsFromNativeInstallation } from './nativeInstallationLoader';
import {
  VERIFICATION_REGISTRY,
} from './patches/governance';

// =============================================================================
// Invocation Command Detection
// =============================================================================

function getInvocationCommand(): string {
  const args = process.argv;
  const scriptPath = args[1] || '';

  if (scriptPath.includes('npx') || scriptPath.includes('.npm/_npx')) {
    return 'npx claude-governance';
  }
  if (scriptPath.includes('pnpm') || scriptPath.includes('.pnpm')) {
    return 'pnpm dlx claude-governance';
  }
  if (scriptPath.includes('yarn')) {
    return 'yarn dlx claude-governance';
  }
  if (scriptPath.includes('bun')) {
    return 'bunx claude-governance';
  }

  return 'claude-governance';
}

// =============================================================================
// Patch Results Display
// =============================================================================

function printPatchResults(
  results: PatchResult[],
  patchFilter?: string[] | null
): void {
  const groupOrder = [
    PatchGroup.SYSTEM_PROMPTS,
    PatchGroup.GOVERNANCE,
  ];

  const byGroup = new Map<PatchGroup, PatchResult[]>();
  for (const group of groupOrder) {
    byGroup.set(group, []);
  }
  for (const result of results) {
    const groupResults = byGroup.get(result.group);
    if (groupResults) {
      groupResults.push(result);
    }
  }

  console.log(
    '\nPatches applied (run with --show-unchanged to show all):'
  );

  for (const group of groupOrder) {
    const groupResults = byGroup.get(group)!;

    const filtered = groupResults.filter(
      r =>
        r.applied ||
        r.failed ||
        isShowUnchanged() ||
        (patchFilter && patchFilter.includes(r.id))
    );
    if (filtered.length === 0) continue;

    console.log(`\n  ${chalk.bold(group)}:`);

    for (const result of filtered) {
      const status = result.failed
        ? chalk.red('✗')
        : result.applied
          ? chalk.green('✓')
          : chalk.dim('○');
      const details = result.details ? `: ${result.details}` : '';
      const description =
        result.applied && result.description
          ? ` ${chalk.gray('—')} ${chalk.gray(result.description)}`
          : '';
      console.log(`    ${status} ${result.name}${details}${description}`);
    }
  }

  console.log('');
}

const main = async () => {
  const program = new Command();
  program
    .name('claude-governance')
    .description(
      'Restore user authority over Claude Code. Governance patches, prompt overrides, and verification.'
    )
    .version('0.1.0')
    .option('-d, --debug', 'enable debug mode')
    .option('-v, --verbose', 'enable verbose debug mode (includes diffs)')
    .option('--show-unchanged', 'show unchanged diffs (requires --verbose)')
    .option('-a, --apply', 'apply governance patches and prompt overrides')
    .option('--restore', 'restore Claude Code to its original state')
    .option(
      '--revert',
      'restore Claude Code to its original state (alias for --restore)'
    )
    .option(
      '--patches <ids>',
      'comma-separated list of patch IDs to apply (use with --apply)'
    )
    .option('--list-patches', 'list all available patches with their IDs')
    .option(
      '--list-system-prompts [version]',
      'list all available system prompts for a CC version'
    )
    .option(
      '--config-url <url>',
      'fetch configuration from a URL instead of local config.json'
    )
    .action(async () => {
      const options = program.opts();

      if (options.verbose) {
        enableVerbose();
      } else if (options.debug) {
        enableDebug();
      }

      if (options.showUnchanged) {
        enableShowUnchanged();
      }

      await migrateConfigIfNeeded();

      if (options.apply && (options.restore || options.revert)) {
        console.error(
          chalk.red(
            'Error: Cannot use --apply and --restore/--revert together.'
          )
        );
        process.exit(1);
      }

      if (options.listPatches) {
        handleListPatches();
        return;
      }

      if (options.listSystemPrompts !== undefined) {
        await handleListSystemPrompts(
          options.listSystemPrompts as string | true
        );
        return;
      }

      if (options.restore || options.revert) {
        await handleRestoreMode();
        return;
      }

      if (options.configUrl && !options.apply) {
        console.error(
          chalk.red('Error: --config-url can only be used with --apply.')
        );
        process.exit(1);
      }

      // Default action: apply (--apply flag is optional)
      const patchFilter = options.patches
        ? (options.patches as string)
            .split(',')
            .map((id: string) => id.trim())
        : null;
      await handleApplyMode(patchFilter, options.configUrl);
    });

  // =========================================================================
  // Subcommands
  // =========================================================================

  program
    .command('check')
    .argument('[binary-path]', 'path to native binary (default: auto-detect)')
    .description('Verify governance patches are applied to the binary')
    .action(async (binaryPath?: string) => {
      const options = program.opts();
      if (options.verbose) enableVerbose();
      else if (options.debug) enableDebug();
      await handleCheck(binaryPath);
    });

  program
    .command('launch')
    .description('Launch Claude Code with governance pre-flight verification')
    .option('--no-verify', 'skip pre-flight governance verification')
    .option('--force-apply', 'reapply governance patches even if state is current')
    .argument('[args...]', 'arguments to pass to Claude Code')
    .action(async (args: string[], cmdOptions: { verify?: boolean; forceApply?: boolean }) => {
      const options = program.opts();
      if (options.debug) enableDebug();
      await handleLaunch(args, {
        skipVerify: cmdOptions.verify === false,
        forceApply: cmdOptions.forceApply === true,
      });
    });

  program
    .command('unpack')
    .argument('<output-js-path>', 'path to write extracted JS')
    .argument('[binary-path]', 'path to native binary (default: auto-detect)')
    .description('Extract JS from a native Claude Code binary')
    .action(async (outputJsPath: string, binaryPath?: string) => {
      await handleUnpack(outputJsPath, binaryPath);
      process.exit(0);
    });

  program
    .command('repack')
    .argument('<input-js-path>', 'path to JS file to embed')
    .argument('[binary-path]', 'path to native binary (default: auto-detect)')
    .description('Embed JS into a native Claude Code binary')
    .action(async (inputJsPath: string, binaryPath?: string) => {
      await handleRepack(inputJsPath, binaryPath);
      process.exit(0);
    });

  program
    .command('adhoc-patch')
    .description('Apply an ad-hoc patch to Claude Code')
    .option(
      '-s, --string <values...>',
      'replace string: <old-string> <new-string>'
    )
    .option('-r, --regex <values...>', 'replace regex: <pattern> <replacement>')
    .option(
      '--script <script>',
      'run a patch script (prefix with @ for file/URL)'
    )
    .option(
      '-i, --index <number>',
      'replace only the Nth occurrence (1-based)',
      parseInt
    )
    .option(
      '-p, --path <path>',
      'path to cli.js or native binary (default: auto-detect)'
    )
    .option(
      '--confirm-possible-dangerous-patch',
      'skip diff preview and apply immediately'
    )
    .option(
      '--dangerous-no-script-sandbox',
      'run --script without the Node.js permission sandbox (use if Node < 20)'
    )
    .action(
      async (options: {
        string?: string[];
        regex?: string[];
        script?: string;
        index?: number;
        path?: string;
        confirmPossibleDangerousPatch?: boolean;
        dangerousNoScriptSandbox?: boolean;
      }) => {
        await handleAdhocPatch(options);
        process.exit(0);
      }
    );

  program.parse();
};

// =============================================================================
// Apply Mode
// =============================================================================

async function handleApplyMode(
  patchFilter: string[] | null,
  configUrl?: string
): Promise<void> {
  console.log('Applying governance patches to Claude Code...');

  let config;
  if (configUrl) {
    console.log(`Fetching configuration from: ${configUrl}`);
    try {
      config = await fetchConfigFromUrl(configUrl);
      console.log('Configuration fetched successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red(`Error: ${message}`));
      process.exit(1);
    }
  } else {
    console.log(`Configuration: ${CONFIG_FILE}`);
    config = await readConfigFile();
  }

  try {
    const result = await startupCheck({ interactive: false }, config);

    if (!result.startupCheckInfo || !result.startupCheckInfo.ccInstInfo) {
      console.error(formatNotFoundError());
      process.exit(1);
    }

    const { ccInstInfo } = result.startupCheckInfo;

    if (ccInstInfo.nativeInstallationPath) {
      console.log(
        `Found Claude Code (native): ${ccInstInfo.nativeInstallationPath}`
      );
    } else {
      console.log(`Found Claude Code at: ${ccInstInfo.cliPath}`);
    }
    console.log(`Version: ${ccInstInfo.version}`);

    console.log('Loading system prompts...');
    const preloadResult = await preloadStringsFile(ccInstInfo.version);
    if (!preloadResult.success) {
      console.log(chalk.red('\n✖ Error loading system prompts:'));
      console.log(chalk.red(`  ${preloadResult.errorMessage}`));
      console.log(
        chalk.yellow(
          '\n⚠ System prompts not available — skipping prompt overrides'
        )
      );
    }

    console.log('Applying patches...');
    const { results } = await applyCustomization(
      config,
      ccInstInfo,
      patchFilter
    );

    printPatchResults(results, patchFilter);

    const hasFailures = results.some(r => r.failed);

    if (hasFailures) {
      console.log(chalk.yellow('Applied with some failures.'));
      console.log(
        chalk.dim(
          'Patching errors do not affect system prompt overrides.'
        )
      );
    } else {
      console.log(chalk.green('All governance patches applied successfully.'));
    }

    // Post-apply verification — run check against the patched binary and write state.json
    const binaryForVerify = ccInstInfo.nativeInstallationPath ?? ccInstInfo.cliPath;
    if (binaryForVerify) {
      try {
        const verifyBuffer = await extractClaudeJsFromNativeInstallation(binaryForVerify);
        if (verifyBuffer) {
          const verifyJs = verifyBuffer.toString('utf8');
          const verifyResults = runVerification(verifyJs);
          const passing = verifyResults.filter(r => r.pass).length;
          const failing = verifyResults.filter(r => !r.pass);
          const criticalFail = failing.filter(r => r.critical);
          const status = failing.length === 0
            ? 'SOVEREIGN'
            : criticalFail.length > 0
              ? 'DEGRADED'
              : 'PARTIAL';
          await writeVerificationState(verifyResults, status, binaryForVerify, ccInstInfo.version);
          console.log(chalk.dim(`  Verified: ${status} (${passing}/${verifyResults.length})`));
        }
      } catch {
        // Verification is best-effort after apply
      }
    }

    console.log(
      chalk.dim(
        `Run ${getInvocationCommand()} --restore to revert to original.`
      )
    );
    process.exit(0);
  } catch (error) {
    if (error instanceof InstallationDetectionError) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
    throw error;
  }
}

// =============================================================================
// Restore Mode
// =============================================================================

async function handleRestoreMode(): Promise<void> {
  console.log('Restoring Claude Code to its original state...');

  try {
    const result = await startupCheck({ interactive: false });

    if (!result.startupCheckInfo || !result.startupCheckInfo.ccInstInfo) {
      console.error(formatNotFoundError());
      process.exit(1);
    }

    const { ccInstInfo } = result.startupCheckInfo;

    if (ccInstInfo.nativeInstallationPath) {
      console.log(
        `Found Claude Code (native): ${ccInstInfo.nativeInstallationPath}`
      );
    } else {
      console.log(`Found Claude Code at: ${ccInstInfo.cliPath}`);
    }
    console.log(`Version: ${ccInstInfo.version}`);

    console.log('Restoring from backup...');
    let restored: boolean;
    if (ccInstInfo.nativeInstallationPath) {
      restored = await restoreNativeBinaryFromBackup(ccInstInfo);
    } else {
      restored = await restoreClijsFromBackup(ccInstInfo);
    }

    if (!restored) {
      console.error(
        chalk.red('No backup found. Cannot restore original Claude Code.')
      );
      console.error(
        chalk.yellow(
          'A backup is created automatically on first apply.'
        )
      );
      process.exit(1);
    }

    await clearAllAppliedHashes();

    await updateConfigFile(config => {
      config.changesApplied = false;
    });

    console.log(chalk.blue('Original Claude Code restored.'));
    console.log(
      chalk.gray(
        `Customizations saved in ${CONFIG_FILE} — reapply with ${getInvocationCommand()} --apply`
      )
    );
    process.exit(0);
  } catch (error) {
    if (error instanceof InstallationDetectionError) {
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
    throw error;
  }
}

// =============================================================================
// List Patches
// =============================================================================

function handleListPatches(): void {
  const patches = getAllPatchDefinitions();

  const groupOrder = [
    PatchGroup.GOVERNANCE,
  ];

  const byGroup = new Map<PatchGroup, typeof patches>();
  for (const group of groupOrder) {
    byGroup.set(group, []);
  }
  for (const patch of patches) {
    const groupPatches = byGroup.get(patch.group);
    if (groupPatches) {
      groupPatches.push(patch);
    }
  }

  const cmd = getInvocationCommand();
  console.log(
    chalk.gray(
      `Use --patches <ids> with --apply to apply specific patches, e.g.:`
    )
  );
  console.log();
  console.log(chalk.gray(`  ${cmd} --apply --patches "disclaimer-neutralization"`));
  console.log();
  console.log(chalk.blue.bold('Available patches'));
  console.log();

  for (const group of groupOrder) {
    const groupPatches = byGroup.get(group)!;
    if (groupPatches.length === 0) continue;

    console.log(chalk.bold(group) + ':');

    for (const patch of groupPatches) {
      console.log(`  ${chalk.cyan(patch.id)}`);
      console.log(
        `    ${chalk.white(patch.name)} ${chalk.gray('—')} ${chalk.gray(patch.description)}`
      );
    }
    console.log('');
  }

  console.log(chalk.bold('System Prompts:'));
  console.log(
    chalk.dim(
      '  Use --list-system-prompts [version] to see available prompt overrides.'
    )
  );
}

// =============================================================================
// List System Prompts
// =============================================================================

async function handleListSystemPrompts(
  versionArg: string | true
): Promise<void> {
  let version: string;

  if (typeof versionArg === 'string') {
    version = versionArg;
  } else {
    console.log('Detecting installed Claude Code version...');
    try {
      const result = await startupCheck({ interactive: false });
      if (!result.startupCheckInfo?.ccInstInfo?.version) {
        console.error(
          chalk.red(
            'Could not detect Claude Code version. Specify one:'
          )
        );
        console.error(chalk.gray(`  ${getInvocationCommand()} --list-system-prompts 2.1.101`));
        process.exit(1);
      }
      version = result.startupCheckInfo.ccInstInfo.version;
    } catch {
      console.error(
        chalk.red(
          'Could not detect Claude Code. Specify a version:'
        )
      );
      console.error(chalk.gray(`  ${getInvocationCommand()} --list-system-prompts 2.1.101`));
      process.exit(1);
    }
  }

  console.log(`Loading system prompts for CC ${version}...`);

  const preloadResult = await preloadStringsFile(version);
  if (!preloadResult.success) {
    console.error(chalk.red(`\n✖ Error loading system prompts:`));
    console.error(chalk.red(`  ${preloadResult.errorMessage}`));
    process.exit(1);
  }

  const prompts = getSystemPromptDefinitions();
  if (!prompts || prompts.length === 0) {
    console.error(chalk.yellow('No system prompts found for this version.'));
    process.exit(1);
  }

  const getGroupName = (name: string): string => {
    const colonIndex = name.indexOf(':');
    if (colonIndex === -1) return 'Other';
    const group = name.substring(0, colonIndex).trim();
    if (group === 'Data') return group;
    return group + 's';
  };

  const byGroup = new Map<string, typeof prompts>();
  for (const prompt of prompts) {
    const group = getGroupName(prompt.name);
    if (!byGroup.has(group)) {
      byGroup.set(group, []);
    }
    byGroup.get(group)!.push(prompt);
  }

  const sortedGroups = [...byGroup.keys()].sort((a, b) => a.localeCompare(b));

  const cmd = getInvocationCommand();
  console.log(
    chalk.gray(
      `Use --patches <ids> with --apply to apply specific prompts, e.g.:`
    )
  );
  console.log();
  console.log(chalk.gray(`  ${cmd} --apply --patches "identity,environment"`));
  console.log();
  console.log(chalk.blue.bold(`System prompts for CC ${version}`));
  console.log();

  for (const group of sortedGroups) {
    const groupPrompts = byGroup.get(group)!;
    groupPrompts.sort((a, b) => a.name.localeCompare(b.name));

    console.log(chalk.bold(group) + ':');

    for (const prompt of groupPrompts) {
      console.log(`  ${chalk.cyan(prompt.id)}`);
      console.log(
        `    ${chalk.white(prompt.name)} ${chalk.gray('—')} ${chalk.gray(prompt.description)}`
      );
    }
    console.log('');
  }
}

// =============================================================================
// Check (Governance Verification)
// =============================================================================

interface CheckResult {
  id: string;
  name: string;
  pass: boolean;
  critical: boolean;
  details?: string;
}

function matchEntry(
  js: string,
  pattern: string | RegExp | undefined,
): boolean {
  if (!pattern) return false;
  return typeof pattern === 'string' ? js.includes(pattern) : pattern.test(js);
}

function runVerification(js: string): CheckResult[] {
  const results: CheckResult[] = [];

  for (const entry of VERIFICATION_REGISTRY) {
    const hasSig = entry.signature ? matchEntry(js, entry.signature) : true;
    const hasAntiSig = entry.antiSignature
      ? matchEntry(js, entry.antiSignature)
      : false;

    const pass = hasSig && !hasAntiSig;

    let details: string;
    if (pass) {
      details = entry.passDetail ?? 'active';
    } else if (!hasSig && entry.signature) {
      details = 'replacement text not found';
    } else if (hasAntiSig && hasSig) {
      details = 'replacement present but original also found';
    } else if (hasAntiSig && entry.category === 'gate') {
      const count = typeof entry.antiSignature === 'string'
        ? (js.match(new RegExp(entry.antiSignature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
        : 0;
      details = `${count} unresolved ${entry.antiSignature} references`;
    } else if (hasAntiSig) {
      details = 'original text still present';
    } else {
      details = 'not found';
    }

    results.push({
      id: entry.id,
      name: entry.name,
      pass,
      critical: entry.critical,
      details,
    });
  }

  return results;
}

interface VerificationState {
  timestamp: string;
  governanceVersion: string;
  ccVersion?: string;
  binaryPath: string;
  status: string;
  checks: Array<{
    id: string;
    name: string;
    pass: boolean;
    critical: boolean;
    details?: string;
  }>;
  passCount: number;
  totalCount: number;
}

async function readVerificationState(): Promise<VerificationState | null> {
  const fsP = await import('node:fs/promises');
  const pathM = await import('node:path');
  const statePath = pathM.join(CONFIG_DIR, 'state.json');
  try {
    const raw = await fsP.readFile(statePath, 'utf8');
    return JSON.parse(raw) as VerificationState;
  } catch {
    return null;
  }
}

async function writeVerificationState(
  results: CheckResult[],
  status: string,
  binaryPath: string,
  ccVersion?: string,
): Promise<void> {
  const fsP = await import('node:fs/promises');
  const pathM = await import('node:path');

  const stateDir = CONFIG_DIR;
  await fsP.mkdir(stateDir, { recursive: true });

  const state: VerificationState = {
    timestamp: new Date().toISOString(),
    governanceVersion: '0.1.0',
    ccVersion,
    binaryPath,
    status,
    checks: results.map(r => ({
      id: r.id,
      name: r.name,
      pass: r.pass,
      critical: r.critical,
      details: r.details,
    })),
    passCount: results.filter(r => r.pass).length,
    totalCount: results.length,
  };

  const statePath = pathM.join(stateDir, 'state.json');
  await fsP.writeFile(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

async function handleCheck(binaryPath?: string): Promise<void> {
  console.log('Verifying governance patches...\n');

  // Find the binary
  let targetPath = binaryPath;
  let detectedVersion: string | undefined;
  if (!targetPath) {
    try {
      const config = await readConfigFile();
      const result = await startupCheck({ interactive: false }, config);
      if (result.startupCheckInfo?.ccInstInfo?.nativeInstallationPath) {
        targetPath = result.startupCheckInfo.ccInstInfo.nativeInstallationPath;
      } else if (result.startupCheckInfo?.ccInstInfo?.cliPath) {
        targetPath = result.startupCheckInfo.ccInstInfo.cliPath;
      }
      detectedVersion = result.startupCheckInfo?.ccInstInfo?.version;
    } catch {
      // Fall through
    }
  }

  if (!targetPath) {
    console.error(chalk.red('Could not find Claude Code binary.'));
    console.error(chalk.gray('Specify path: claude-governance check /path/to/binary'));
    process.exit(1);
  }

  console.log(`Binary: ${targetPath}`);

  // Extract JS from binary
  let js: string;
  try {
    const buffer = await extractClaudeJsFromNativeInstallation(targetPath);
    if (!buffer) {
      console.error(chalk.red('Failed to extract JS from binary.'));
      process.exit(1);
    }
    js = buffer.toString('utf8');
    console.log(`Extracted: ${js.length.toLocaleString()} characters\n`);
  } catch (err) {
    // Might be an npm install (plain JS file)
    const fs = await import('node:fs/promises');
    try {
      js = await fs.readFile(targetPath, 'utf8');
      console.log(`Read: ${js.length.toLocaleString()} characters\n`);
    } catch {
      console.error(chalk.red(`Failed to read: ${targetPath}`));
      process.exit(1);
    }
  }

  const results: CheckResult[] = runVerification(js);

  // --- Display results ---

  const passing = results.filter(r => r.pass);
  const failing = results.filter(r => !r.pass);
  const criticalFail = failing.filter(r => r.critical);

  const categories: Array<{ key: string; label: string }> = [
    { key: 'governance', label: 'Governance Patches' },
    { key: 'gate', label: 'Gate Resolution' },
    { key: 'prompt-override', label: 'Prompt Overrides' },
  ];

  for (const cat of categories) {
    const catResults = results.filter(
      r => VERIFICATION_REGISTRY.find(e => e.id === r.id)?.category === cat.key
    );
    if (catResults.length === 0) continue;

    const catPass = catResults.every(r => r.pass);
    const catIcon = catPass ? chalk.green('✓') : chalk.red('✗');
    console.log(`  ${catIcon} ${chalk.bold(cat.label)}`);

    for (const r of catResults) {
      const icon = r.pass ? chalk.green('✓') : chalk.red('✗');
      console.log(`    ${icon} ${r.name}`);
      if (r.details) {
        console.log(`      ${chalk.gray(r.details)}`);
      }
    }
  }

  console.log('');

  const status = failing.length === 0
    ? 'SOVEREIGN'
    : criticalFail.length > 0
      ? 'DEGRADED'
      : 'PARTIAL';

  if (status === 'SOVEREIGN') {
    console.log(chalk.green.bold(`  SOVEREIGN — ${passing.length}/${results.length} checks passed`));
  } else if (status === 'DEGRADED') {
    console.log(chalk.red.bold(`  DEGRADED — ${criticalFail.length} critical check(s) failed`));
    console.log(chalk.gray(`  Run: ${getInvocationCommand()} --apply`));
  } else {
    console.log(chalk.yellow.bold(`  PARTIAL — ${failing.length} non-critical check(s) failed`));
  }

  // Write verification state
  await writeVerificationState(results, status, targetPath, detectedVersion);

  process.exit(criticalFail.length > 0 ? 1 : 0);
}

// =============================================================================
// Launch Mode (Wrapper)
// =============================================================================

async function handleLaunch(
  args: string[],
  options: { skipVerify?: boolean; forceApply?: boolean },
): Promise<void> {
  const { spawn } = await import('node:child_process');

  // Detect CC installation
  let ccInstInfo;
  try {
    const config = await readConfigFile();
    const result = await startupCheck({ interactive: false }, config);
    ccInstInfo = result.startupCheckInfo?.ccInstInfo;
  } catch {
    // Fall through
  }

  if (!ccInstInfo) {
    console.error(chalk.red('Could not find Claude Code installation.'));
    process.exit(1);
  }

  const binaryPath = ccInstInfo.nativeInstallationPath ?? ccInstInfo.cliPath;
  if (!binaryPath) {
    console.error(chalk.red('Could not determine Claude Code binary path.'));
    process.exit(1);
  }

  // Pre-flight governance verification
  if (!options.skipVerify) {
    let needsApply = options.forceApply === true;

    if (!needsApply) {
      const state = await readVerificationState();
      if (!state) {
        console.log(chalk.yellow('No governance state found — applying patches...'));
        needsApply = true;
      } else if (state.ccVersion !== ccInstInfo.version) {
        console.log(
          chalk.yellow(
            `CC version changed (${state.ccVersion} → ${ccInstInfo.version}) — reapplying...`
          )
        );
        needsApply = true;
      } else if (state.status !== 'SOVEREIGN') {
        console.log(chalk.yellow(`Governance ${state.status} — reapplying...`));
        needsApply = true;
      } else {
        console.log(chalk.green(`Governance: SOVEREIGN (${state.passCount}/${state.totalCount})`));
      }
    }

    if (needsApply) {
      try {
        const config = await readConfigFile();
        await handleApplyForLaunch(config, ccInstInfo);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(chalk.yellow(`⚠ Governance apply failed: ${msg}`));
        console.log(chalk.yellow('  Launching without governance patches.'));
      }
    }
  }

  // Build environment — merge config env overrides
  const launchEnv = { ...process.env };
  try {
    const config = await readConfigFile();
    const govConfig = (config.settings as unknown as Record<string, unknown>)
      .governance as Record<string, unknown> | undefined;
    const envOverrides = govConfig?.env as Record<string, string> | undefined;
    if (envOverrides) {
      for (const [key, value] of Object.entries(envOverrides)) {
        launchEnv[key] = String(value);
      }
    }
  } catch {
    // Config read failure is non-fatal for env injection
  }

  // Spawn CC with inherited stdio and signal forwarding
  console.log(chalk.dim(`Launching Claude Code ${ccInstInfo.version}...`));

  const child = spawn(binaryPath, args, {
    stdio: 'inherit',
    env: launchEnv,
  });

  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  for (const sig of signals) {
    process.on(sig, () => {
      child.kill(sig);
    });
  }

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 1);
    }
  });

  child.on('error', (err) => {
    console.error(chalk.red(`Failed to launch Claude Code: ${err.message}`));
    process.exit(1);
  });
}

async function handleApplyForLaunch(
  config: import('./types').TweakccConfig,
  ccInstInfo: import('./types').ClaudeCodeInstallationInfo,
): Promise<void> {
  await preloadStringsFile(ccInstInfo.version);
  const { results } = await applyCustomization(config, ccInstInfo, null);

  const applied = results.filter(r => r.applied).length;
  const failed = results.filter(r => r.failed).length;

  if (failed > 0) {
    console.log(chalk.yellow(`  Applied ${applied}, failed ${failed}`));
  } else {
    console.log(chalk.green(`  Applied ${applied} patches`));
  }

  // Post-apply verification + state.json
  const binaryForVerify = ccInstInfo.nativeInstallationPath ?? ccInstInfo.cliPath;
  if (binaryForVerify) {
    try {
      const verifyBuffer = await extractClaudeJsFromNativeInstallation(binaryForVerify);
      if (verifyBuffer) {
        const verifyJs = verifyBuffer.toString('utf8');
        const verifyResults = runVerification(verifyJs);
        const failing = verifyResults.filter(r => !r.pass);
        const criticalFail = failing.filter(r => r.critical);
        const status = failing.length === 0
          ? 'SOVEREIGN'
          : criticalFail.length > 0
            ? 'DEGRADED'
            : 'PARTIAL';
        await writeVerificationState(verifyResults, status, binaryForVerify, ccInstInfo.version);
        console.log(chalk.green(`  Governance: ${status} (${verifyResults.filter(r => r.pass).length}/${verifyResults.length})`));
      }
    } catch {
      // Verification is best-effort
    }
  }
}

main();
