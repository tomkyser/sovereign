'use strict';
// repl-safety.cjs — PostToolUse:REPL
// Post-execution safety for REPL tool calls.
// Parses the operations log from REPL results, then:
//   1. Auto-formats files that were written or edited
//   2. Runs per-file lint on modified files
//   3. Flags policy violations (writes to .env, .git, lockfiles)
//
// Uses clawback's detect-stack for format/lint detection (same as post-edit.cjs).
// Part of claude-governance. Will be managed by setup/launch module pre-M7.

const path = require('node:path');

let _detectStack, _safeExec;
function getModules() {
  if (!_detectStack) {
    const libDir = [
      path.join(__dirname, 'lib'),
      path.join(__dirname, '..', 'lib'),
    ].find(d => { try { require(path.join(d, 'detect-stack.cjs')); return true; } catch { return false; } });

    if (libDir) {
      _detectStack = require(path.join(libDir, 'detect-stack.cjs')).detectStack;
      _safeExec = require(path.join(libDir, 'exec.cjs')).safeExec;
    } else {
      _detectStack = () => ({ format: null, lintFile: null, sourceExtensions: [] });
      _safeExec = () => Buffer.from('');
    }
  }
  return { detectStack: _detectStack, safeExec: _safeExec };
}

const PROTECTED_BASENAMES = new Set([
  '.env', '.env.local', '.env.development', '.env.production', '.env.test', '.envrc',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'Gemfile.lock', 'poetry.lock', 'Cargo.lock', 'composer.lock',
]);

function isProtectedPath(filePath) {
  const base = path.basename(filePath).toLowerCase();
  if (PROTECTED_BASENAMES.has(base) || base.startsWith('.env.')) return true;
  const segments = filePath.split(path.sep);
  return segments.some(s => s === '.git');
}

function extractModifiedFiles(resultText) {
  const files = new Set();
  const opPattern = /^\d+\.\s+(write|edit)\(([^)]+)\)/gm;
  let match;
  while ((match = opPattern.exec(resultText)) !== null) {
    let filePath = match[2].trim();
    if (filePath.startsWith('/')) {
      files.add(filePath);
    }
  }

  const successPattern = /→\s+(?:create|update|edited):\s+(.+?)\s+\[/gm;
  while ((match = successPattern.exec(resultText)) !== null) {
    let filePath = match[1].trim();
    if (filePath.startsWith('/')) {
      files.add(filePath);
    }
  }
  return [...files];
}

async function main() {
  let input;
  try {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    input = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    process.exit(0);
  }

  if (input.tool_name !== 'REPL') {
    process.exit(0);
  }

  const resultText = (() => {
    const r = input.tool_result;
    if (typeof r === 'string') return r;
    if (r && r.data && typeof r.data === 'string') return r.data;
    if (r && Array.isArray(r.content)) {
      return r.content.map(c => typeof c === 'string' ? c : (c.text || '')).join('\n');
    }
    return '';
  })();

  if (!resultText) process.exit(0);

  const modifiedFiles = extractModifiedFiles(resultText);
  if (modifiedFiles.length === 0) process.exit(0);

  const { detectStack, safeExec } = getModules();
  const messages = [];

  const violations = modifiedFiles.filter(isProtectedPath);
  if (violations.length > 0) {
    messages.push(
      `[REPL POLICY VIOLATION] Protected file(s) modified via REPL: ${violations.map(f => path.basename(f)).join(', ')}. ` +
      'Review these changes immediately — REPL bypasses file protection hooks.'
    );
  }

  for (const filePath of modifiedFiles) {
    if (isProtectedPath(filePath)) continue;

    const ext = path.extname(filePath).toLowerCase();
    const fileDir = path.dirname(path.resolve(filePath));

    let stack;
    try {
      stack = detectStack(fileDir);
    } catch {
      continue;
    }

    if (!stack.sourceExtensions || !stack.sourceExtensions.includes(ext)) {
      continue;
    }

    const resolvedFile = path.resolve(filePath);

    if (stack.format) {
      try {
        safeExec(stack.format.cmd, [...stack.format.args, resolvedFile], { timeout: 15000 });
      } catch (err) {
        if (!err.skipped && err.code !== 'ENOENT') {
          messages.push(`[REPL FORMAT ERROR] ${path.basename(filePath)}: ${err.message}`);
        }
      }
    }

    if (stack.lintFile) {
      try {
        safeExec(stack.lintFile.cmd, [...stack.lintFile.args, resolvedFile], {
          timeout: 15000,
          encoding: 'utf8',
        });
      } catch (err) {
        if (err.skipped || err.code === 'ENOENT') {
          // skip
        } else if (err.stdout || err.stderr) {
          const lintOutput = ((err.stdout || '') + (err.stderr || '')).trim();
          if (lintOutput) {
            messages.push(`[REPL LINT ERRORS in ${path.basename(filePath)}]\n${lintOutput.slice(0, 2000)}`);
          }
        }
      }
    }
  }

  if (messages.length > 0) {
    process.stdout.write(JSON.stringify({
      additionalContext: messages.join('\n\n'),
    }));
  }

  process.exit(0);
}

main();
