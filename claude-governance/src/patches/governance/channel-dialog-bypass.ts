import { debug } from '../../utils';

// =============================================================================
// PATCH 13: Channel Dialog Bypass — auto-accepts dev channel for OAuth users
// =============================================================================

const BYPASS_SIGNATURE = '__channel_dialog_bypassed__';

export const writeChannelDialogBypass = (content: string): string | null => {
  if (content.includes(BYPASS_SIGNATURE)) {
    debug('  Channel dialog bypass: already applied');
    return content;
  }

  if (!content.includes('DevChannelsDialog')) {
    debug('  Channel dialog bypass: DevChannelsDialog not found');
    return null;
  }

  // Strategy 1: esbuild pattern — match ONLY the inner if/else (not the outer block)
  // The code structure is:
  //   if (A && A.length > 0) {
  //     let [...] = await Promise.all([...]);
  //     if (!isChannelsEnabled() || !getTokens()?.accessToken) accept_code;
  //     else { ...DevChannelsDialog... }    ← we match and replace this line
  //   }                                     ← we do NOT consume this
  // We replace ONLY "if (!...)... else {...}" with "accept_code/*sig*/"
  // The regex must NOT capture the outer if-block's closing brace.
  const innerMatch = content.match(
    /if\s*\(![$\w]+\(\)\s*\|\|\s*![$\w]+\(\)\?\.accessToken\)\s*([\s\S]+?);\s*else\s*\{\s*\n?\s*let\s*\{\s*DevChannelsDialog[\s\S]*?\}\)\);\s*\}/
  );

  if (innerMatch) {
    debug('  Channel dialog bypass: esbuild inner match found');
    const acceptCode = innerMatch[1];
    const replacement = acceptCode + '/*' + BYPASS_SIGNATURE + '*/';
    const result = content.replace(innerMatch[0], replacement);
    if (result !== content) {
      debug('  Channel dialog bypass: esbuild block replaced');
      return result;
    }
  }

  // Strategy 2: Bun minified exact block (legacy fallback)
  const EXACT_OLD_BLOCK =
    'if(!z()||!w()?.accessToken)' +
    'si([...ew(),...T.map((Y)=>({...Y,dev:!0}))]),WT_(!0);' +
    'else{let{DevChannelsDialog:Y}=await Promise.resolve()' +
    '.then(() => (rt7(),nt7));await WZ(H,(D)=>lD.default' +
    '.createElement(Y,{channels:T,onAccept:()=>{si([...ew()' +
    ',...T.map((f)=>({...f,dev:!0}))]),WT_(!0),D()}}))}';

  const LEGACY_REPLACEMENT =
    'si([...ew(),...T.map((Y)=>({...Y,dev:!0}))]),WT_(!0)' +
    '/*' + BYPASS_SIGNATURE + '*/';

  const legacyIdx = content.indexOf(EXACT_OLD_BLOCK);
  if (legacyIdx !== -1) {
    debug('  Channel dialog bypass: legacy exact match found');
    return content.replace(EXACT_OLD_BLOCK, LEGACY_REPLACEMENT);
  }

  debug('  Channel dialog bypass: no match found');
  return null;
};
