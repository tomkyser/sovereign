import type {
  GovernanceModule,
  ModuleContext,
  ModuleApplyResult,
  ModuleStatus,
} from './types';

import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { homedir } from 'node:os';

const __pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function getRalphHooksDir(): string {
  return resolve(__pkgDir, 'data', 'hooks', 'ralph');
}

function getSettingsPath(): string {
  return join(homedir(), '.claude', 'settings.json');
}

function getHooksDir(): string {
  return join(homedir(), '.claude', 'hooks');
}

const RALPH_HOOKS = [
  { file: 'ralph-layer0.cjs', event: 'UserPromptSubmit', matcher: undefined },
  { file: 'ralph-repl-checkpoint.cjs', event: 'PreToolUse', matcher: 'REPL' },
];

async function deployHooks(): Promise<string[]> {
  const fs = await import('node:fs/promises');
  const fsSync = await import('node:fs');
  const deployed: string[] = [];
  const sourceDir = getRalphHooksDir();
  const targetDir = getHooksDir();

  if (!fsSync.existsSync(targetDir)) {
    await fs.mkdir(targetDir, { recursive: true });
  }

  for (const hook of RALPH_HOOKS) {
    const src = join(sourceDir, hook.file);
    const dst = join(targetDir, hook.file);
    if (!fsSync.existsSync(src)) continue;
    await fs.copyFile(src, dst);
    await fs.chmod(dst, 0o755);
    deployed.push(hook.file);
  }

  return deployed;
}

async function registerHooksInSettings(): Promise<boolean> {
  const fs = await import('node:fs/promises');
  const settingsPath = getSettingsPath();

  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
  } catch {
    return false;
  }

  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;
  let changed = false;

  for (const def of RALPH_HOOKS) {
    const cmd = `node "$HOME/.claude/hooks/${def.file}"`;

    if (!hooks[def.event]) hooks[def.event] = [];
    const eventHooks = hooks[def.event] as Array<{
      matcher?: string;
      hooks?: Array<{ type: string; command: string; timeout?: number }>;
    }>;

    const already = eventHooks.some(
      (e) => e.hooks?.some((h) => h.command?.includes(def.file))
    );

    if (!already) {
      const entry: {
        matcher?: string;
        hooks: Array<{ type: string; command: string; timeout: number }>;
      } = {
        hooks: [{ type: 'command', command: cmd, timeout: 5 }],
      };
      if (def.matcher) entry.matcher = def.matcher;
      eventHooks.push(entry);
      changed = true;
    }
  }

  if (changed) {
    settings.hooks = hooks;
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  }

  return changed;
}

async function unregisterHooksFromSettings(): Promise<boolean> {
  const fs = await import('node:fs/promises');
  const settingsPath = getSettingsPath();

  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
  } catch {
    return false;
  }

  const hooks = (settings.hooks ?? {}) as Record<string, unknown[]>;
  let changed = false;

  for (const def of RALPH_HOOKS) {
    if (!hooks[def.event]) continue;
    const eventHooks = hooks[def.event] as Array<{
      hooks?: Array<{ command?: string }>;
    }>;

    const filtered = eventHooks.filter(
      (e) => !e.hooks?.some((h) => h.command?.includes(def.file))
    );

    if (filtered.length !== eventHooks.length) {
      hooks[def.event] = filtered;
      changed = true;
    }
  }

  if (changed) {
    settings.hooks = hooks;
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  }

  return changed;
}

export const ralphModule: GovernanceModule = {
  id: 'ralph',
  name: 'RALPH',
  description:
    'Reasoning-Anchored Loop for Planning and Hypothesizing — cognitive redirect hooks',
  required: false,
  defaultEnabled: false,
  verificationEntries: [],

  async apply(_context: ModuleContext): Promise<ModuleApplyResult> {
    const details: string[] = [];

    const deployed = await deployHooks();
    if (deployed.length > 0) {
      details.push(`Hooks deployed: ${deployed.join(', ')}`);
    }

    const hooksChanged = await registerHooksInSettings();
    if (hooksChanged) {
      details.push('Hooks registered in settings.json');
    }

    const applied = deployed.length > 0 || hooksChanged;
    return {
      applied,
      message: applied
        ? 'RALPH cognitive redirect hooks installed'
        : 'RALPH hooks already configured',
      details,
    };
  },

  async getStatus(_context: ModuleContext): Promise<ModuleStatus> {
    const fsSync = await import('node:fs');
    const hooksDir = getHooksDir();

    const checks: Array<{ name: string; ok: boolean }> = [];

    for (const hook of RALPH_HOOKS) {
      checks.push({
        name: hook.file,
        ok: fsSync.existsSync(join(hooksDir, hook.file)),
      });
    }

    let settingsOk = false;
    try {
      const raw = fsSync.readFileSync(getSettingsPath(), 'utf8');
      const settings = JSON.parse(raw);
      const hooks = settings.hooks ?? {};

      settingsOk = RALPH_HOOKS.every((def) => {
        const eventHooks = hooks[def.event] as
          | Array<{ hooks?: Array<{ command?: string }> }>
          | undefined;
        return eventHooks?.some((e) =>
          e.hooks?.some((h) => h.command?.includes(def.file))
        );
      });
    } catch {}
    checks.push({ name: 'settings', ok: settingsOk });

    const allOk = checks.every((c) => c.ok);
    const issues = checks.filter((c) => !c.ok).map((c) => c.name);

    return {
      enabled: true,
      healthy: allOk,
      details: allOk
        ? 'Layer 0 + REPL checkpoint active'
        : `Missing: ${issues.join(', ')}`,
    };
  },
};
