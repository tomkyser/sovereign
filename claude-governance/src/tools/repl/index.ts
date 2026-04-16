import * as vm from 'node:vm';

import { getTimeout } from './config';
import { inputJSONSchema } from './schema';
import { getPrompt } from './prompt';
import { formatResult } from './format';
import {
  getOrCreateVM,
  setCurrentContext,
  resetOperations,
  setSelfRef,
} from './vm';
import type { ToolContext } from './vm';
import * as handlers from './handlers';
import { fetch_url } from './handlers/fetch';

const vmHandlers: Record<string, Function> = {
  read: handlers.read,
  write: handlers.write,
  edit: handlers.edit,
  bash: handlers.bash,
  grep: handlers.grep,
  glob: handlers.glob,
  notebook_edit: handlers.notebook_edit,
  fetch: fetch_url,
  agent: handlers.agent,
};

const tool = {
  name: 'REPL',
  inputJSONSchema,

  renderToolUseMessage(data: { script?: string; description?: string }) {
    const refs = (globalThis as any).__govReactRefs;
    const desc = data?.description || 'executing script';
    if (refs?.R?.createElement && refs?.Text) {
      return refs.R.createElement(
        refs.Text,
        { color: 'cyan' },
        `REPL — ${desc}`
      );
    }
    return `REPL — ${desc}`;
  },

  async prompt() {
    return getPrompt();
  },

  async description() {
    return 'Execute JavaScript with access to file and shell operations. Batch multiple operations in one call.';
  },

  async call(args: { script: string; description?: string }, context: ToolContext) {
    const startTime = Date.now();
    const { script, description } = args;

    setCurrentContext(context);

    const ctx = getOrCreateVM(vmHandlers);

    resetOperations();
    ctx.console.clear();

    let returnValue: unknown;
    let error: unknown;

    try {
      returnValue = vm.runInContext(script, ctx, {
        timeout: getTimeout(),
        filename: 'repl-script.js',
        displayErrors: true,
      });
      if (returnValue && typeof (returnValue as Promise<unknown>).then === 'function') {
        returnValue = await returnValue;
      }
    } catch (syncErr: unknown) {
      const isSyntaxError = syncErr instanceof SyntaxError ||
        (syncErr !== null && typeof syncErr === 'object' && (syncErr as { name?: string }).name === 'SyntaxError');
      const needsWrapping = isSyntaxError && (
        /\bawait\b/.test(script) ||
        /\breturn\b/.test(script)
      );
      if (needsWrapping) {
        try {
          const wrappedScript = `(async () => { ${script} })()`;
          returnValue = await vm.runInContext(wrappedScript, ctx, {
            timeout: getTimeout(),
            filename: 'repl-script.js',
            displayErrors: true,
          });
        } catch (asyncErr) {
          error = asyncErr;
        }
      } else {
        error = syncErr;
      }
    }

    return { data: formatResult(description, startTime, returnValue, error, vmHandlers) };
  },
};

export default tool;

setSelfRef(tool);
