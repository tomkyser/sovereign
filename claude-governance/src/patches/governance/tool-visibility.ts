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
      name: 'esbuild-userFacingName-empty-check',
      fn: js => {
        // esbuild pattern: VAR.userFacingName(void 0) === ""
        const m = js.match(
          /([$\w]+)\.userFacingName\(void 0\)\s*===\s*""/
        );
        return m
          ? {
              match: m,
              detector: 'esbuild-userFacingName-empty-check',
              confidence: 'high' as const,
            }
          : null;
      },
    },
    {
      name: 'empty-name-return-null',
      fn: js => {
        // Legacy Bun minified pattern
        const m = js.match(
          /return ([$\w]+)\}if\(([$\w]+)===""\)return null/
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
        // Legacy Bun minified pattern
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

  let result: string;
  if (detection.detector === 'esbuild-userFacingName-empty-check') {
    // esbuild: replace `VAR.userFacingName(void 0) === ""` with `false`
    // This makes the empty-name check always false, so tools are always visible
    result = content.replace(
      matched,
      'false/*' + TOOL_VISIBILITY_SIGNATURE + '*/'
    );
  } else {
    // Legacy: remove the if(VAR==="")return null
    const emptyCheckIdx = matched.indexOf('if(');
    const prefix = matched.substring(0, emptyCheckIdx);
    result = content.replace(matched, prefix + 'var ' + TOOL_VISIBILITY_SIGNATURE + '=1');
  }

  if (result === content) {
    debug('  tool visibility: replacement produced no change');
    return null;
  }

  debug(`  tool visibility: patched via ${detection.detector}`);
  return result;
};
