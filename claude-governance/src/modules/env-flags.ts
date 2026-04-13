import type {
  GovernanceModule,
  ModuleContext,
  ModuleApplyResult,
  ModuleStatus,
} from './types';

export const RECOMMENDED_ENV: Record<string, string> = {
  CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING: '1',
  MAX_THINKING_TOKENS: '128000',
  CLAUDE_CODE_EFFORT_LEVEL: 'max',
  DISABLE_AUTOUPDATER: '1',
  ENABLE_LSP_TOOL: '1',
  EMBEDDED_SEARCH_TOOLS: '1',
};

const SETTINGS_PATH_CANDIDATES = [
  '.claude/settings.json',
  '.claude/settings.local.json',
];

async function findSettingsPath(): Promise<string | null> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const os = await import('node:os');

  for (const candidate of SETTINGS_PATH_CANDIDATES) {
    const full = path.join(os.homedir(), candidate);
    try {
      await fs.access(full);
      return full;
    } catch {
      continue;
    }
  }
  return null;
}

async function readSettings(): Promise<{
  path: string;
  data: Record<string, unknown>;
} | null> {
  const fs = await import('node:fs/promises');
  const settingsPath = await findSettingsPath();
  if (!settingsPath) return null;

  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    return { path: settingsPath, data: JSON.parse(raw) };
  } catch {
    return null;
  }
}

export const envFlagsModule: GovernanceModule = {
  id: 'env-flags',
  name: 'Environment Flags',
  description: 'Recommended CC environment variables for full capability',
  required: false,
  defaultEnabled: true,
  verificationEntries: [],

  async apply(_context: ModuleContext): Promise<ModuleApplyResult> {
    const fs = await import('node:fs/promises');
    const settings = await readSettings();

    if (!settings) {
      return {
        applied: false,
        message: 'settings.json not found — skipping env flags',
      };
    }

    const env = (settings.data.env as Record<string, unknown>) ?? {};
    const added: string[] = [];

    for (const [key, value] of Object.entries(RECOMMENDED_ENV)) {
      if (!(key in env)) {
        env[key] = value;
        added.push(key);
      }
    }

    if (added.length === 0) {
      return {
        applied: false,
        message: 'all recommended env vars already set',
      };
    }

    settings.data.env = env;
    await fs.writeFile(
      settings.path,
      JSON.stringify(settings.data, null, 2) + '\n',
      'utf8',
    );

    return {
      applied: true,
      message: `added ${added.length} env var(s)`,
      details: added,
    };
  },

  async getStatus(_context: ModuleContext): Promise<ModuleStatus> {
    const settings = await readSettings();
    if (!settings) {
      return { enabled: true, healthy: false, details: 'settings.json not found' };
    }

    const env = (settings.data.env as Record<string, unknown>) ?? {};
    const missing: string[] = [];
    for (const key of Object.keys(RECOMMENDED_ENV)) {
      if (!(key in env)) missing.push(key);
    }

    if (missing.length === 0) {
      return {
        enabled: true,
        healthy: true,
        details: `${Object.keys(RECOMMENDED_ENV).length}/${Object.keys(RECOMMENDED_ENV).length} env vars set`,
      };
    }

    return {
      enabled: true,
      healthy: false,
      details: `missing: ${missing.join(', ')}`,
    };
  },
};
