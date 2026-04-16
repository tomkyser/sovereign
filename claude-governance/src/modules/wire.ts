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

function getWireServerPath(): string {
  return resolve(__pkgDir, 'data', 'wire', 'wire-server.cjs');
}

function getWireHooksDir(): string {
  return resolve(__pkgDir, 'data', 'hooks');
}

function getMcpConfigPath(): string {
  return join(homedir(), '.claude', '.mcp.json');
}

function getSettingsPath(): string {
  return join(homedir(), '.claude', 'settings.json');
}

function getHooksDir(): string {
  return join(homedir(), '.claude', 'hooks');
}

function getWireStateDir(): string {
  return join(homedir(), '.claude-governance', 'wire');
}

async function deployHooks(): Promise<string[]> {
  const fs = await import('node:fs/promises');
  const fsSync = await import('node:fs');
  const deployed: string[] = [];
  const sourceDir = getWireHooksDir();
  const targetDir = getHooksDir();

  if (!fsSync.existsSync(targetDir)) {
    await fs.mkdir(targetDir, { recursive: true });
  }

  const hooks = ['wire-verify.cjs', 'wire-cleanup.cjs'];
  for (const hook of hooks) {
    const src = join(sourceDir, hook);
    const dst = join(targetDir, hook);
    if (!fsSync.existsSync(src)) continue;
    await fs.copyFile(src, dst);
    await fs.chmod(dst, 0o755);
    deployed.push(hook);
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

  const verifyCmd = 'node "$HOME/.claude/hooks/wire-verify.cjs"';
  const cleanupCmd = 'node "$HOME/.claude/hooks/wire-cleanup.cjs"';

  if (!hooks.SessionStart) hooks.SessionStart = [];
  const sessionStart = hooks.SessionStart as Array<{ hooks?: Array<{ type: string; command: string }> }>;
  const hasVerify = sessionStart.some(
    (e) => e.hooks?.some((h) => h.command?.includes('wire-verify'))
  );
  if (!hasVerify) {
    sessionStart.push({
      hooks: [{ type: 'command', command: verifyCmd }],
    });
    changed = true;
  }

  if (!hooks.Stop) hooks.Stop = [];
  const stop = hooks.Stop as Array<{ hooks?: Array<{ type: string; command: string; timeout?: number }> }>;
  const hasCleanup = stop.some(
    (e) => e.hooks?.some((h) => h.command?.includes('wire-cleanup'))
  );
  if (!hasCleanup) {
    stop.push({
      hooks: [{ type: 'command', command: cleanupCmd, timeout: 5 }],
    });
    changed = true;
  }

  if (changed) {
    settings.hooks = hooks;
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
  }

  return changed;
}

export const wireModule: GovernanceModule = {
  id: 'wire',
  name: 'Wire',
  description: 'Inter-session communication via MCP channel server',
  required: false,
  defaultEnabled: false,
  verificationEntries: [],

  async apply(_context: ModuleContext): Promise<ModuleApplyResult> {
    const fs = await import('node:fs/promises');
    const fsSync = await import('node:fs');
    const mcpPath = getMcpConfigPath();
    const serverPath = getWireServerPath();

    if (!fsSync.existsSync(serverPath)) {
      return {
        applied: false,
        message: 'wire-server.cjs not found — run build:wire first',
      };
    }

    const details: string[] = [];

    // 1. Register MCP server
    let mcpConfig: { mcpServers?: Record<string, unknown> } = {};
    try {
      mcpConfig = JSON.parse(await fs.readFile(mcpPath, 'utf8'));
    } catch {}

    if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};

    const existing = mcpConfig.mcpServers.wire as
      | { command?: string; args?: string[] }
      | undefined;
    const alreadyRegistered =
      existing?.command === 'node' && existing?.args?.[0] === serverPath;

    if (!alreadyRegistered) {
      mcpConfig.mcpServers.wire = {
        type: 'stdio',
        command: 'node',
        args: [serverPath],
      };
      await fs.writeFile(mcpPath, JSON.stringify(mcpConfig, null, 2) + '\n');
      details.push('MCP server registered');
    } else {
      details.push('MCP server already registered');
    }

    // 2. Deploy hooks
    const deployed = await deployHooks();
    if (deployed.length > 0) {
      details.push(`Hooks deployed: ${deployed.join(', ')}`);
    }

    // 3. Register hooks in settings.json
    const hooksChanged = await registerHooksInSettings();
    if (hooksChanged) {
      details.push('Hooks registered in settings.json');
    }

    // 4. Ensure wire state directory
    const wireStateDir = getWireStateDir();
    if (!fsSync.existsSync(wireStateDir)) {
      await fs.mkdir(wireStateDir, { recursive: true });
      details.push('Wire state directory created');
    }

    const applied = !alreadyRegistered || deployed.length > 0 || hooksChanged;
    return {
      applied,
      message: applied ? 'Wire governance integration applied' : 'Wire already configured',
      details,
    };
  },

  async getStatus(_context: ModuleContext): Promise<ModuleStatus> {
    const fsSync = await import('node:fs');
    const mcpPath = getMcpConfigPath();
    const serverPath = getWireServerPath();

    const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];

    // Server artifact
    const serverExists = fsSync.existsSync(serverPath);
    checks.push({ name: 'server', ok: serverExists });

    // MCP registration
    let mcpRegistered = false;
    try {
      const mcpConfig = JSON.parse(fsSync.readFileSync(mcpPath, 'utf8'));
      mcpRegistered = !!mcpConfig?.mcpServers?.wire;
    } catch {}
    checks.push({ name: 'mcp', ok: mcpRegistered });

    // Hooks deployed
    const hooksDir = getHooksDir();
    const verifyHook = fsSync.existsSync(join(hooksDir, 'wire-verify.cjs'));
    const cleanupHook = fsSync.existsSync(join(hooksDir, 'wire-cleanup.cjs'));
    checks.push({ name: 'hooks', ok: verifyHook && cleanupHook });

    // Relay health
    const wireStateDir = getWireStateDir();
    const pidPath = join(wireStateDir, 'relay.pid');
    let relayRunning = false;
    let relayDetail = 'not running';
    if (fsSync.existsSync(pidPath)) {
      try {
        const pid = parseInt(fsSync.readFileSync(pidPath, 'utf-8').trim(), 10);
        process.kill(pid, 0);
        relayRunning = true;
        const portPath = join(wireStateDir, 'relay.port');
        const port = fsSync.existsSync(portPath)
          ? fsSync.readFileSync(portPath, 'utf-8').trim()
          : '?';
        relayDetail = `pid=${pid} port=${port}`;
      } catch {
        relayDetail = 'stale PID';
      }
    }
    checks.push({ name: 'relay', ok: relayRunning, detail: relayDetail });

    const allOk = checks.every((c) => c.ok);
    const coreOk = checks.filter((c) => c.name !== 'relay').every((c) => c.ok);

    const issues = checks.filter((c) => !c.ok);
    let details: string;
    if (allOk) {
      details = `Healthy — relay ${relayDetail}`;
    } else if (coreOk) {
      details = `Core OK, relay ${relayDetail} (starts on first use)`;
    } else {
      details = issues.map((c) => c.detail || c.name).join(', ');
    }

    return {
      enabled: true,
      healthy: coreOk,
      details,
    };
  },
};
