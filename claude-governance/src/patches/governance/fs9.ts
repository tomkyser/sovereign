import { debug } from '../../utils';
import { runDetectors } from './types';

// =============================================================================
// PATCH 9: Tungsten FS9() — bashProvider tmux Activation
// =============================================================================

const FS9_REPLACEMENT = [
  'function FS9(){',
  'var _e=process.env.__CLAUDE_GOVERNANCE_TMUX_ENV;',
  'return _e||null',
  '}',
].join('');

export const writeTungstenFs9Patch = (content: string): string | null => {
  if (content.includes('__CLAUDE_GOVERNANCE_TMUX_ENV')) {
    debug('  Tungsten FS9: already applied');
    return content;
  }

  const detection = runDetectors(content, [
    {
      name: 'exact-fs9-stub',
      fn: js => {
        const m = js.match(/function FS9\(\)\{return null\}/);
        return m
          ? { match: m, detector: 'exact-fs9-stub', confidence: 'high' }
          : null;
      },
    },
    {
      name: 'pattern-tmux-env-stub',
      fn: js => {
        const m = js.match(
          /function ([$\w]+)\(\)\{return null\}[^]*?;if\(\1\)[$\w]+\.TMUX=\1/
        );
        if (!m) return null;
        const fnName = m[1];
        const stubMatch = js.match(
          new RegExp(
            `function ${fnName.replace(/\$/g, '\\$')}\\(\\)\\{return null\\}`
          )
        );
        return stubMatch
          ? {
              match: stubMatch,
              detector: 'pattern-tmux-env-stub',
              confidence: 'medium',
            }
          : null;
      },
    },
  ]);

  if (!detection) return null;

  const original = detection.match[0];
  const fnNameMatch = original.match(/function ([$\w]+)\(/);
  if (!fnNameMatch) return null;
  const fnName = fnNameMatch[1];

  const replacement =
    fnName === 'FS9' ? FS9_REPLACEMENT : FS9_REPLACEMENT.replace('FS9', fnName);

  const result = content.replace(original, replacement);
  return result !== content ? result : null;
};
