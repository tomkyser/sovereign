import { debug } from '../../utils';
import { runDetectors } from './types';

// =============================================================================
// PATCH 8: REPL Tool Guidance Injection
// =============================================================================

const REPL_GUIDANCE =
  'Before issuing multiple tool calls, ask: could one REPL call do this? REPL executes JavaScript ' +
  'with access to glob, grep, read, write, edit, and bash \\u2014 an entire scan-filter-act pipeline ' +
  'in a single tool call. Three Bash calls that REPL could combine into one means 3x the context ' +
  'consumed and 3x the inference cost. At scale this accelerates compaction and degrades session ' +
  'quality. Use individual tools only for single-file operations and safety-critical edits where ' +
  'diff visibility matters.';

export const writeReplToolGuidance = (content: string): string | null => {
  if (content.includes('could one REPL call do this? REPL executes')) {
    debug('  REPL tool guidance: already applied');
    return content;
  }

  const detection = runDetectors(content, [
    {
      name: 'using-your-tools-array-close',
      fn: js => {
        const m = js.match(
          /sequentially instead\."\]\.filter\(\([$\w]+\)=>[$\w]+!==null\);return\["# Using your tools"/
        );
        return m
          ? {
              match: m,
              detector: 'using-your-tools-array-close',
              confidence: 'high',
            }
          : null;
      },
    },
  ]);

  if (!detection) return null;

  const original = detection.match[0];
  const escapedGuidance = REPL_GUIDANCE.replace(/"/g, '\\"');
  const replacement = original.replace(
    'sequentially instead."]',
    `sequentially instead.","${escapedGuidance}"]`
  );

  const result = content.replace(original, replacement);
  return result !== content ? result : null;
};
