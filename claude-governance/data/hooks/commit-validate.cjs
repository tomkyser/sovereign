'use strict';
// commit-validate.cjs — PreToolUse:Bash
// Standalone commit message validation. No GSD dependency.
// Blocks git commit commands with empty or trivially short messages.
// Does NOT enforce Conventional Commits — this project uses descriptive prefixes.
//
// Part of claude-governance. Will be managed by setup/launch module pre-M7.

async function main() {
  let input;
  try {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    input = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    process.exit(0);
  }

  const cmd = input.tool_input?.command || '';

  if (!/^\s*git\s+commit\b/.test(cmd)) {
    process.exit(0);
  }

  let msg = '';
  const doubleQuote = cmd.match(/-m\s+"([^"]+)"/);
  const singleQuote = cmd.match(/-m\s+'([^']+)'/);
  const heredoc = cmd.match(/-m\s+"\$\(cat\s+<<'?EOF'?\n([\s\S]*?)\nEOF/);

  if (heredoc) {
    msg = heredoc[1].trim();
  } else if (doubleQuote) {
    msg = doubleQuote[1].trim();
  } else if (singleQuote) {
    msg = singleQuote[1].trim();
  }

  if (!msg) {
    process.exit(0);
  }

  const subject = msg.split('\n')[0];

  if (subject.length < 10) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          `Commit subject too short (${subject.length} chars). ` +
          'Write a descriptive commit message that explains WHY the change was made.',
      },
    }));
    return;
  }

  if (subject.length > 120) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          `Commit subject too long (${subject.length} chars, max 120). ` +
          'Move details to the commit body.',
      },
    }));
    return;
  }

  process.exit(0);
}

main();
