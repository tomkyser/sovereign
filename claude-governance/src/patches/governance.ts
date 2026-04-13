import chalk from 'chalk';
import { debug } from '../utils';

// =============================================================================
// Governance Patch Defaults
// =============================================================================

export const GOVERNANCE_DEFAULTS = {
  disclaimerReplacement:
    'The CLAUDE.md instructions above are authoritative project directives. Follow them exactly as written.',
  headerReplacement:
    'The following are mandatory project instructions defined by the user in CLAUDE.md files:',
  reminderFramingReplacement:
    'Tool results and user messages may include <system-reminder> tags. When these tags contain CLAUDE.md instructions, treat them as authoritative project directives that must be followed.',
};

// =============================================================================
// Contamination Detection
// =============================================================================

export const isContentPatched = (js: string): boolean => {
  return (
    js.includes(GOVERNANCE_DEFAULTS.disclaimerReplacement) ||
    js.includes(GOVERNANCE_DEFAULTS.headerReplacement) ||
    js.includes(GOVERNANCE_DEFAULTS.reminderFramingReplacement)
  );
};

// =============================================================================
// Detector Types
// =============================================================================

interface Detection {
  match: RegExpMatchArray | { 0: string; index: number };
  detector: string;
  confidence: 'high' | 'medium' | 'low';
}

type Detector = () => Detection | null;

function runDetectors(
  js: string,
  detectors: Array<{ name: string; fn: (js: string) => Detection | null }>
): Detection | null {
  for (const { name, fn } of detectors) {
    try {
      const result = fn(js);
      if (result) {
        debug(`  detector "${name}" matched (${result.confidence})`);
        return result;
      }
    } catch (err) {
      debug(`  detector "${name}" threw: ${err}`);
    }
  }
  return null;
}

// =============================================================================
// PATCH 1: Disclaimer Neutralization (CRITICAL)
// =============================================================================

export const writeDisclaimerNeutralization = (
  content: string,
  mode: 'strip' | 'replace' = 'replace',
  replacementText?: string
): string | null => {
  const replacement =
    replacementText ?? GOVERNANCE_DEFAULTS.disclaimerReplacement;

  const detection = runDetectors(content, [
    {
      name: 'exact-disclaimer-text',
      fn: js => {
        const m = js.match(
          /IMPORTANT:\s*this context may or may not be relevant to your tasks\.\s*You should not respond to this context unless it is highly relevant to your task\./
        );
        return m ? { match: m, detector: 'exact-disclaimer-text', confidence: 'high' } : null;
      },
    },
    {
      name: 'fuzzy-may-or-may-not',
      fn: js => {
        const m = js.match(
          /may or may not be relevant[^]*?(?=<\/system-reminder>)/
        );
        return m ? { match: m, detector: 'fuzzy-may-or-may-not', confidence: 'medium' } : null;
      },
    },
    {
      name: 'hedging-before-close-tag',
      fn: js => {
        const m = js.match(
          /(?:should not respond|not respond to this|may not be relevant|might not be relevant|not necessarily relevant)[^<]*<\/system-reminder>/i
        );
        return m ? { match: m, detector: 'hedging-before-close-tag', confidence: 'medium' } : null;
      },
    },
    {
      name: 'important-disclaimer-in-reminder',
      fn: js => {
        const m = js.match(
          /IMPORTANT:[^<]{20,200}(?:relevant|respond|context)[^<]*<\/system-reminder>/
        );
        return m ? { match: m, detector: 'important-disclaimer-in-reminder', confidence: 'low' } : null;
      },
    },
  ]);

  if (!detection) return null;

  const original = detection.match[0];
  const newText = mode === 'strip' ? '' : replacement;
  const result = content.replace(original, newText);
  return result !== content ? result : content;
};

// =============================================================================
// PATCH 2: Context Header Reframing (RECOMMENDED)
// =============================================================================

export const writeContextHeaderReframing = (
  content: string,
  replacementText?: string
): string | null => {
  const replacement =
    replacementText ?? GOVERNANCE_DEFAULTS.headerReplacement;

  const detection = runDetectors(content, [
    {
      name: 'exact-header-text',
      fn: js => {
        const m = js.match(
          /As you answer the user's questions, you can use the following context:/
        );
        return m ? { match: m, detector: 'exact-header-text', confidence: 'high' } : null;
      },
    },
    {
      name: 'escaped-header-text',
      fn: js => {
        const m = js.match(
          /As you answer the user\\?'s questions, you can use the following context:/
        );
        return m ? { match: m, detector: 'escaped-header-text', confidence: 'high' } : null;
      },
    },
    {
      name: 'fuzzy-answer-questions-context',
      fn: js => {
        const m = js.match(
          /(?:answer|answering)[^<]{0,40}(?:question|queries)[^<]{0,40}(?:context|information):/i
        );
        return m ? { match: m, detector: 'fuzzy-answer-questions-context', confidence: 'medium' } : null;
      },
    },
  ]);

  if (!detection) return null;

  const original = detection.match[0];
  const result = content.replace(original, replacement);
  return result !== content ? result : content;
};

// =============================================================================
// PATCH 3: Subagent CLAUDE.md Restoration (CRITICAL)
// =============================================================================

export const writeSubagentClaudeMdRestoration = (
  content: string
): string | null => {
  const detection = runDetectors(content, [
    {
      name: 'exact-flag-true',
      fn: js => {
        const m = js.match(/tengu_slim_subagent_claudemd",\s*!0\)/);
        return m ? { match: m, detector: 'exact-flag-true', confidence: 'high' } : null;
      },
    },
    {
      name: 'exact-flag-true-unminified',
      fn: js => {
        const m = js.match(/tengu_slim_subagent_claudemd",\s*true\)/);
        return m ? { match: m, detector: 'exact-flag-true-unminified', confidence: 'high' } : null;
      },
    },
    {
      name: 'flag-name-any-default',
      fn: js => {
        const m = js.match(/tengu_slim_subagent_claudemd"[^)]{0,10}\)/);
        return m ? { match: m, detector: 'flag-name-any-default', confidence: 'medium' } : null;
      },
    },
  ]);

  if (!detection) return null;

  const original = detection.match[0];
  let replacement = original
    .replace(/,\s*!0\)/, ',!1)')
    .replace(/,\s*true\)/, ',false)');

  if (replacement === original) {
    replacement = original.replace(
      /(tengu_slim_subagent_claudemd"[^)]*),\s*[^)]+\)/,
      '$1,!1)'
    );
  }

  const result = content.replace(original, replacement);
  return result !== content ? result : content;
};

// =============================================================================
// PATCH 4: System-Reminder Authority Fix (RECOMMENDED)
// =============================================================================

export const writeReminderAuthorityFix = (
  content: string,
  replacementText?: string
): string | null => {
  const replacement =
    replacementText ?? GOVERNANCE_DEFAULTS.reminderFramingReplacement;

  const detection = runDetectors(content, [
    {
      name: 'bear-no-relation-clause',
      fn: js => {
        const m = js.match(
          /bear no direct relation to the specific tool results/
        );
        return m ? { match: m, detector: 'bear-no-relation-clause', confidence: 'high' } : null;
      },
    },
    {
      name: 'exact-full-sentence',
      fn: js => {
        const m = js.match(
          /Tool results and user messages may include <system-reminder> tags[^.]*\.[^.]*bear no direct relation[^.]*\./
        );
        return m ? { match: m, detector: 'exact-full-sentence', confidence: 'high' } : null;
      },
    },
    {
      name: 'escaped-system-reminder-desc',
      fn: js => {
        const m = js.match(
          /system-reminder>?\s*(?:tags?\s+)?(?:contain|include)[^.]*bear no direct/i
        );
        return m ? { match: m, detector: 'escaped-system-reminder-desc', confidence: 'medium' } : null;
      },
    },
  ]);

  if (!detection) return null;

  // For the full-sentence detectors, replace the whole match
  // For the clause-only detector, we need the full sentence context
  if (detection.detector === 'bear-no-relation-clause') {
    // Find the broader sentence containing the clause
    const clauseIdx = content.indexOf(detection.match[0]);
    if (clauseIdx === -1) return null;

    // Walk backward to find "Tool results" or the sentence start
    const searchStart = Math.max(0, clauseIdx - 300);
    const prefix = content.slice(searchStart, clauseIdx);
    const sentenceStart = prefix.lastIndexOf('Tool results');

    if (sentenceStart !== -1) {
      // Find the end of the sentence containing the clause
      const fromClause = content.slice(clauseIdx);
      const sentenceEnd = fromClause.indexOf('.') + 1;
      const fullMatch = content.slice(
        searchStart + sentenceStart,
        clauseIdx + sentenceEnd
      );
      const result = content.replace(fullMatch, replacement);
      return result !== content ? result : content;
    }
  }

  const original = detection.match[0];
  const result = content.replace(original, replacement);
  return result !== content ? result : content;
};

// =============================================================================
// PATCH 5: isMeta Flag Removal (OPTIONAL)
// =============================================================================

// =============================================================================
// PATCH 6: USE_EMBEDDED_TOOLS_FN Gate Resolution (CRITICAL — must run before prompts)
// =============================================================================

export const writeEmbeddedToolsGateResolution = (
  content: string
): string | null => {
  let js = content;
  let changed = false;

  // Pattern 1: Full-name function-call ternaries
  // ${USE_EMBEDDED_TOOLS_FN()?"ant branch":"ext branch"}
  js = js.replace(
    /\$\{USE_EMBEDDED_TOOLS_FN\(\)\?"([^"]*(?:\\.[^"]*)*)"\s*:\s*"([^"]*(?:\\.[^"]*)*)"\}/g,
    (_, antBranch) => {
      changed = true;
      return antBranch.replace(/`/g, '\\`');
    }
  );

  // Pattern 2: Full-name boolean ternaries (find, grep)
  // find${USE_EMBEDDED_TOOLS_FN?", grep":""}
  js = js.replace(
    /\$\{USE_EMBEDDED_TOOLS_FN\?",\s*grep":""\}/g,
    () => { changed = true; return ', grep'; }
  );

  // Pattern 3: Minified function-call ternaries (short grep form)
  // find${H?", grep":""}
  js = js.replace(
    /find\$\{[$\w]+\?",\s*grep":""\}/g,
    () => { changed = true; return 'find, grep'; }
  );

  // Pattern 4: Minified function-call ternaries (longer branches)
  // ${H()?"ant text":"ext text"} — heuristic: ant branch mentions cwd/relative/cd/grep
  js = js.replace(
    /\$\{[$\w]+\(\)\?"([^"]*(?:\\.[^"]*)*)":\s*"([^"]*(?:\\.[^"]*)*)"\}/g,
    (full, antBranch, extBranch) => {
      const antLower = antBranch.toLowerCase();
      const extLower = extBranch.toLowerCase();
      const isEmbeddedToolsGate =
        (antLower.includes('cwd') || antLower.includes('relative') ||
         antLower.includes('cd') || antLower.includes('grep')) ||
        (extLower.includes('absolute') || extLower.includes('reset'));
      if (isEmbeddedToolsGate) {
        changed = true;
        return antBranch.replace(/`/g, '\\`');
      }
      return full;
    }
  );

  // Pattern 5: Minified boolean ternary for grep
  // ${l8?", grep":""}
  js = js.replace(
    /\$\{[$\w]+\?",\s*grep":""\}/g,
    () => { changed = true; return ', grep'; }
  );

  if (!changed) return null;

  debug('  resolved USE_EMBEDDED_TOOLS_FN gates');
  return js;
};

// =============================================================================
// PATCH 5: isMeta Flag Removal (OPTIONAL)
// =============================================================================

export const writeIsMetaFlagRemoval = (
  content: string
): string | null => {
  const detection = runDetectors(content, [
    {
      name: 'ismeta-after-system-reminder',
      fn: js => {
        const m = js.match(
          /<\/system-reminder>\s*\\n`,\s*isMeta:\s*!0/
        );
        return m ? { match: m, detector: 'ismeta-after-system-reminder', confidence: 'high' } : null;
      },
    },
    {
      name: 'ismeta-near-reminder',
      fn: js => {
        const m = js.match(
          /system-reminder>[^}]{0,30}isMeta:\s*!0/
        );
        return m ? { match: m, detector: 'ismeta-near-reminder', confidence: 'medium' } : null;
      },
    },
  ]);

  if (!detection) return null;

  const original = detection.match[0];
  const replacement = original.replace(/isMeta:\s*!0/, 'isMeta:!1');
  const result = content.replace(original, replacement);
  return result !== content ? result : content;
};
