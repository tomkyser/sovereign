import { runDetectors } from './types';

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
        return m
          ? { match: m, detector: 'exact-flag-true', confidence: 'high' }
          : null;
      },
    },
    {
      name: 'exact-flag-true-unminified',
      fn: js => {
        const m = js.match(/tengu_slim_subagent_claudemd",\s*true\)/);
        return m
          ? {
              match: m,
              detector: 'exact-flag-true-unminified',
              confidence: 'high',
            }
          : null;
      },
    },
    {
      name: 'flag-name-any-default',
      fn: js => {
        const m = js.match(/tengu_slim_subagent_claudemd"[^)]{0,10}\)/);
        return m
          ? {
              match: m,
              detector: 'flag-name-any-default',
              confidence: 'medium',
            }
          : null;
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
