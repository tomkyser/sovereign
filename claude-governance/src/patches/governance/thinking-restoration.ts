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
          /([$\w]+)\.subtype==="thinking"\)return null;if\(\1\.subtype==="bridge_status"\)/
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
          /([$\w]+)\.subtype==="thinking"\)return null/
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

  const inlineRenderer = [
    msgVar + '.subtype==="thinking"){',
    'var ' + THINKING_DISPATCH_SIGNATURE + '=1;',
    'if(' + msgVar + '.content){',
    'var _thM=' + msgVar + '.content.length>500?',
    msgVar + '.content.substring(0,500)+"\\u2026":' + msgVar + '.content;',
    'var _thJ=K===void 0?0:K?1:0;',
    'return r6.createElement(m,{flexDirection:"column",gap:1,marginTop:_thJ,width:"100%"},',
    'r6.createElement(L,{dimColor:!0,italic:!0},"\\u2234 Thinking\\u2026"),',
    'r6.createElement(m,{paddingLeft:2},r6.createElement(L,{dimColor:!0},_thM)));',
    '}return null',
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
          /if\(!\(([$\w]+)\|\|([$\w]+)\)\)\{let ([$\w]+)=([$\w]+)\?1:0/
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

  const v1 = (detection.match as RegExpMatchArray)[1];
  const v2 = (detection.match as RegExpMatchArray)[2];
  const guard = 'if(!(' + v1 + '||' + v2 + '))';
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
          /case"thinking":\{if\(!([$\w]+)&&!([$\w]+)\)return null/
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

  const v1 = (detection.match as RegExpMatchArray)[1];
  const v2 = (detection.match as RegExpMatchArray)[2];
  const oldGuard = 'if(!' + v1 + '&&!' + v2 + ')return null';
  const newGuard = 'var ' + SIGNATURE + '=1';

  const result = content.replace(
    'case"thinking":{' + oldGuard,
    'case"thinking":{' + newGuard
  );

  if (result === content) {
    debug('  thinking assist guard: replacement produced no change');
    return null;
  }

  debug(`  thinking assist guard: patched via ${detection.detector}`);
  return result;
};
