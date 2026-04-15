import { runDetectors } from './types';

// =============================================================================
// PATCH 5: isMeta Flag Removal (OPTIONAL)
// =============================================================================

export const writeIsMetaFlagRemoval = (content: string): string | null => {
  const detection = runDetectors(content, [
    {
      name: 'ismeta-after-system-reminder',
      fn: js => {
        const m = js.match(/<\/system-reminder>\s*\\n`,\s*isMeta:\s*!0/);
        return m
          ? {
              match: m,
              detector: 'ismeta-after-system-reminder',
              confidence: 'high',
            }
          : null;
      },
    },
    {
      name: 'ismeta-near-reminder',
      fn: js => {
        const m = js.match(/system-reminder>[^}]{0,30}isMeta:\s*!0/);
        return m
          ? { match: m, detector: 'ismeta-near-reminder', confidence: 'medium' }
          : null;
      },
    },
  ]);

  if (!detection) return null;

  const original = detection.match[0];
  const replacement = original.replace(/isMeta:\s*!0/, 'isMeta:!1');
  const result = content.replace(original, replacement);
  return result !== content ? result : content;
};
