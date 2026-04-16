import { inputJSONSchema } from './schema';
import { getPrompt } from './prompt';
import { setCurrentContext } from './state';
import type { TungstenContext } from './state';
import { handleCreate } from './actions/create';
import { handleSend } from './actions/send';
import { handleCapture } from './actions/capture';
import { handleList } from './actions/list';
import { handleKill } from './actions/kill';
import { handleInterrupt } from './actions/interrupt';

interface TungstenArgs {
  action: string;
  command?: string;
  session?: string;
  lines?: number;
}

export default {
  name: 'Tungsten',
  inputJSONSchema,

  renderToolUseMessage(data: { action?: string; session?: string; command?: string }) {
    const refs = (globalThis as any).__govReactRefs;
    const action = data?.action || 'unknown';
    const session = data?.session || 'main';
    const detail = data?.command ? `: ${data.command.substring(0, 60)}` : '';
    const label = `Tungsten ${action} [${session}]${detail}`;
    if (refs?.R?.createElement && refs?.Text) {
      return refs.R.createElement(refs.Text, { color: 'yellow' }, label);
    }
    return label;
  },

  async prompt() {
    return getPrompt();
  },

  async description() {
    return 'Persistent terminal session \u2014 environment, working directory, and processes survive between calls';
  },

  async call(args: TungstenArgs, context: TungstenContext) {
    setCurrentContext(context);

    switch (args.action) {
      case 'create':    return handleCreate(args);
      case 'send':      return handleSend(args);
      case 'capture':   return handleCapture(args);
      case 'list':      return handleList();
      case 'kill':      return handleKill(args);
      case 'interrupt': return handleInterrupt(args);
      default:
        throw new Error(
          `Unknown action "${args.action}". ` +
          'Valid actions: send, capture, create, list, kill, interrupt'
        );
    }
  },
};
