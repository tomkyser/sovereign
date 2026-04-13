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

// Sentinel exit code: handleLaunch uses this when governance itself
// fails (before CC is spawned). Distinguishes "governance broke" from
// "CC ran and returned non-zero." 111 is unused by CC.
export const GOVERNANCE_FAIL_EXIT = 111;

function generateShimScript(): string {
  const govBin = getGovernanceBin();
  return `#!/bin/sh
# claude-governance shim — transparent governance pre-flight for Claude Code
# Installed by: claude-governance setup
# Remove by deleting this file and the PATH line from your shell profile
#
# FAILSAFE: If governance fails before launching CC (exit 111 or 127),
# fall through and launch CC directly. Never block the user.

# Find the real claude binary by searching PATH without our shim dir
find_real_claude() {
  OIFS="$IFS"; IFS=":"
  for dir in $PATH; do
    case "$dir" in */.claude-governance/bin) continue ;; esac
    if [ -x "$dir/claude" ]; then
      echo "$dir/claude"
      IFS="$OIFS"
      return 0
    fi
  done
  IFS="$OIFS"

  # Fallback: check XDG versions directory directly
  VERSIONS_DIR="\${XDG_DATA_HOME:-$HOME/.local/share}/claude/versions"
  if [ -d "$VERSIONS_DIR" ]; then
    LATEST=$(ls -1 "$VERSIONS_DIR" 2>/dev/null | grep -E '^[0-9]+\\.[0-9]+\\.[0-9]+$' | sort -t. -k1,1n -k2,2n -k3,3n | tail -1)
    if [ -n "$LATEST" ] && [ -x "$VERSIONS_DIR/$LATEST" ]; then
      echo "$VERSIONS_DIR/$LATEST"
      return 0
    fi
  fi
  return 1
}

# Run governance launch (not exec — keep shell alive for failsafe)
${govBin} launch -- "$@"
GOV_EXIT=$?

# Exit 111 = governance failed before spawning CC (our sentinel)
# Exit 127 = command not found (node missing, governance not installed)
# Anything else = CC's own exit code, forward it
if [ "$GOV_EXIT" -ne ${GOVERNANCE_FAIL_EXIT} ] && [ "$GOV_EXIT" -ne 127 ]; then
  exit $GOV_EXIT
fi

# Governance failed — fall through to direct CC launch
REAL_CLAUDE=$(find_real_claude)
if [ -n "$REAL_CLAUDE" ] && [ -x "$REAL_CLAUDE" ]; then
  echo "claude-governance: governance unavailable, launching claude directly" >&2
  exec "$REAL_CLAUDE" "$@"
fi

echo "claude-governance: failed to launch Claude Code" >&2
echo "  governance errored and no claude binary found" >&2
echo "  remove shim: rm ~/.claude-governance/bin/claude" >&2
exit 1
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
