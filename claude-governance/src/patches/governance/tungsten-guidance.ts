import { debug } from '../../utils';
import { runDetectors } from './types';

// =============================================================================
// PATCH 11: Tungsten Tool Guidance Injection
// =============================================================================

const TUNGSTEN_GUIDANCE =
  'A Tungsten session is established at the start of every work session. ' +
  'Once active, all Bash and REPL commands automatically operate within this persistent ' +
  'context via FS9 \\u2014 environment variables, working directory, and running processes ' +
  'survive between tool calls. Use Tungsten send to modify session state and start ' +
  'long-running processes. Kill the session when your work is complete.';

const TUNGSTEN_GUIDANCE_SIGNATURE =
  'Tungsten session is established at the start of every work session';

const TUNGSTEN_GUIDANCE_V1_MARKER =
  'use Tungsten instead of Bash. Tungsten retains';

export const writeTungstenToolGuidance = (content: string): string | null => {
  if (content.includes(TUNGSTEN_GUIDANCE_SIGNATURE)) {
    debug('  Tungsten tool guidance: already applied');
    return content;
  }

  if (content.includes(TUNGSTEN_GUIDANCE_V1_MARKER)) {
    debug('  Tungsten tool guidance: upgrading from v1');
    const oldPattern = /,"For stateful shell work[^"]*spawned agents\."/;
    const escapedGuidance = TUNGSTEN_GUIDANCE.replace(/"/g, '\\"');
    const result = content.replace(oldPattern, `,"${escapedGuidance}"`);
    return result !== content ? result : null;
  }

  const detection = runDetectors(content, [
    {
      name: 'post-repl-array-close',
      fn: js => {
        const m = js.match(
          /diff visibility matters\."\]\.filter\(\([$\w]+\)=>[$\w]+!==null\);return\["# Using your tools"/
        );
        return m
          ? {
              match: m,
              detector: 'post-repl-array-close',
              confidence: 'high',
            }
          : null;
      },
    },
  ]);

  if (!detection) return null;

  const original = detection.match[0];
  const escapedGuidance = TUNGSTEN_GUIDANCE.replace(/"/g, '\\"');
  const replacement = original.replace(
    'diff visibility matters."]',
    `diff visibility matters.","${escapedGuidance}"]`
  );

  const result = content.replace(original, replacement);
  return result !== content ? result : null;
};
