import { debug } from '../../utils';

const EXACT_OLD_BLOCK =
  'if(!z()||!w()?.accessToken)' +
  'si([...ew(),...T.map((Y)=>({...Y,dev:!0}))]),WT_(!0);' +
  'else{let{DevChannelsDialog:Y}=await Promise.resolve()' +
  '.then(() => (rt7(),nt7));await WZ(H,(D)=>lD.default' +
  '.createElement(Y,{channels:T,onAccept:()=>{si([...ew()' +
  ',...T.map((f)=>({...f,dev:!0}))]),WT_(!0),D()}}))}';

const REPLACEMENT =
  'si([...ew(),...T.map((Y)=>({...Y,dev:!0}))]),WT_(!0)' +
  '/*__channel_dialog_bypassed__*/';

export const writeChannelDialogBypass = (content: string): string | null => {
  if (content.includes('__channel_dialog_bypassed__')) {
    debug('  Channel dialog bypass: already applied');
    return content;
  }

  if (!content.includes('DevChannelsDialog')) {
    debug('  Channel dialog bypass: DevChannelsDialog not found');
    return null;
  }

  const idx = content.indexOf(EXACT_OLD_BLOCK);
  if (idx !== -1) {
    debug('  Channel dialog bypass: exact match found');
    return content.replace(EXACT_OLD_BLOCK, REPLACEMENT);
  }

  debug('  Channel dialog bypass: exact match failed');
  return null;
};
