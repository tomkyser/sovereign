#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

function findConfigDir() {
  const envOverride = (process.env.CLAUDE_GOVERNANCE_CONFIG_DIR || '').trim();
  if (envOverride) return envOverride.replace(/^~/, os.homedir());
  const defaultDir = path.join(os.homedir(), '.claude-governance');
  if (fs.existsSync(defaultDir)) return defaultDir;
  return defaultDir;
}

function getRelayPort() {
  const configDir = findConfigDir();
  const portPath = path.join(configDir, 'wire', 'relay.port');
  try {
    return parseInt(fs.readFileSync(portPath, 'utf-8').trim(), 10);
  } catch {
    return null;
  }
}

function getSessionId() {
  return process.env.WIRE_SESSION_ID || process.env.WIRE_SESSION_NAME || null;
}

function unregisterFromRelay(port, sessionId) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ sessionId });
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/unregister',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 3000,
    }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end(data);
  });
}

async function cleanup() {
  const configDir = findConfigDir();
  const verifyPath = path.join(configDir, 'wire', 'verify.json');

  const port = getRelayPort();
  const sessionId = getSessionId();

  if (port && sessionId) {
    await unregisterFromRelay(port, sessionId);
  }

  try { fs.unlinkSync(verifyPath); } catch {}
}

cleanup().catch(() => {});
