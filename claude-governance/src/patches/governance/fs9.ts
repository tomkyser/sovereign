import { debug } from '../../utils';
import { runDetectors } from './types';

// =============================================================================
// PATCH 9: Tungsten FS9() — bashProvider tmux Activation
// =============================================================================
//
// The FS9/TQ4 function returns a TMUX socket string for the shell environment.
// By default it returns null (or assembles from internal state). Our patch
// replaces it to read from __CLAUDE_GOVERNANCE_TMUX_ENV, allowing Tungsten
// to inject tmux session info into the shell environment.

const PATCH_SIGNATURE = '__CLAUDE_GOVERNANCE_TMUX_ENV';

export const writeTungstenFs9Patch = (content: string): string | null => {
  if (content.includes(PATCH_SIGNATURE)) {
    debug('  Tungsten FS9: already applied');
    return content;
  }

  const detection = runDetectors(content, [
    {
      name: 'exact-fs9-stub',
      fn: js => {
        // Legacy: exact stub function
        const m = js.match(/function FS9\(\)\{return null\}/);
        return m
          ? { match: m, detector: 'exact-fs9-stub', confidence: 'high' as const }
          : null;
      },
    },
    {
      name: 'esbuild-tmux-socket-fn',
      fn: js => {
        // esbuild: function that returns template string for tmux socket
        // function TQ4() { if (!GQ4 || fQ4 === null) return null; return `${...}`; }
        // Key: find the function whose return value is assigned to TMUX
        const tmuxAssign = js.match(
          /([$\w]+)\s*=\s*([$\w]+)\(\)[\s\S]{0,30}\.([$\w]+)\.TMUX\s*=\s*\2/
        );
        if (!tmuxAssign) return null;
        const fnName = tmuxAssign[2];
        // Now find this function's definition
        const fnDef = js.match(
          new RegExp(
            'function\\s+' + fnName.replace(/\$/g, '\\\\$') + '\\(\\)\\s*\\{[^}]+\\}'
          )
        );
        if (!fnDef) return null;
        return {
          match: fnDef,
          detector: 'esbuild-tmux-socket-fn',
          confidence: 'high' as const,
        };
      },
    },
    {
      name: 'esbuild-tmux-direct-search',
      fn: js => {
        // Direct search: find function near .TMUX assignment
        const tmuxIdx = js.indexOf('.TMUX =');
        if (tmuxIdx === -1) return null;
        // Search backward for the function call pattern: VAR = FN()
        const before = js.substring(Math.max(0, tmuxIdx - 500), tmuxIdx);
        const callMatch = before.match(/([$\w]+)\s*=\s*([$\w]+)\(\)/g);
        if (!callMatch) return null;
        // The last call before .TMUX is the FS9-equivalent
        const lastCall = callMatch[callMatch.length - 1];
        const fnNameMatch = lastCall.match(/([$\w]+)\s*=\s*([$\w]+)\(\)/);
        if (!fnNameMatch) return null;
        const fnName = fnNameMatch[2];
        // Find this function definition
        const escapedName = fnName.replace(/\$/g, '\\$');
        const defRegex = new RegExp(
          'function\\s+' + escapedName + '\\(\\)\\s*\\{[\\s\\S]*?\\n\\}'
        );
        const fnDef = js.match(defRegex);
        if (!fnDef) return null;
        return {
          match: fnDef,
          detector: 'esbuild-tmux-direct-search',
          confidence: 'medium' as const,
        };
      },
    },
    {
      name: 'pattern-tmux-env-stub',
      fn: js => {
        // Legacy: pattern-based search for return-null function used with TMUX
        const m = js.match(
          /function ([$\w]+)\(\)\{return null\}[^]*?;if\(\1\)[$\w]+\.TMUX=\1/
        );
        if (!m) return null;
        const fnName = m[1];
        const stubMatch = js.match(
          new RegExp(
            `function ${fnName.replace(/\\$/g, '\\\\$')}\\(\\)\\{return null\\}`
          )
        );
        return stubMatch
          ? {
              match: stubMatch,
              detector: 'pattern-tmux-env-stub',
              confidence: 'medium' as const,
            }
          : null;
      },
    },
  ]);

  if (!detection) return null;

  const original = detection.match[0];
  const fnNameMatch = original.match(/function\s+([$\w]+)\(/);
  if (!fnNameMatch) return null;
  const fnName = fnNameMatch[1];

  const replacement = [
    'function ' + fnName + '(){',
    'var _e=process.env.' + PATCH_SIGNATURE + ';',
    'return _e||null',
    '}',
  ].join('');

  const result = content.replace(original, replacement);
  return result !== content ? result : null;
};
