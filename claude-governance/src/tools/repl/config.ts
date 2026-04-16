import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface ReplConfig {
  mode?: 'coexist' | 'replace';
  timeout?: number;
  maxResultSize?: number;
  maxReadFileSize?: number;
  allowAllModules?: boolean;
}

let replConfig: ReplConfig | null = null;

export function loadConfig(): ReplConfig {
  if (replConfig) return replConfig;
  try {
    const cfgPath = path.join(os.homedir(), '.claude-governance', 'config.json');
    const raw = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    const cfg: ReplConfig = raw.repl || {};
    if (cfg.mode && cfg.mode !== 'coexist' && cfg.mode !== 'replace') {
      console.error('[REPL] Invalid repl.mode: "' + cfg.mode + '" — must be "coexist" or "replace"');
      delete cfg.mode;
    }
    if (cfg.timeout !== undefined && (typeof cfg.timeout !== 'number' || cfg.timeout < 1000)) {
      console.error('[REPL] Invalid repl.timeout: ' + cfg.timeout + ' — must be number >= 1000');
      delete cfg.timeout;
    }
    if (cfg.maxResultSize !== undefined && (typeof cfg.maxResultSize !== 'number' || cfg.maxResultSize < 1000)) {
      console.error('[REPL] Invalid repl.maxResultSize: ' + cfg.maxResultSize + ' — must be number >= 1000');
      delete cfg.maxResultSize;
    }
    if (cfg.maxReadFileSize !== undefined && (typeof cfg.maxReadFileSize !== 'number' || cfg.maxReadFileSize < 1024)) {
      console.error('[REPL] Invalid repl.maxReadFileSize: ' + cfg.maxReadFileSize + ' — must be number >= 1024');
      delete cfg.maxReadFileSize;
    }
    if (cfg.allowAllModules !== undefined && typeof cfg.allowAllModules !== 'boolean') {
      console.error('[REPL] Invalid repl.allowAllModules: ' + cfg.allowAllModules + ' — must be boolean');
      delete cfg.allowAllModules;
    }
    replConfig = cfg;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    if (msg.includes('JSON')) {
      console.error('[REPL] config.json parse error — using defaults');
    }
    replConfig = {};
  }
  return replConfig!;
}

export function getTimeout(): number {
  return loadConfig().timeout || 120000;
}

export function getMaxResultSize(): number {
  return loadConfig().maxResultSize || 100000;
}

export function getMaxReadFileSize(): number {
  return loadConfig().maxReadFileSize || 256 * 1024;
}

export function getAllowAllModules(): boolean {
  return loadConfig().allowAllModules === true;
}
