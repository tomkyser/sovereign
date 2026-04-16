import * as vm from 'node:vm';
import { getAllowAllModules } from './config';

export interface ToolContext {
  options?: { tools?: Array<{ name: string; call: Function }> };
  abortController?: { signal: { aborted: boolean } };
  [key: string]: unknown;
}

interface Operation {
  tool: string;
  args: Record<string, unknown>;
  startTime: number;
  success?: boolean;
  resultSummary?: string;
  error?: string;
  duration?: number;
}

// ---------------------------------------------------------------------------
// Module-level persistent state (survives across REPL calls within a session)
// ---------------------------------------------------------------------------

let vmContext: vm.Context | null = null;
let currentContext: ToolContext | null = null;
let operations: Operation[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let selfRef: any = null;

export function getCurrentContext(): ToolContext | null { return currentContext; }
export function setCurrentContext(ctx: ToolContext | null): void { currentContext = ctx; }
export function getOperations(): Operation[] { return operations; }
export function resetOperations(): void { operations = []; }
export function setSelfRef(ref: unknown): void { selfRef = ref; }

export function makeParentMessage() {
  const id = 'repl-' + Math.random().toString(36).substring(2, 15);
  return { uuid: id, message: { id: id, role: 'assistant', content: [] as unknown[] } };
}

// ---------------------------------------------------------------------------
// Tool Lookup Helper
// ---------------------------------------------------------------------------

export function findTool(name: string) {
  if (selfRef && selfRef._stashedTools) {
    for (let i = 0; i < selfRef._stashedTools.length; i++) {
      if (selfRef._stashedTools[i].name === name) return selfRef._stashedTools[i];
    }
  }
  const tools = currentContext && currentContext.options && currentContext.options.tools;
  if (!tools) return null;
  for (let i = 0; i < tools.length; i++) {
    if (tools[i].name === name) return tools[i];
  }
  return null;
}

export function checkAbort(): void {
  if (currentContext && currentContext.abortController &&
      currentContext.abortController.signal &&
      currentContext.abortController.signal.aborted) {
    throw new Error('Operation cancelled');
  }
}

// ---------------------------------------------------------------------------
// Operation Tracking
// ---------------------------------------------------------------------------

function summarizeArgs(toolName: string, args: Record<string, unknown>): Record<string, unknown> {
  const s: Record<string, unknown> = {};
  for (const k of Object.keys(args)) {
    const v = args[k];
    if (typeof v === 'string' && v.length > 100) {
      s[k] = v.substring(0, 97) + '...';
    } else {
      s[k] = v;
    }
  }
  return s;
}

function summarizeResult(toolName: string, result: unknown): string {
  if (toolName === 'read') {
    if (typeof result === 'string') {
      const lines = result.split('\n').length;
      return `${lines} lines read`;
    }
  }
  if (toolName === 'bash' || toolName === 'grep' || toolName === 'glob') {
    if (typeof result === 'string') {
      const lines = result.split('\n').filter(Boolean).length;
      return `${lines} lines`;
    }
  }
  if (toolName === 'write') return String(result);
  if (toolName === 'edit') return String(result);
  if (result === undefined || result === null) return 'ok';
  if (typeof result === 'string') return result.substring(0, 80);
  try { return JSON.stringify(result).substring(0, 80); } catch { return String(result); }
}

export async function tracked<T>(toolName: string, args: Record<string, unknown>, fn: () => Promise<T>): Promise<T> {
  const op: Operation = { tool: toolName, args: summarizeArgs(toolName, args), startTime: Date.now() };
  try {
    const result = await fn();
    op.success = true;
    op.resultSummary = summarizeResult(toolName, result);
    op.duration = Date.now() - op.startTime;
    operations.push(op);
    return result;
  } catch (err: unknown) {
    op.success = false;
    op.error = err instanceof Error ? err.message : String(err);
    op.duration = Date.now() - op.startTime;
    operations.push(op);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Console Capture
// ---------------------------------------------------------------------------

export interface CapturedConsole {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  dir: (obj: unknown) => void;
  table: (data: unknown) => void;
  debug: (...args: unknown[]) => void;
  getStdout: () => string;
  getStderr: () => string;
  clear: () => void;
}

function createCapturedConsole(): CapturedConsole {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    log: (...args) => stdout.push(args.map(String).join(' ')),
    warn: (...args) => stderr.push(args.map(String).join(' ')),
    error: (...args) => stderr.push(args.map(String).join(' ')),
    info: (...args) => stdout.push(args.map(String).join(' ')),
    dir: (obj) => stdout.push(JSON.stringify(obj, null, 2)),
    table: (data) => stdout.push(JSON.stringify(data, null, 2)),
    debug: (...args) => stdout.push(args.map(String).join(' ')),
    getStdout: () => stdout.join('\n'),
    getStderr: () => stderr.join('\n'),
    clear: () => { stdout.length = 0; stderr.length = 0; },
  };
}

// ---------------------------------------------------------------------------
// Safe Require
// ---------------------------------------------------------------------------

const SAFE_MODULES = new Set(['path', 'url', 'querystring', 'crypto', 'util', 'os']);

function createSafeRequire() {
  const unrestricted = getAllowAllModules();
  return function safeRequire(moduleName: string) {
    if (unrestricted || SAFE_MODULES.has(moduleName)) return require(moduleName);
    throw new Error(
      `require('${moduleName}') is not allowed. ` +
      `Allowed modules: ${[...SAFE_MODULES].join(', ')}. ` +
      `Set repl.allowAllModules: true in ~/.claude-governance/config.json to unlock all modules.`
    );
  };
}

// ---------------------------------------------------------------------------
// VM Context Creation
// ---------------------------------------------------------------------------

export function getOrCreateVM(handlers: Record<string, Function>): vm.Context & { console: CapturedConsole } {
  if (vmContext) return vmContext as vm.Context & { console: CapturedConsole };

  const capturedConsole = createCapturedConsole();
  const sandbox = {
    ...handlers,
    state: {},
    console: capturedConsole,
    JSON, Math, Date, RegExp, Array, Object, Map, Set, WeakMap, WeakSet,
    Promise, Symbol, Proxy, Reflect,
    Buffer, URL, URLSearchParams, TextEncoder, TextDecoder, process,
    setTimeout, clearTimeout, setInterval, clearInterval,
    parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent,
    encodeURI, decodeURI,
    Error, TypeError, RangeError, SyntaxError, ReferenceError,
    require: createSafeRequire(),
  };

  vmContext = vm.createContext(sandbox);
  return vmContext as vm.Context & { console: CapturedConsole };
}
