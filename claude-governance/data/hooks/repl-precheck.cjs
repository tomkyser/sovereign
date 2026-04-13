'use strict';
// repl-precheck.cjs — PreToolUse:REPL
// Static analysis of REPL script text before execution.
// Blocks writes to protected paths (.env, .git/, lockfiles).
// Deterministic enforcement — not advisory.
//
// Part of claude-governance. Will be managed by setup/launch module pre-M7.

const path = require('node:path');

const PROTECTED_PATTERNS = [
  { regex: /\bwrite\s*\([^)]*['"]([^'"]*\.env[^'"]*)['"]/i, desc: '.env file' },
  { regex: /\bedit\s*\([^)]*['"]([^'"]*\.env[^'"]*)['"]/i, desc: '.env file' },
  { regex: /\bwrite\s*\([^)]*['"]([^'"]*\/\.git\/[^'"]*)['"]/i, desc: '.git directory' },
  { regex: /\bedit\s*\([^)]*['"]([^'"]*\/\.git\/[^'"]*)['"]/i, desc: '.git directory' },
  { regex: /\bwrite\s*\([^)]*['"]([^'"]*package-lock\.json)['"]/i, desc: 'lockfile' },
  { regex: /\bwrite\s*\([^)]*['"]([^'"]*yarn\.lock)['"]/i, desc: 'lockfile' },
  { regex: /\bwrite\s*\([^)]*['"]([^'"]*pnpm-lock\.yaml)['"]/i, desc: 'lockfile' },
  { regex: /\bwrite\s*\([^)]*['"]([^'"]*Gemfile\.lock)['"]/i, desc: 'lockfile' },
  { regex: /\bwrite\s*\([^)]*['"]([^'"]*poetry\.lock)['"]/i, desc: 'lockfile' },
  { regex: /\bwrite\s*\([^)]*['"]([^'"]*Cargo\.lock)['"]/i, desc: 'lockfile' },
  { regex: /\bedit\s*\([^)]*['"]([^'"]*package-lock\.json)['"]/i, desc: 'lockfile' },
  { regex: /\bedit\s*\([^)]*['"]([^'"]*yarn\.lock)['"]/i, desc: 'lockfile' },
  { regex: /\bedit\s*\([^)]*['"]([^'"]*pnpm-lock\.yaml)['"]/i, desc: 'lockfile' },
];

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

  const script = input.tool_input?.script || '';
  if (!script) process.exit(0);

  for (const { regex, desc } of PROTECTED_PATTERNS) {
    const match = script.match(regex);
    if (match) {
      const target = match[1] || 'unknown';
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason:
            `REPL script blocked: attempted write/edit to protected ${desc} (${path.basename(target)}). ` +
            'Protected files (.env, .git/, lockfiles) must not be modified by AI tools.',
        },
      }));
      return;
    }
  }

  process.exit(0);
}

main();
