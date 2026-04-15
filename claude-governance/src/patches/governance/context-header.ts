import { GOVERNANCE_DEFAULTS } from './defaults';
import { runDetectors } from './types';

// =============================================================================
// PATCH 2: Context Header Reframing (RECOMMENDED)
// =============================================================================

export const writeContextHeaderReframing = (
  content: string,
  replacementText?: string
): string | null => {
  const replacement = replacementText ?? GOVERNANCE_DEFAULTS.headerReplacement;

  const detection = runDetectors(content, [
    {
      name: 'exact-header-text',
      fn: js => {
        const m = js.match(
          /As you answer the user's questions, you can use the following context:/
        );
        return m
          ? { match: m, detector: 'exact-header-text', confidence: 'high' }
          : null;
      },
    },
    {
      name: 'escaped-header-text',
      fn: js => {
        const m = js.match(
          /As you answer the user\\?'s questions, you can use the following context:/
        );
        return m
          ? { match: m, detector: 'escaped-header-text', confidence: 'high' }
          : null;
      },
    },
    {
      name: 'fuzzy-answer-questions-context',
      fn: js => {
        const m = js.match(
          /(?:answer|answering)[^<]{0,40}(?:question|queries)[^<]{0,40}(?:context|information):/i
        );
        return m
          ? {
              match: m,
              detector: 'fuzzy-answer-questions-context',
              confidence: 'medium',
            }
          : null;
      },
    },
  ]);

  if (!detection) return null;

  const original = detection.match[0];
  const result = content.replace(original, replacement);
  return result !== content ? result : content;
};
