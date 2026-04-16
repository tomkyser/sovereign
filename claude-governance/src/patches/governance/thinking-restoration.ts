import { debug } from '../../utils';
import { runDetectors } from './types';

const THINKING_DISPATCH_SIGNATURE = '__thinking_dispatch_patched__';
const THINKING_FULLSHOW_SIGNATURE = '__thinking_fullshow_patched__';

export const writeThinkingDispatchPatch = (content: string): string | null => {
  if (content.includes(THINKING_DISPATCH_SIGNATURE)) {
    debug('  thinking dispatch: already applied');
    return content;
  }

  const detection = runDetectors(content, [
    {
      name: 'subtype-thinking-return-null',
      fn: js => {
        const m = js.match(
          /([$\w]+)\.subtype\s*===\s*"thinking"\)\s*return\s+null;\s*if\s*\(\1\.subtype\s*===\s*"bridge_status"\)/
        );
        return m
          ? {
              match: m,
              detector: 'subtype-thinking-return-null',
              confidence: 'high' as const,
            }
          : null;
      },
    },
    {
      name: 'subtype-thinking-null-general',
      fn: js => {
        const m = js.match(
          /([$\w]+)\.subtype\s*===\s*"thinking"\)\s*return\s+null/
        );
        return m
          ? {
              match: m,
              detector: 'subtype-thinking-null-general',
              confidence: 'medium' as const,
            }
          : null;
      },
    },
  ]);

  if (!detection) return null;

  const matched = detection.match[0];
  const msgVar = (detection.match as RegExpMatchArray)[1];

  // Extract React/Box/Text variable names from surrounding context
  const matchIdx = (detection.match as RegExpMatchArray).index!;
  const ctx = content.substring(Math.max(0, matchIdx - 3000), matchIdx + 1000);
  const reactMatch = ctx.match(/([$\w]+)\.createElement\(/);
  const boxMatch = ctx.match(/\.createElement\(([$\w]+),\s*\{[\s\S]{0,30}flexDirection/);
  const textMatch = ctx.match(/\.createElement\(([$\w]+),\s*\{[\s\S]{0,30}dimColor/);
  const addMarginMatch = ctx.match(/addMargin:\s*([$\w]+)/);
  const R = reactMatch?.[1] || 'r6';
  const B = boxMatch?.[1] || 'm';
  const T = textMatch?.[1] || 'L';
  const AM = addMarginMatch?.[1] || 'K';

  const inlineRenderer = [
    msgVar + '.subtype==="thinking"){',
    'var ' + THINKING_DISPATCH_SIGNATURE + '=1;',
    'if(' + msgVar + '.content){',
    'var _thM=' + msgVar + '.content.length>500?',
    msgVar + '.content.substring(0,500)+"\\u2026":' + msgVar + '.content;',
    'var _thJ=' + AM + '===void 0?0:' + AM + '?1:0;',
    'return ' + R + '.createElement(' + B + ',{flexDirection:"column",gap:1,marginTop:_thJ,width:"100%"},',
    R + '.createElement(' + T + ',{dimColor:!0,italic:!0},"\\u2234 Thinking\\u2026"),',
    R + '.createElement(' + B + ',{paddingLeft:2},' + R + '.createElement(' + T + ',{dimColor:!0},_thM)));',
    '}return null}',
  ].join('');

  let suffix = '';
  if (detection.detector === 'subtype-thinking-return-null') {
    suffix = ';if(' + msgVar + '.subtype==="bridge_status")';
  }

  const replacement = inlineRenderer + suffix;
  const result = content.replace(matched, replacement);

  if (result === content) {
    debug('  thinking dispatch: replacement produced no change');
    return null;
  }

  debug(`  thinking dispatch: patched via ${detection.detector}`);
  return result;
};

export const writeThinkingFullShowPatch = (content: string): string | null => {
  if (content.includes(THINKING_FULLSHOW_SIGNATURE)) {
    debug('  thinking fullshow: already applied');
    return content;
  }

  const detection = runDetectors(content, [
    {
      name: 'verbose-guard-with-stub',
      fn: js => {
        const m = js.match(
          /if\s*\(!\(([$\w]+)\s*\|\|\s*([$\w]+)\)\)\s*\{\s*\n?\s*let\s+([$\w]+)\s*=\s*([$\w]+)\s*\?\s*1\s*:\s*0/
        );
        return m
          ? {
              match: m,
              detector: 'verbose-guard-with-stub',
              confidence: 'high' as const,
            }
          : null;
      },
    },
  ]);

  if (!detection) return null;

  const matched = detection.match[0];
  // Extract the guard portion (everything up to the opening brace)
  const guardMatch = matched.match(/if\s*\(!\([$\w]+\s*\|\|\s*[$\w]+\)\)/);
  if (!guardMatch) return null;
  const guard = guardMatch[0];
  const newGuard =
    'if(!1/*' + THINKING_FULLSHOW_SIGNATURE + '*/)';

  const result = content.replace(guard, newGuard);
  if (result === content) {
    debug('  thinking fullshow: replacement produced no change');
    return null;
  }

  debug(`  thinking fullshow: patched via ${detection.detector}`);
  return result;
};

export const writeThinkingAssistantGuardPatch = (
  content: string
): string | null => {
  const SIGNATURE = '__thinking_assist_guard_patched__';
  if (content.includes(SIGNATURE)) {
    debug('  thinking assist guard: already applied');
    return content;
  }

  const detection = runDetectors(content, [
    {
      name: 'case-thinking-verbose-guard',
      fn: js => {
        const m = js.match(
          /case\s*"thinking"\s*:\s*\{\s*\n?\s*if\s*\(!([$\w]+)\s*&&\s*!([$\w]+)\)\s*return\s+null/
        );
        return m
          ? {
              match: m,
              detector: 'case-thinking-verbose-guard',
              confidence: 'high' as const,
            }
          : null;
      },
    },
  ]);

  if (!detection) return null;

  const matched = detection.match[0];
  // Extract the guard: if(!V1 && !V2) return null  (with possible whitespace)
  const guardMatch = matched.match(/if\s*\(![$\w]+\s*&&\s*![$\w]+\)\s*return\s+null/);
  if (!guardMatch) return null;
  const newGuard = 'var ' + SIGNATURE + '=1';

  const result = content.replace(matched, matched.replace(guardMatch[0], newGuard));

  if (result === content) {
    debug('  thinking assist guard: replacement produced no change');
    return null;
  }

  debug(`  thinking assist guard: patched via ${detection.detector}`);
  return result;
};
