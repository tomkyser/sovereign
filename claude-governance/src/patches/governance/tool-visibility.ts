import { debug } from '../../utils';
import { runDetectors } from './types';

const TOOL_VISIBILITY_SIGNATURE = '__tool_visibility_patched__';

export const writeToolVisibilityPatch = (content: string): string | null => {
  if (content.includes(TOOL_VISIBILITY_SIGNATURE)) {
    debug('  tool visibility: already applied');
    return content;
  }

  const detection = runDetectors(content, [
    {
      name: 'empty-name-return-null',
      fn: js => {
        const m = js.match(
          /return bH\}if\(([$\w]+)===""\)return null/
        );
        return m
          ? {
              match: m,
              detector: 'empty-name-return-null',
              confidence: 'high' as const,
            }
          : null;
      },
    },
    {
      name: 'memo-cache-before-empty-check',
      fn: js => {
        const m = js.match(
          /\[\d+\]=([$\w]+);else \1=[$\w]+\[\d+\];return \1\}if\(([$\w]+)===""\)return null/
        );
        return m
          ? {
              match: m,
              detector: 'memo-cache-before-empty-check',
              confidence: 'medium' as const,
            }
          : null;
      },
    },
  ]);

  if (!detection) return null;

  const matched = detection.match[0];
  const emptyCheckIdx = matched.indexOf('if(');
  const prefix = matched.substring(0, emptyCheckIdx);
  const replacement = prefix + 'var ' + TOOL_VISIBILITY_SIGNATURE + '=1';

  const result = content.replace(matched, replacement);
  if (result === content) {
    debug('  tool visibility: replacement produced no change');
    return null;
  }

  debug(`  tool visibility: patched via ${detection.detector}`);
  return result;
};
