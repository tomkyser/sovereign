import * as fsSync from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';

import { TOOLS_DIR } from './deploy';

// =============================================================================
// Tool Deployment Validation (G2+G3)
// =============================================================================

export interface ToolValidationResult {
  name: string;
  valid: boolean;
  missing: string[];
}

export interface ToolDeploymentValidation {
  loaderValid: boolean;
  loaderError?: string;
  tools: ToolValidationResult[];
  toolNames: string[];
}

export const validateToolDeployment = (): ToolDeploymentValidation => {
  const loaderPath = path.join(TOOLS_DIR, 'index.js');

  if (!fsSync.existsSync(TOOLS_DIR)) {
    return {
      loaderValid: false,
      loaderError: 'tools directory missing',
      tools: [],
      toolNames: [],
    };
  }

  if (!fsSync.existsSync(loaderPath)) {
    return {
      loaderValid: false,
      loaderError: 'index.js missing',
      tools: [],
      toolNames: [],
    };
  }

  let tools: unknown[];
  try {
    const req = createRequire(import.meta.url);
    delete req.cache[loaderPath];
    for (const key of Object.keys(req.cache)) {
      if (key.startsWith(TOOLS_DIR)) delete req.cache[key];
    }
    const loaded = req(loaderPath);
    if (!Array.isArray(loaded)) {
      return {
        loaderValid: false,
        loaderError: 'loader did not return an array',
        tools: [],
        toolNames: [],
      };
    }
    tools = loaded;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      loaderValid: false,
      loaderError: msg,
      tools: [],
      toolNames: [],
    };
  }

  const results: ToolValidationResult[] = [];
  const toolNames: string[] = [];

  for (const tool of tools) {
    if (!tool || typeof tool !== 'object') {
      results.push({
        name: '(invalid)',
        valid: false,
        missing: ['not an object'],
      });
      continue;
    }

    const t = tool as Record<string, unknown>;
    const name = typeof t.name === 'string' ? t.name : '(unnamed)';
    const missing: string[] = [];

    if (typeof t.name !== 'string') missing.push('name');
    if (typeof t.call !== 'function') missing.push('call');
    if (typeof t.prompt !== 'function') missing.push('prompt');
    if (typeof t.description !== 'function') missing.push('description');
    if (!t.inputJSONSchema || typeof t.inputJSONSchema !== 'object')
      missing.push('schema');

    results.push({ name, valid: missing.length === 0, missing });
    if (missing.length === 0) toolNames.push(name);
  }

  return { loaderValid: true, tools: results, toolNames };
};

// =============================================================================
// Functional Probe (G1+G5+G32)
// =============================================================================

export interface SingleProbeResult {
  tool: string;
  success: boolean;
  inconclusive: boolean;
  error?: string;
}

export interface FunctionalProbeResult {
  success: boolean;
  inconclusive: boolean;
  error?: string;
  probes: SingleProbeResult[];
}

const runSingleProbe = (
  binaryPath: string,
  prompt: string,
  marker: string,
  toolName: string,
  timeoutMs = 45000
): SingleProbeResult => {
  const { execFileSync } = require('node:child_process');
  try {
    const output = execFileSync(binaryPath, ['-p', prompt], {
      encoding: 'utf-8',
      timeout: timeoutMs,
      cwd: fsSync.existsSync('/tmp') ? '/tmp' : undefined,
      env: { ...process.env, DISABLE_AUTOUPDATER: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (output.includes(marker)) {
      return { tool: toolName, success: true, inconclusive: false };
    }
    return {
      tool: toolName,
      success: false,
      inconclusive: false,
      error: `${marker} not in response`,
    };
  } catch (err: unknown) {
    const e = err as {
      stdout?: string;
      stderr?: string;
      message?: string;
    };
    if (e.stdout && e.stdout.includes(marker)) {
      return { tool: toolName, success: true, inconclusive: false };
    }
    const msg = e.message || String(err);
    if (
      msg.includes('ETIMEDOUT') ||
      msg.includes('timed out') ||
      msg.includes('SIGTERM')
    ) {
      return {
        tool: toolName,
        success: false,
        inconclusive: true,
        error: 'probe timed out',
      };
    }
    return {
      tool: toolName,
      success: false,
      inconclusive:
        msg.includes('auth') ||
        msg.includes('401') ||
        msg.includes('403') ||
        msg.includes('ECONNREFUSED'),
      error: msg.length > 200 ? msg.substring(0, 200) + '...' : msg,
    };
  }
};

export const runFunctionalProbe = async (
  binaryPath: string
): Promise<FunctionalProbeResult> => {
  const pingMarker = 'governance-verify';
  const pingResult = runSingleProbe(
    binaryPath,
    `Use the Ping tool with message '${pingMarker}'`,
    pingMarker,
    'Ping'
  );

  const probes: SingleProbeResult[] = [pingResult];

  if (pingResult.success) {
    const replMarker = '1764';
    const replResult = runSingleProbe(
      binaryPath,
      `Use the REPL tool to evaluate 42*42 and return the result`,
      replMarker,
      'REPL',
      60000
    );
    probes.push(replResult);
  }

  const anySuccess = probes.some(p => p.success);
  const allInconclusive = probes.every(p => p.inconclusive);
  const firstError = probes.find(p => p.error)?.error;

  return {
    success: anySuccess,
    inconclusive: allInconclusive,
    error: firstError,
    probes,
  };
};
