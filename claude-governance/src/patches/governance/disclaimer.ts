import { GOVERNANCE_DEFAULTS } from './defaults';
import { runDetectors } from './types';

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
        return m
          ? { match: m, detector: 'exact-disclaimer-text', confidence: 'high' }
          : null;
      },
    },
    {
      name: 'fuzzy-may-or-may-not',
      fn: js => {
        const m = js.match(
          /may or may not be relevant[^]*?(?=<\/system-reminder>)/
        );
        return m
          ? { match: m, detector: 'fuzzy-may-or-may-not', confidence: 'medium' }
          : null;
      },
    },
    {
      name: 'hedging-before-close-tag',
      fn: js => {
        const m = js.match(
          /(?:should not respond|not respond to this|may not be relevant|might not be relevant|not necessarily relevant)[^<]*<\/system-reminder>/i
        );
        return m
          ? {
              match: m,
              detector: 'hedging-before-close-tag',
              confidence: 'medium',
            }
          : null;
      },
    },
    {
      name: 'important-disclaimer-in-reminder',
      fn: js => {
        const m = js.match(
          /IMPORTANT:[^<]{20,200}(?:relevant|respond|context)[^<]*<\/system-reminder>/
        );
        return m
          ? {
              match: m,
              detector: 'important-disclaimer-in-reminder',
              confidence: 'low',
            }
          : null;
      },
    },
  ]);

  if (!detection) return null;

  const original = detection.match[0];
  const newText = mode === 'strip' ? '' : replacement;
  const result = content.replace(original, newText);
  return result !== content ? result : content;
};
