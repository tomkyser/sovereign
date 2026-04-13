import * as readline from 'node:readline';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

import { CONFIG_DIR, CONFIG_FILE, ensureConfigDir, readConfigFile } from './config';
import { startupCheck } from './startup';
import { formatNotFoundError } from './installationDetection';
import { preloadStringsFile } from './systemPromptSync';
import { applyCustomization } from './patches/index';
import { extractClaudeJsFromNativeInstallation } from './nativeInstallationLoader';
import {
  runVerification,
  writeVerificationState,
  deriveStatus,
} from './verification';
import {
  getAllModules,
  getVerificationRegistry,
  applyModules,
  type ModulesConfig,
  type ModuleContext,
} from './modules';

const lineQueue: string[] = [];
const lineWaiters: Array<(line: string) => void> = [];
let rl: readline.Interface | null = null;

function initRL(): void {
  if (rl) return;
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  rl.on('line', line => {
    const waiter = lineWaiters.shift();
    if (waiter) {
      waiter(line);
    } else {
      lineQueue.push(line);
    }
  });
  rl.on('close', () => {
    while (lineWaiters.length > 0) {
      const waiter = lineWaiters.shift();
      if (waiter) waiter('');
    }
  });
}

function closeRL(): void {
  if (rl) {
    rl.close();
    rl = null;
  }
}

function ask(question: string): Promise<string> {
  initRL();
  process.stderr.write(question);
  return new Promise(resolve => {
    const queued = lineQueue.shift();
    if (queued !== undefined) {
      resolve(queued.trim());
    } else {
      lineWaiters.push(line => resolve(line.trim()));
    }
  });
}

async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const answer = await ask(`${question} ${hint}: `);
  if (answer === '') return defaultYes;
  return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
}

export async function handleSetup(): Promise<void> {
  console.log(chalk.blue.bold('\nclaude-governance — Setup\n'));

  // Detect existing config
  const configExists = fsSync.existsSync(CONFIG_FILE);
  if (configExists) {
    console.log(chalk.yellow(`Existing configuration found: ${CONFIG_FILE}`));
    const proceed = await confirm('Reconfigure?', false);
    if (!proceed) {
      console.log(chalk.dim('Setup cancelled.'));
      closeRL();
      process.exit(0);
    }
    console.log('');
  }

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
    console.error(formatNotFoundError());
    process.exit(1);
  }

  const binaryPath = ccInstInfo.nativeInstallationPath ?? ccInstInfo.cliPath;
  console.log(
    `Detected Claude Code ${chalk.bold(ccInstInfo.version)}` +
    (binaryPath ? ` at ${chalk.dim(binaryPath)}` : ''),
  );
  console.log('');

  // Module selection
  console.log(chalk.bold('Modules:\n'));
  const modules = getAllModules();
  const modulesConfig: ModulesConfig = {};

  for (const mod of modules) {
    if (mod.required) {
      console.log(`  ${chalk.green('●')} ${chalk.bold(mod.name)} ${chalk.dim('(required)')}`);
      console.log(`    ${chalk.gray(mod.description)}`);
      modulesConfig[mod.id] = true;
    } else {
      console.log(`  ${chalk.cyan('?')} ${chalk.bold(mod.name)}`);
      console.log(`    ${chalk.gray(mod.description)}`);
      const enable = await confirm(`    Enable?`, mod.defaultEnabled);
      modulesConfig[mod.id] = enable;
      const icon = enable ? chalk.green('✓') : chalk.dim('○');
      // Move cursor up to overwrite the ? with the result
      process.stderr.write(`\x1b[1A\x1b[2K`);
      console.log(`  ${icon} ${chalk.bold(mod.name)} ${enable ? '' : chalk.dim('(disabled)')}`);
    }
    console.log('');
  }

  // Confirm
  console.log(chalk.bold('Configuration:'));
  console.log(`  Config dir: ${chalk.cyan(CONFIG_DIR)}`);
  console.log(`  CC version: ${chalk.cyan(ccInstInfo.version)}`);
  for (const mod of modules) {
    const enabled = modulesConfig[mod.id];
    const icon = enabled ? chalk.green('●') : chalk.dim('○');
    console.log(`  ${icon} ${mod.name}`);
  }
  console.log('');

  const proceed2 = await confirm('Apply governance patches?');
  closeRL();
  if (!proceed2) {
    console.log(chalk.dim('Setup cancelled.'));
    process.exit(0);
  }
  console.log('');

  // Create config dir
  console.log(chalk.dim('Creating configuration directory...'));
  await ensureConfigDir();

  // Write config.json with module selections
  const configPath = path.join(CONFIG_DIR, 'config.json');
  let existingConfig: Record<string, unknown> = {};
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    existingConfig = JSON.parse(raw);
  } catch {
    // Fresh config
  }
  existingConfig.modules = modulesConfig;
  await fs.writeFile(configPath, JSON.stringify(existingConfig, null, 2) + '\n', 'utf8');
  console.log(`  ${chalk.green('✓')} ${configPath}`);

  // Apply patches
  console.log(chalk.dim('\nApplying governance patches...'));
  const config = await readConfigFile();

  try {
    await preloadStringsFile(ccInstInfo.version);
    const { results } = await applyCustomization(config, ccInstInfo, null);

    const applied = results.filter(r => r.applied).length;
    const failed = results.filter(r => r.failed).length;
    const alreadyActive = results.filter(r => !r.applied && !r.failed).length;

    if (failed > 0) {
      console.log(chalk.yellow(`  Applied ${applied}, already active ${alreadyActive}, failed ${failed}`));
    } else if (applied > 0) {
      console.log(chalk.green(`  ✓ ${applied} patches applied, ${alreadyActive} already active`));
    } else {
      console.log(chalk.green(`  ✓ All ${alreadyActive} patches already active`));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(chalk.yellow(`  ⚠ Patch apply failed: ${msg}`));
  }

  // Run module apply
  if (binaryPath) {
    const moduleContext: ModuleContext = {
      configDir: CONFIG_DIR,
      ccVersion: ccInstInfo.version,
      binaryPath,
    };
    const moduleResults = await applyModules(moduleContext, modulesConfig);
    for (const [modId, modResult] of moduleResults) {
      if (modResult.applied) {
        console.log(chalk.green(`  ✓ ${modId}: ${modResult.message}`));
      } else if (modResult.message) {
        console.log(chalk.dim(`  ○ ${modId}: ${modResult.message}`));
      }
    }
  }

  // Verify
  if (binaryPath) {
    console.log(chalk.dim('\nVerifying...'));
    try {
      const registry = getVerificationRegistry(modulesConfig);
      const buffer = await extractClaudeJsFromNativeInstallation(binaryPath);
      if (buffer) {
        const js = buffer.toString('utf8');
        const results = runVerification(js, registry);
        const status = deriveStatus(results);
        await writeVerificationState(results, status, binaryPath, ccInstInfo.version);
        const passing = results.filter(r => r.pass).length;

        if (status === 'SOVEREIGN') {
          console.log(chalk.green.bold(`  SOVEREIGN — ${passing}/${results.length} checks passed`));
        } else if (status === 'DEGRADED') {
          console.log(chalk.red.bold(`  DEGRADED — some critical checks failed`));
        } else {
          console.log(chalk.yellow.bold(`  PARTIAL — ${passing}/${results.length} checks passed`));
        }
      }
    } catch {
      console.log(chalk.yellow('  ⚠ Verification failed'));
    }
  }

  // Summary
  console.log(chalk.green.bold('\n✓ Setup complete.\n'));
  console.log('  Next steps:');
  console.log(`    ${chalk.cyan('claude-governance check')}    — verify governance status`);
  console.log(`    ${chalk.cyan('claude-governance launch')}   — start Claude Code with governance`);
  console.log(`    ${chalk.cyan('claude-governance modules')}  — view module status`);
  console.log('');

  process.exit(0);
}
