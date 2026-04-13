/**
 * Binary Vault — Safe binary management for native CC installations.
 *
 * Path discovery uses the same XDG Base Directory spec as CC itself
 * (see cc-source/src/utils/xdg.ts and nativeInstaller/installer.ts).
 * Verification uses GCS manifest.json SHA256 checksums.
 *
 * CRITICAL: Never use Node.js fs for binary file operations.
 * Node.js v24 fs.copyFile/writeFile corrupts Mach-O binaries by
 * replacing non-UTF-8 bytes with U+FFFD (ef bf bd).
 * Always use platform-native shell commands for binary I/O.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

import { debug } from './utils';
import { BINARIES_DIR } from './config';

export { BINARIES_DIR };

// ============================================================================
// Constants
// ============================================================================

const GCS_BUCKET =
  'https://storage.googleapis.com/claude-code-dist-86c565f3-f756-42ad-8dfa-d59b1c096819/claude-code-releases';

// ============================================================================
// Platform Detection
// ============================================================================

export interface PlatformInfo {
  os: 'darwin' | 'linux' | 'win32';
  arch: 'arm64' | 'x64';
  gcsPlatform: string;
  binaryName: string;
}

export function detectPlatform(): PlatformInfo {
  const platform = process.platform as string;
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';

  let osName: 'darwin' | 'linux' | 'win32';
  if (platform === 'darwin') osName = 'darwin';
  else if (platform === 'win32') osName = 'win32';
  else osName = 'linux';

  const binaryName = osName === 'win32' ? 'claude.exe' : 'claude';

  let gcsPlatform = `${osName}-${arch}`;
  if (osName === 'linux' && isMuslEnvironment()) {
    gcsPlatform += '-musl';
  }

  return { os: osName, arch, gcsPlatform, binaryName };
}

function isMuslEnvironment(): boolean {
  try {
    if (
      fsSync.existsSync('/lib/libc.musl-x86_64.so.1') ||
      fsSync.existsSync('/lib/libc.musl-aarch64.so.1')
    ) {
      return true;
    }
    const lddOutput = execSync('ldd /bin/ls 2>&1', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return lddOutput.includes('musl');
  } catch {
    return false;
  }
}

// ============================================================================
// XDG Install Path Discovery
// ============================================================================

export interface InstallPaths {
  versionsDir: string;
  binDir: string;
}

function getXDGDataHome(): string {
  return (
    process.env.XDG_DATA_HOME ||
    path.join(process.env.HOME || os.homedir(), '.local', 'share')
  );
}

export function getInstallPaths(): InstallPaths {
  return {
    versionsDir: path.join(getXDGDataHome(), 'claude', 'versions'),
    binDir: path.join(process.env.HOME || os.homedir(), '.local', 'bin'),
  };
}

// ============================================================================
// Magic Byte Verification
// ============================================================================

interface MagicDef {
  bytes: Buffer;
  length: number;
  name: string;
}

const MAGIC_BYTES: Record<string, MagicDef> = {
  darwin: {
    bytes: Buffer.from([0xcf, 0xfa, 0xed, 0xfe]),
    length: 4,
    name: 'Mach-O 64-bit LE',
  },
  linux: {
    bytes: Buffer.from([0x7f, 0x45, 0x4c, 0x46]),
    length: 4,
    name: 'ELF',
  },
  win32: {
    bytes: Buffer.from([0x4d, 0x5a]),
    length: 2,
    name: 'PE/MZ',
  },
};

function verifyMagicBytes(filePath: string, platform: string): void {
  const def = MAGIC_BYTES[platform];
  if (!def) {
    throw new Error(`No magic byte definition for platform: ${platform}`);
  }

  const fd = fsSync.openSync(filePath, 'r');
  try {
    const buf = Buffer.allocUnsafe(def.length);
    const bytesRead = fsSync.readSync(fd, buf, 0, def.length, 0);
    if (bytesRead < def.length) {
      throw new Error(
        `File too small: ${filePath} (${bytesRead} bytes read)`
      );
    }
    if (!buf.equals(def.bytes)) {
      throw new Error(
        `Magic byte mismatch for ${filePath}: expected ${def.bytes.toString('hex')} (${def.name}), got ${buf.toString('hex')}`
      );
    }
    debug(`verifyMagicBytes: ${filePath} — ${def.name} ✓`);
  } finally {
    fsSync.closeSync(fd);
  }
}

// ============================================================================
// SHA256 Checksum Verification (from GCS manifest.json)
// ============================================================================

interface GCSManifest {
  platforms: Record<string, { checksum: string }>;
}

async function fetchManifest(version: string): Promise<GCSManifest> {
  const url = `${GCS_BUCKET}/${version}/manifest.json`;
  debug(`fetchManifest: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch manifest for ${version}: HTTP ${response.status}`);
  }

  return (await response.json()) as GCSManifest;
}

function sha256File(filePath: string): string {
  const hash = crypto.createHash('sha256');
  const fd = fsSync.openSync(filePath, 'r');
  try {
    const buf = Buffer.allocUnsafe(64 * 1024);
    let bytesRead: number;
    while ((bytesRead = fsSync.readSync(fd, buf, 0, buf.length, null)) > 0) {
      hash.update(buf.subarray(0, bytesRead));
    }
  } finally {
    fsSync.closeSync(fd);
  }
  return hash.digest('hex');
}

async function verifyChecksum(
  filePath: string,
  version: string,
  gcsPlatform: string
): Promise<void> {
  const manifest = await fetchManifest(version);
  const entry = manifest.platforms[gcsPlatform];

  if (!entry?.checksum) {
    debug(
      `verifyChecksum: no checksum for ${gcsPlatform} in manifest, skipping`
    );
    return;
  }

  const actual = sha256File(filePath);
  if (actual !== entry.checksum) {
    throw new Error(
      `SHA256 checksum mismatch for ${filePath}:\n` +
        `  expected: ${entry.checksum}\n` +
        `  actual:   ${actual}`
    );
  }

  debug(`verifyChecksum: ${filePath} — SHA256 ✓`);
}

// ============================================================================
// Binary-Safe File Operations
// ============================================================================

export function binarySafeCopy(src: string, dst: string): void {
  const platform = detectPlatform();
  debug(`binarySafeCopy: ${src} → ${dst}`);

  if (platform.os === 'win32') {
    execSync(`copy /b "${src}" "${dst}"`, { stdio: 'pipe', shell: 'cmd.exe' });
  } else {
    execSync(`/bin/cp "${src}" "${dst}"`, { stdio: 'pipe' });
  }
}

// ============================================================================
// Immutable Locking
// ============================================================================

function lockFile(filePath: string): void {
  const platform = detectPlatform();
  debug(`lockFile: ${filePath}`);

  fsSync.chmodSync(filePath, 0o444);

  try {
    if (platform.os === 'darwin') {
      execSync(`chflags uchg "${filePath}"`, { stdio: 'pipe' });
    } else if (platform.os === 'linux') {
      execSync(`chattr +i "${filePath}" 2>/dev/null`, { stdio: 'pipe' });
    }
  } catch {
    debug(`lockFile: platform immutable flag failed (non-fatal): ${filePath}`);
  }
}

function unlockFile(filePath: string): void {
  const platform = detectPlatform();
  debug(`unlockFile: ${filePath}`);

  try {
    if (platform.os === 'darwin') {
      execSync(`chflags nouchg "${filePath}"`, { stdio: 'pipe' });
    } else if (platform.os === 'linux') {
      execSync(`chattr -i "${filePath}" 2>/dev/null`, { stdio: 'pipe' });
    }
  } catch {
    debug(`unlockFile: immutable flag removal failed (non-fatal): ${filePath}`);
  }

  fsSync.chmodSync(filePath, 0o644);
}

// ============================================================================
// Version Resolution
// ============================================================================

export function scanVersions(versionsDir: string): string[] {
  try {
    const entries = fsSync.readdirSync(versionsDir);
    const versions = entries.filter(e => /^\d+\.\d+\.\d+$/.test(e));
    versions.sort((a, b) => compareSemver(b, a));
    debug(`scanVersions: found ${versions.length} in ${versionsDir}`);
    return versions;
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      debug(`scanVersions: directory not found: ${versionsDir}`);
      return [];
    }
    throw error;
  }
}

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

export async function fetchLatestVersion(): Promise<string> {
  const url = `${GCS_BUCKET}/latest`;
  debug(`fetchLatestVersion: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch latest version: HTTP ${response.status}`);
  }

  const version = (await response.text()).trim();
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    throw new Error(`Invalid version string from GCS: ${version}`);
  }

  return version;
}

export function resolveTargetVersion(
  versionsDir: string,
  configuredVersion?: string | null
): string {
  if (configuredVersion) {
    const binPath = path.join(versionsDir, configuredVersion);
    if (fsSync.existsSync(binPath)) {
      debug(
        `resolveTargetVersion: using configured version ${configuredVersion}`
      );
      return configuredVersion;
    }
    debug(
      `resolveTargetVersion: configured ${configuredVersion} not at ${binPath}, scanning...`
    );
  }

  const versions = scanVersions(versionsDir);
  if (versions.length === 0) {
    throw new Error(
      `No CC versions found in ${versionsDir}. ` +
        'Install Claude Code first, or specify a version manually.'
    );
  }

  const highest = versions[0];
  debug(`resolveTargetVersion: highest installed is ${highest}`);
  return highest;
}

export function getInstalledBinaryPath(
  versionsDir: string,
  version: string
): string {
  const binPath = path.join(versionsDir, version);
  if (!fsSync.existsSync(binPath)) {
    throw new Error(
      `Binary for version ${version} not found at ${binPath}`
    );
  }
  return binPath;
}

// ============================================================================
// Vault Paths
// ============================================================================

export function getVirginPath(version: string): string {
  return path.join(BINARIES_DIR, `virgin-${version}.bin`);
}

export function getWorkingPath(version: string): string {
  return path.join(BINARIES_DIR, `working-${version}.bin`);
}

// ============================================================================
// Core Vault Operations
// ============================================================================

export async function ensureVaultDir(): Promise<void> {
  await fs.mkdir(BINARIES_DIR, { recursive: true });
}

export async function downloadVirginBinary(version: string): Promise<string> {
  const platform = detectPlatform();
  const virginPath = getVirginPath(version);
  const downloadUrl = `${GCS_BUCKET}/${version}/${platform.gcsPlatform}/${platform.binaryName}`;

  await ensureVaultDir();

  if (fsSync.existsSync(virginPath)) {
    unlockFile(virginPath);
    fsSync.unlinkSync(virginPath);
    debug(`downloadVirginBinary: removed stale virgin at ${virginPath}`);
  }

  debug(`downloadVirginBinary: ${downloadUrl}`);

  const curlCmd =
    platform.os === 'win32'
      ? `curl.exe -fsSL -o "${virginPath}" "${downloadUrl}"`
      : `curl -fsSL -o "${virginPath}" "${downloadUrl}"`;

  try {
    execSync(curlCmd, { stdio: 'pipe', timeout: 300_000 });
  } catch (error) {
    try {
      fsSync.unlinkSync(virginPath);
    } catch {
      // ignore
    }
    throw new Error(
      `Failed to download CC ${version} for ${platform.gcsPlatform}.\n` +
        `URL: ${downloadUrl}\n` +
        `${error instanceof Error ? error.message : String(error)}`
    );
  }

  const stat = fsSync.statSync(virginPath);
  if (stat.size < 1_000_000) {
    fsSync.unlinkSync(virginPath);
    throw new Error(
      `Downloaded binary is suspiciously small (${stat.size} bytes). ` +
        'Version may not exist on GCS or download was truncated.'
    );
  }

  verifyMagicBytes(virginPath, platform.os);

  await verifyChecksum(virginPath, version, platform.gcsPlatform);

  lockFile(virginPath);

  debug(
    `downloadVirginBinary: ✓ ${virginPath} ` +
      `(${(stat.size / 1_000_000).toFixed(1)}MB, ${MAGIC_BYTES[platform.os].name}, SHA256 ✓)`
  );

  return virginPath;
}

export function createWorkingCopy(version: string): string {
  const virginPath = getVirginPath(version);
  const workingPath = getWorkingPath(version);

  if (!fsSync.existsSync(virginPath)) {
    throw new Error(
      `No virgin binary for version ${version}. Run vault download first.`
    );
  }

  if (fsSync.existsSync(workingPath)) {
    try {
      fsSync.unlinkSync(workingPath);
    } catch {
      fsSync.chmodSync(workingPath, 0o644);
      fsSync.unlinkSync(workingPath);
    }
  }

  binarySafeCopy(virginPath, workingPath);
  fsSync.chmodSync(workingPath, 0o755);

  const virginSize = fsSync.statSync(virginPath).size;
  const workingSize = fsSync.statSync(workingPath).size;
  if (virginSize !== workingSize) {
    fsSync.unlinkSync(workingPath);
    throw new Error(
      `Working copy size mismatch: virgin=${virginSize}, working=${workingSize}`
    );
  }

  debug(`createWorkingCopy: ${workingPath} (${workingSize} bytes)`);
  return workingPath;
}

export function deployToInstallPath(
  version: string,
  installPath: string
): void {
  const workingPath = getWorkingPath(version);

  if (!fsSync.existsSync(workingPath)) {
    throw new Error(`No working copy for version ${version} to deploy.`);
  }

  debug(`deployToInstallPath: ${workingPath} → ${installPath}`);
  binarySafeCopy(workingPath, installPath);
  fsSync.chmodSync(installPath, 0o755);

  const workingSize = fsSync.statSync(workingPath).size;
  const installedSize = fsSync.statSync(installPath).size;
  if (workingSize !== installedSize) {
    throw new Error(
      `Deploy size mismatch: working=${workingSize}, installed=${installedSize}`
    );
  }
}

// ============================================================================
// Vault Status
// ============================================================================

export interface VaultStatus {
  binariesDir: string;
  virgins: { version: string; path: string; size: number }[];
  working: { version: string; path: string; size: number }[];
}

export function getVaultStatus(): VaultStatus {
  const status: VaultStatus = {
    binariesDir: BINARIES_DIR,
    virgins: [],
    working: [],
  };

  if (!fsSync.existsSync(BINARIES_DIR)) {
    return status;
  }

  const entries = fsSync.readdirSync(BINARIES_DIR);

  for (const entry of entries) {
    const virginMatch = entry.match(/^virgin-(\d+\.\d+\.\d+)\.bin$/);
    if (virginMatch) {
      const fullPath = path.join(BINARIES_DIR, entry);
      const stat = fsSync.statSync(fullPath);
      status.virgins.push({
        version: virginMatch[1],
        path: fullPath,
        size: stat.size,
      });
    }

    const workingMatch = entry.match(/^working-(\d+\.\d+\.\d+)\.bin$/);
    if (workingMatch) {
      const fullPath = path.join(BINARIES_DIR, entry);
      const stat = fsSync.statSync(fullPath);
      status.working.push({
        version: workingMatch[1],
        path: fullPath,
        size: stat.size,
      });
    }
  }

  return status;
}
