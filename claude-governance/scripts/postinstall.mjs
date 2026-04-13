#!/usr/bin/env node

// Lightweight postinstall — welcome message only.
// Never throws. A failing postinstall blocks npm install.

try {
  const isGlobal = process.env.npm_config_global === 'true' ||
    (process.argv[1] || '').includes('node_modules/.hooks');

  // Only show for global installs or npx — skip for library consumers
  if (!isGlobal && !process.env.npm_execpath?.includes('npx')) {
    process.exit(0);
  }

  console.log('');
  console.log('\x1b[32m\u2713\x1b[0m claude-governance installed');
  console.log('');
  console.log('  Get started:');
  console.log('    \x1b[36mclaude-governance setup\x1b[0m   \u2014 configure modules and apply patches');
  console.log('    \x1b[36mclaude-governance apply\x1b[0m   \u2014 apply patches with defaults');
  console.log('    \x1b[36mclaude-governance check\x1b[0m   \u2014 verify governance status');
  console.log('');
} catch {
  // Never fail postinstall
}
