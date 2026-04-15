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
      name: 'dce-render-tree-marker',
      fn: js => {
        const m = js.match(
          /cn7\([$\w]+\)\)\)\),!1,null,[$\w]+\.createElement\([$\w]+,\{flexGrow:1\}\)/
        );
        return m
          ? {
              match: m,
              detector: 'dce-render-tree-marker',
              confidence: 'high',
            }
          : null;
      },
    },
    {
      name: 'false-null-before-flexgrow',
      fn: js => {
        const m = js.match(
          /!1,null,[$\w]+\.createElement\([$\w]+,\{flexGrow:1\}\)/
        );
        return m
          ? {
              match: m,
              detector: 'false-null-before-flexgrow',
              confidence: 'medium',
            }
          : null;
      },
    },
  ]);

  if (!detection) return null;

  const original = detection.match[0];
  const replacement = original.replace('!1,null', PANEL_INJECTION_CODE);
  const result = content.replace(original, replacement);
  return result !== content ? result : null;
};
