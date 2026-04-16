import { debug } from '../../utils';
import { runDetectors } from './types';

// =============================================================================
// PATCH 10: Tungsten Live Panel — Render Tree Injection
// =============================================================================

const PANEL_INJECTION_SIGNATURE = '__tungsten_panel__';

const PANEL_INJECTION_CODE = [
  '(function(){',
  `var ${PANEL_INJECTION_SIGNATURE}=1;`,
  'try{',
  'if(!globalThis.__tungstenPanel){',
  'var _p=require("node:path").join(',
  'require("node:os").homedir(),".claude-governance","ui","tungsten-panel.js"',
  ');',
  'var _f=require(_p);',
  'if(typeof _f==="function"){',
  'globalThis.__tungstenPanel=_f({R:b_,S:Y_,B:m,T:L})',
  '}',
  '}',
  'if(globalThis.__tungstenPanel){',
  'return b_.createElement(globalThis.__tungstenPanel,null)',
  '}',
  '}catch(_){}',
  'return null',
  '})()',
].join('');

export const writeTungstenPanelInjection = (content: string): string | null => {
  if (content.includes(PANEL_INJECTION_SIGNATURE)) {
    debug('  Tungsten panel: already applied');
    return content;
  }

  const detection = runDetectors(content, [
    {
      name: 'esbuild-flexgrow-function',
      fn: js => {
        // esbuild: function that returns createElement(Component, { flexGrow: 1 })
        const m = js.match(
          /(?:([$\w]+)\.default|([$\w]+))\.createElement\(([$\w]+),\s*\{\s*flexGrow:\s*1\s*\}\)/
        );
        return m
          ? {
              match: m,
              detector: 'esbuild-flexgrow-function',
              confidence: 'high',
            }
          : null;
      },
    },
    {
      name: 'legacy-false-null-before-flexgrow',
      fn: js => {
        const m = js.match(
          /!1,null,[$\w]+\.createElement\([$\w]+,\{flexGrow:\s*1\}\)/
        );
        return m
          ? {
              match: m,
              detector: 'legacy-false-null-before-flexgrow',
              confidence: 'medium',
            }
          : null;
      },
    },
  ]);

  if (!detection) return null;

  const original = detection.match[0];
  let replacement: string;

  if (detection.detector === 'esbuild-flexgrow-function') {
    // esbuild: inject panel code before the flexGrow element
    // Extract React and component variable names from context
    const matchIdx = (detection.match as RegExpMatchArray).index!;
    const ctx = content.substring(Math.max(0, matchIdx - 3000), matchIdx + 500);
    const reactMatch = ctx.match(/([$\w]+(?:\.default)?)\.createElement\(/);
    const boxMatch = ctx.match(/\.createElement\(([$\w]+),\s*\{[\s\S]{0,30}flexDirection/);
    const textMatch = ctx.match(/\.createElement\(([$\w]+),\s*\{[\s\S]{0,20}dimColor/);
    const matchArr = detection.match as RegExpMatchArray;
    // Handle both "VAR.default.createElement" and "VAR.createElement" patterns
    const detectedReact = matchArr[1] ? matchArr[1] + '.default' : matchArr[2];
    const R = reactMatch?.[1] || detectedReact || 'i1';
    const B = boxMatch?.[1] || 'u';
    const T = textMatch?.[1] || 'V';

    // Build panel injection that uses discovered variable names
    const panelCode = [
      '(function(){',
      'var ' + PANEL_INJECTION_SIGNATURE + '=1;',
      'try{',
      'if(!globalThis.__tungstenPanel){',
      'var _p=require("node:path").join(',
      'require("node:os").homedir(),".claude-governance","ui","tungsten-panel.js"',
      ');',
      'var _f=require(_p);',
      'if(typeof _f==="function"){',
      'globalThis.__tungstenPanel=_f({R:' + R + ',B:' + B + ',T:' + T + '})',
      '}',
      '}',
      'if(globalThis.__tungstenPanel){',
      'return ' + R + '.createElement(globalThis.__tungstenPanel,null)',
      '}',
      '}catch(_){}',
      'return null',
      '})()',
    ].join('');

    // Inject panel call before the flexGrow element
    replacement = panelCode + ',' + original;
  } else {
    // Legacy: inject at !1,null position
    replacement = original.replace('!1,null', PANEL_INJECTION_CODE);
  }

  const result = content.replace(original, replacement);
  return result !== content ? result : null;
};
