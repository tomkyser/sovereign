import { debug } from '../../utils';

// =============================================================================
// PATCH 6: USE_EMBEDDED_TOOLS_FN Gate Resolution (CRITICAL — must run before prompts)
// =============================================================================

export const writeEmbeddedToolsGateResolution = (
  content: string
): string | null => {
  let js = content;
  let changed = false;

  // Pattern 1: Full-name function-call ternaries
  js = js.replace(
    /\$\{USE_EMBEDDED_TOOLS_FN\(\)\?"([^"]*(?:\\.[^"]*)*)"\s*:\s*"([^"]*(?:\\.[^"]*)*)"\}/g,
    (_, antBranch) => {
      changed = true;
      return antBranch.replace(/`/g, '\\`');
    }
  );

  // Pattern 2: Full-name boolean ternaries (find, grep)
  js = js.replace(/\$\{USE_EMBEDDED_TOOLS_FN\?",\s*grep":""\}/g, () => {
    changed = true;
    return ', grep';
  });

  // Pattern 3: Minified function-call ternaries (short grep form)
  js = js.replace(/find\$\{[$\w]+\?",\s*grep":""\}/g, () => {
    changed = true;
    return 'find, grep';
  });

  // Pattern 4: Minified function-call ternaries (longer branches)
  js = js.replace(
    /\$\{[$\w]+\(\)\?"([^"]*(?:\\.[^"]*)*)":\s*"([^"]*(?:\\.[^"]*)*)"\}/g,
    (full, antBranch, extBranch) => {
      const antLower = antBranch.toLowerCase();
      const extLower = extBranch.toLowerCase();
      const isEmbeddedToolsGate =
        antLower.includes('cwd') ||
        antLower.includes('relative') ||
        antLower.includes('cd') ||
        antLower.includes('grep') ||
        extLower.includes('absolute') ||
        extLower.includes('reset');
      if (isEmbeddedToolsGate) {
        changed = true;
        return antBranch.replace(/`/g, '\\`');
      }
      return full;
    }
  );

  // Pattern 5: Minified boolean ternary for grep
  js = js.replace(/\$\{[$\w]+\?",\s*grep":""\}/g, () => {
    changed = true;
    return ', grep';
  });

  if (!changed) return null;

  debug('  resolved USE_EMBEDDED_TOOLS_FN gates');
  return js;
};
