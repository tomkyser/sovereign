import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import chalk from 'chalk';
import { CONFIG_DIR } from './config';

const SHIM_DIR = path.join(CONFIG_DIR, 'bin');
const SHIM_PATH = path.join(SHIM_DIR, 'claude');

function getGovernanceBin(): string {
  const scriptPath = process.argv[1] || '';

  // If running from a global npm install, use the package bin name
  if (scriptPath.includes('node_modules/.bin') || scriptPath.includes('npx')) {
    return 'claude-governance';
  }

  // Running from source — use the full path to dist/index.mjs
  const distDir = path.resolve(scriptPath, '..');
  const indexPath = path.join(distDir, 'index.mjs');
  if (fsSync.existsSync(indexPath)) {
    return `node ${indexPath}`;
  }

  // Fallback: assume global install
  return 'claude-governance';
}

function generateShimScript(): string {
  const govBin = getGovernanceBin();
  return `#!/bin/sh
# claude-governance shim — transparent governance pre-flight for Claude Code
# Installed by: claude-governance setup
# Remove by deleting this file and the PATH line from your shell profile
exec ${govBin} launch -- "$@"
`;
}

export async function installShim(): Promise<{ installed: boolean; shimPath: string; pathLine: string }> {
  const pathLine = `export PATH="$HOME/.claude-governance/bin:$PATH"`;

  await fs.mkdir(SHIM_DIR, { recursive: true });
  await fs.writeFile(SHIM_PATH, generateShimScript(), { mode: 0o755 });

  return { installed: true, shimPath: SHIM_PATH, pathLine };
}

export function isShimInstalled(): boolean {
  try {
    return fsSync.existsSync(SHIM_PATH);
  } catch {
    return false;
  }
}

export function isShimInPath(): boolean {
  const pathDirs = (process.env.PATH || '').split(':');
  return pathDirs.some(dir => dir.includes('.claude-governance/bin'));
}

function detectShellProfile(): string | null {
  const home = os.homedir();
  const shell = process.env.SHELL || '';

  if (shell.includes('zsh')) {
    return path.join(home, '.zshrc');
  }
  if (shell.includes('bash')) {
    // Prefer .bash_profile on macOS, .bashrc on Linux
    const profile = path.join(home, '.bash_profile');
    if (fsSync.existsSync(profile)) return profile;
    return path.join(home, '.bashrc');
  }
  if (shell.includes('fish')) {
    return path.join(home, '.config', 'fish', 'config.fish');
  }
  return null;
}

export async function addShimToPath(): Promise<{ profile: string; added: boolean } | null> {
  const profile = detectShellProfile();
  if (!profile) return null;

  try {
    const content = await fs.readFile(profile, 'utf8');
    if (content.includes('.claude-governance/bin')) {
      return { profile, added: false };
    }

    const isFish = profile.includes('config.fish');
    const line = isFish
      ? 'set -gx PATH $HOME/.claude-governance/bin $PATH'
      : 'export PATH="$HOME/.claude-governance/bin:$PATH"';

    await fs.appendFile(profile, `\n# claude-governance — transparent wrapper for claude\n${line}\n`);
    return { profile, added: true };
  } catch {
    return null;
  }
}

export function printShimStatus(): void {
  const installed = isShimInstalled();
  const inPath = isShimInPath();

  if (installed && inPath) {
    console.log(`  ${chalk.green('✓')} claude shim active — ${chalk.dim('claude')} commands go through governance`);
  } else if (installed && !inPath) {
    console.log(`  ${chalk.yellow('⚠')} shim installed at ${SHIM_PATH} but not in PATH`);
    console.log(`    Add to your shell profile: ${chalk.cyan('export PATH="$HOME/.claude-governance/bin:$PATH"')}`);
  } else {
    console.log(`  ${chalk.dim('○')} claude shim not installed — run ${chalk.cyan('claude-governance setup')} to enable`);
  }
}
