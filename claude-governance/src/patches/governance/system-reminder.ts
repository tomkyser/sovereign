import { GOVERNANCE_DEFAULTS } from './defaults';
import { runDetectors } from './types';

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
        return m
          ? {
              match: m,
              detector: 'bear-no-relation-clause',
              confidence: 'high',
            }
          : null;
      },
    },
    {
      name: 'exact-full-sentence',
      fn: js => {
        const m = js.match(
          /Tool results and user messages may include <system-reminder> tags[^.]*\.[^.]*bear no direct relation[^.]*\./
        );
        return m
          ? { match: m, detector: 'exact-full-sentence', confidence: 'high' }
          : null;
      },
    },
    {
      name: 'escaped-system-reminder-desc',
      fn: js => {
        const m = js.match(
          /system-reminder>?\s*(?:tags?\s+)?(?:contain|include)[^.]*bear no direct/i
        );
        return m
          ? {
              match: m,
              detector: 'escaped-system-reminder-desc',
              confidence: 'medium',
            }
          : null;
      },
    },
  ]);

  if (!detection) return null;

  if (detection.detector === 'bear-no-relation-clause') {
    const clauseIdx = content.indexOf(detection.match[0]);
    if (clauseIdx === -1) return null;

    const searchStart = Math.max(0, clauseIdx - 300);
    const prefix = content.slice(searchStart, clauseIdx);
    const sentenceStart = prefix.lastIndexOf('Tool results');

    if (sentenceStart !== -1) {
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
