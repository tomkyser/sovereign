#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const C = '\x1b[36m', G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m',
      D = '\x1b[2m', B = '\x1b[1m', X = '\x1b[0m';

function findConfigDir() {
  const envOverride = (process.env.CLAUDE_GOVERNANCE_CONFIG_DIR || '').trim();
  if (envOverride) return envOverride.replace(/^~/, os.homedir());
  const defaultDir = path.join(os.homedir(), '.claude-governance');
  if (fs.existsSync(defaultDir)) return defaultDir;
  const legacyDir = path.join(os.homedir(), '.tweakcc');
  if (fs.existsSync(legacyDir)) return legacyDir;
  return defaultDir;
}

function checkServerDeployed() {
  const configDir = findConfigDir();
  const serverPath = path.join(configDir, '..', 'dev', 'claude-code-patches',
    'claude-governance', 'data', 'wire', 'wire-server.cjs');
  if (fs.existsSync(serverPath)) return true;
  const altPaths = [
    path.join(__dirname, '..', '..', 'claude-governance', 'data', 'wire', 'wire-server.cjs'),
    path.join(configDir, 'wire', 'wire-server.cjs'),
  ];
  return altPaths.some(p => fs.existsSync(p));
}

function checkMcpRegistered() {
  const mcpPath = path.join(os.homedir(), '.claude', '.mcp.json');
  try {
    const config = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
    return !!config?.mcpServers?.wire;
  } catch {
    return false;
  }
}

function checkRelayRunning() {
  const configDir = findConfigDir();
  const pidPath = path.join(configDir, 'wire', 'relay.pid');
  const portPath = path.join(configDir, 'wire', 'relay.port');

  if (!fs.existsSync(pidPath)) return { running: false, reason: 'no PID file' };

  try {
    const pid = parseInt(fs.readFileSync(pidPath, 'utf-8').trim(), 10);
    if (isNaN(pid)) return { running: false, reason: 'invalid PID' };
    process.kill(pid, 0);
    const port = fs.existsSync(portPath)
      ? fs.readFileSync(portPath, 'utf-8').trim()
      : '?';
    return { running: true, pid, port };
  } catch {
    return { running: false, reason: 'process not alive' };
  }
}

function writeVerifyState(configDir, results) {
  const wireDir = path.join(configDir, 'wire');
  try {
    if (!fs.existsSync(wireDir)) fs.mkdirSync(wireDir, { recursive: true });
    fs.writeFileSync(
      path.join(wireDir, 'verify.json'),
      JSON.stringify({
        timestamp: new Date().toISOString(),
        results,
      }, null, 2) + '\n'
    );
  } catch {}
}

try {
  const results = [];
  let allGood = true;

  const mcpRegistered = checkMcpRegistered();
  results.push({ name: 'mcp-registered', ok: mcpRegistered });
  if (!mcpRegistered) allGood = false;

  const relay = checkRelayRunning();
  results.push({ name: 'relay', ok: relay.running, detail: relay.running ? `pid=${relay.pid} port=${relay.port}` : relay.reason });

  const configDir = findConfigDir();
  writeVerifyState(configDir, results);

  if (allGood) {
    const msg = `${C}${B}[Wire]${X} ${G}Ready${X} ${D}relay=:${relay.port}${X}`;
    process.stdout.write(JSON.stringify({
      result: msg,
      suppressOutput: false,
      continue: true,
      status: 'ready',
    }) + '\n');
  } else {
    const issues = results.filter(r => !r.ok).map(r => r.detail || r.name);
    const msg = `${C}${B}[Wire]${X} ${Y}Degraded${X} ${D}${issues.join(', ')}${X}`;
    process.stdout.write(JSON.stringify({
      result: msg,
      suppressOutput: false,
      continue: true,
      status: 'degraded',
    }) + '\n');
  }
} catch (err) {
  process.stdout.write(JSON.stringify({
    result: `${C}${B}[Wire]${X} ${R}Error${X} ${D}${err.message}${X}`,
    suppressOutput: false,
    continue: true,
    status: 'error',
  }) + '\n');
}
