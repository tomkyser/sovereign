/**
 * Installation Detection Utilities
 *
 * Functions for finding Claude Code installations on the system.
 */

import {
  collectCandidates,
  findClaudeCodeInstallation,
  getPendingCandidates,
  resolvePathToInstallationType,
  extractVersion,
} from '../installationDetection';
import { readConfigFile, CONFIG_FILE } from '../config';
import { InstallationCandidate, ClaudeCodeInstallationInfo } from '../types';
import { Installation } from './types';

// ============================================================================
// Type Conversion Helpers
// ============================================================================

/**
 * Convert internal InstallationCandidate to public Installation type.
 */
function candidateToInstallation(
  candidate: InstallationCandidate
): Installation {
  return {
    path: candidate.path,
    version: candidate.version,
    kind: candidate.kind === 'npm-based' ? 'npm' : 'native',
  };
}

/**
 * Convert internal ClaudeCodeInstallationInfo to public Installation type.
 */
function infoToInstallation(info: ClaudeCodeInstallationInfo): Installation {
  const path = info.cliPath ?? info.nativeInstallationPath;
  if (!path) {
    throw new Error(
      'Installation info has neither cliPath nor nativeInstallationPath'
    );
  }
  return {
    path,
    version: info.version,
    kind: info.cliPath ? 'npm' : 'native',
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Find all Claude Code installations on the system by searching in PATH and
 * common install locations.
 */
export async function findAllInstallations(): Promise<Installation[]> {
  const candidates = await collectCandidates();
  return candidates.map(candidateToInstallation);
}

/**
 * Options for tryDetectInstallation()
 */
export interface DetectInstallationOptions {
  /** Explicit path to Claude Code - skips auto-detection */
  path?: string;
  /** Show interactive picker UI if multiple installations found (default: false) */
  interactive?: boolean;
}

/**
 * Attempts to detect the user's preferred Claude Code installation.  Detection procedure:
 * 0. options.path
 * 1. Uses $TWEAKCC_CC_INSTALLATION_PATH if set.
 * 2. Uses ccInstallationPath in tweakcc config.
 * 3. Discovers installation from `claude` in PATH
 * 4. Looks in hard-coded search paths:
 *   a. If the search yields one installation, uses it
 *   b. If it yields multiple and options.interactive is true, display a picker
 *      via showInteractiveInstallationPicker().
 * @returns The selected installation.
 * @throws If user cancels via Esc.
 */
export async function tryDetectInstallation(
  options: DetectInstallationOptions = {}
): Promise<Installation> {
  // If explicit path provided, resolve it directly
  if (options.path) {
    const resolved = await resolvePathToInstallationType(options.path);
    if (!resolved) {
      throw new Error(
        `Unable to detect installation type from path '${options.path}'. ` +
          `Expected a Claude Code cli.js file or native binary.\n`
      );
    }

    // Use the shared version extraction function
    const version = await extractVersion(resolved.resolvedPath, resolved.kind);

    return {
      path: resolved.resolvedPath,
      version,
      kind: resolved.kind === 'npm-based' ? 'npm' : 'native',
    };
  }

  // Always pass interactive: true to the internal function so it returns
  // candidates instead of throwing. We handle the decision ourselves.
  const config = await readConfigFile();
  const info = await findClaudeCodeInstallation(config, {
    interactive: true,
  });

  if (!info) {
    throw new Error(
      'Could not find Claude Code installation. ' +
        'Install Claude Code or specify the path explicitly.'
    );
  }

  // Check if we got pending candidates (multiple found)
  const pendingCandidates = getPendingCandidates(info);
  if (pendingCandidates) {
    if (!options.interactive) {
      const list = pendingCandidates
        .map(c => `  • ${c.path} (${c.kind}, v${c.version})`)
        .join('\n');
      throw new Error(
        `Multiple Claude Code installations found:\n${list}\n\n` +
          `Pass { interactive: true } to show a picker, or { path: "..." } to specify explicitly.\n` +
          `Alternatively, set "ccInstallationPath" in ${CONFIG_FILE} to the path to a Claude Code installation.`
      );
    }

    // Show picker UI
    const selected = await showInteractiveInstallationPicker(
      pendingCandidates.map(candidateToInstallation)
    );
    if (!selected) {
      throw new Error('No installation selected.');
    }
    return selected;
  }

  return infoToInstallation(info);
}

/**
 * Lists found installations and throws — no interactive picker in governance CLI.
 * Users should set CLAUDE_GOVERNANCE_CC_PATH or ccInstallationPath in config.
 */
export async function showInteractiveInstallationPicker(
  candidates: Installation[]
): Promise<Installation | null> {
  const list = candidates
    .map(c => `  - ${c.path} (${c.kind}, v${c.version})`)
    .join('\n');
  throw new Error(
    `Multiple Claude Code installations found:\n${list}\n\n` +
      `Set CLAUDE_GOVERNANCE_CC_PATH or "ccInstallationPath" in config to specify which to use.`
  );
}
