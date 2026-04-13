import { CONFIG_DIR } from './config';
import type { VerificationEntry } from './patches/governance';

// =============================================================================
// Types
// =============================================================================

export interface CheckResult {
  id: string;
  name: string;
  pass: boolean;
  critical: boolean;
  details?: string;
}

export interface VerificationState {
  timestamp: string;
  governanceVersion: string;
  ccVersion?: string;
  binaryPath: string;
  status: string;
  checks: Array<{
    id: string;
    name: string;
    pass: boolean;
    critical: boolean;
    details?: string;
  }>;
  passCount: number;
  totalCount: number;
}

// =============================================================================
// Verification Engine
// =============================================================================

export function matchEntry(
  js: string,
  pattern: string | RegExp | undefined,
): boolean {
  if (!pattern) return false;
  return typeof pattern === 'string' ? js.includes(pattern) : pattern.test(js);
}

export function runVerification(
  js: string,
  registry: VerificationEntry[],
): CheckResult[] {
  const results: CheckResult[] = [];

  for (const entry of registry) {
    const hasSig = entry.signature ? matchEntry(js, entry.signature) : true;
    const hasAntiSig = entry.antiSignature
      ? matchEntry(js, entry.antiSignature)
      : false;

    const pass = hasSig && !hasAntiSig;

    let details: string;
    if (pass) {
      details = entry.passDetail ?? 'active';
    } else if (!hasSig && entry.signature) {
      details = 'replacement text not found';
    } else if (hasAntiSig && hasSig) {
      details = 'replacement present but original also found';
    } else if (hasAntiSig && entry.category === 'gate') {
      const count = typeof entry.antiSignature === 'string'
        ? (js.match(new RegExp(entry.antiSignature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length
        : 0;
      details = `${count} unresolved ${entry.antiSignature} references`;
    } else if (hasAntiSig) {
      details = 'original text still present';
    } else {
      details = 'not found';
    }

    results.push({
      id: entry.id,
      name: entry.name,
      pass,
      critical: entry.critical,
      details,
    });
  }

  return results;
}

// =============================================================================
// State Persistence
// =============================================================================

export async function readVerificationState(): Promise<VerificationState | null> {
  const fsP = await import('node:fs/promises');
  const pathM = await import('node:path');
  const statePath = pathM.join(CONFIG_DIR, 'state.json');
  try {
    const raw = await fsP.readFile(statePath, 'utf8');
    return JSON.parse(raw) as VerificationState;
  } catch {
    return null;
  }
}

export async function writeVerificationState(
  results: CheckResult[],
  status: string,
  binaryPath: string,
  ccVersion?: string,
): Promise<void> {
  const fsP = await import('node:fs/promises');
  const pathM = await import('node:path');

  const stateDir = CONFIG_DIR;
  await fsP.mkdir(stateDir, { recursive: true });

  const state: VerificationState = {
    timestamp: new Date().toISOString(),
    governanceVersion: '0.1.0',
    ccVersion,
    binaryPath,
    status,
    checks: results.map(r => ({
      id: r.id,
      name: r.name,
      pass: r.pass,
      critical: r.critical,
      details: r.details,
    })),
    passCount: results.filter(r => r.pass).length,
    totalCount: results.length,
  };

  const statePath = pathM.join(stateDir, 'state.json');
  await fsP.writeFile(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

export function deriveStatus(
  results: CheckResult[],
): 'SOVEREIGN' | 'DEGRADED' | 'PARTIAL' {
  const failing = results.filter(r => !r.pass);
  const criticalFail = failing.filter(r => r.critical);
  if (failing.length === 0) return 'SOVEREIGN';
  if (criticalFail.length > 0) return 'DEGRADED';
  return 'PARTIAL';
}
