import type {
  GovernanceModule,
  ModuleContext,
  ModuleApplyResult,
  ModuleStatus,
} from './types';

function getWireServerPath(): string {
  const path = require('node:path');
  return path.resolve(__dirname, '..', 'data', 'wire', 'wire-server.cjs');
}

function getMcpConfigPath(): string {
  const path = require('node:path');
  const os = require('node:os');
  return path.join(os.homedir(), '.claude', '.mcp.json');
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

    let mcpConfig: { mcpServers?: Record<string, unknown> } = {};
    try {
      mcpConfig = JSON.parse(await fs.readFile(mcpPath, 'utf8'));
    } catch {
      // File doesn't exist or isn't valid JSON — create fresh
    }

    if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};

    const existing = mcpConfig.mcpServers.wire as
      | { command?: string; args?: string[] }
      | undefined;
    if (
      existing?.command === 'node' &&
      existing?.args?.[0] === serverPath
    ) {
      return { applied: false, message: 'Wire MCP server already registered' };
    }

    mcpConfig.mcpServers.wire = {
      type: 'stdio',
      command: 'node',
      args: [serverPath],
    };

    await fs.writeFile(mcpPath, JSON.stringify(mcpConfig, null, 2) + '\n');

    return {
      applied: true,
      message: 'Wire MCP server registered in ~/.claude/.mcp.json',
    };
  },

  async getStatus(_context: ModuleContext): Promise<ModuleStatus> {
    const fsSync = await import('node:fs');
    const mcpPath = getMcpConfigPath();
    const serverPath = getWireServerPath();

    const serverExists = fsSync.existsSync(serverPath);

    let registered = false;
    try {
      const mcpConfig = JSON.parse(fsSync.readFileSync(mcpPath, 'utf8'));
      registered = !!mcpConfig?.mcpServers?.wire;
    } catch {
      // File missing
    }

    if (serverExists && registered) {
      return { enabled: true, healthy: true, details: 'Server built, MCP registered' };
    }

    const issues = [];
    if (!serverExists) issues.push('wire-server.cjs missing');
    if (!registered) issues.push('not in .mcp.json');

    return {
      enabled: true,
      healthy: false,
      details: issues.join(', '),
    };
  },
};
