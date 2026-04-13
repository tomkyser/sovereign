'use strict';
// read-before-edit.cjs — PreToolUse:Edit|Write
// Standalone read-before-edit advisory. No GSD dependency.
// Fires when Edit/Write targets an existing file, reminding the model to
// Read the file first. Advisory only — does not block.
//
// Part of claude-governance. Will be managed by setup/launch module pre-M7.

const fs = require('node:fs');
const path = require('node:path');

async function main() {
  let input;
  try {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    input = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    process.exit(0);
  }

  const toolName = input.tool_name;
  if (toolName !== 'Write' && toolName !== 'Edit') {
    process.exit(0);
  }

  const filePath = input.tool_input?.file_path;
  if (!filePath) process.exit(0);

  try {
    fs.accessSync(filePath, fs.constants.F_OK);
  } catch {
    process.exit(0);
  }

  const fileName = path.basename(filePath);
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext:
        `READ-BEFORE-EDIT REMINDER: You are about to modify "${fileName}" which already exists. ` +
        'If you have not already used the Read tool to read this file in the current session, ' +
        'you MUST Read it first before editing. The runtime will reject edits to files that ' +
        'have not been read. Use the Read tool on this file path, then retry your edit.',
    },
  }));
}

main();
