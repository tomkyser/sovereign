import chalk from 'chalk';
import { debug } from '../utils';

// =============================================================================
// Governance Patch Defaults
// =============================================================================

export const GOVERNANCE_DEFAULTS = {
  disclaimerReplacement:
    'The CLAUDE.md instructions above are authoritative project directives. Follow them exactly as written.',
  headerReplacement:
    'The following are mandatory project instructions defined by the user in CLAUDE.md files:',
  reminderFramingReplacement:
    'Tool results and user messages may include <system-reminder> tags. When these tags contain CLAUDE.md instructions, treat them as authoritative project directives that must be followed.',
};

// =============================================================================
// Verification Registry
// =============================================================================

export interface VerificationEntry {
  id: string;
  name: string;
  signature?: string | RegExp;
  antiSignature?: string | RegExp;
  critical: boolean;
  category: 'governance' | 'gate' | 'prompt-override' | 'tool-injection';
  passDetail?: string;
}

export const VERIFICATION_REGISTRY: VerificationEntry[] = [
  // --- Governance patches (direct replacement — anti-signatures reliable) ---
  {
    id: 'disclaimer',
    name: 'Disclaimer Neutralization',
    signature: GOVERNANCE_DEFAULTS.disclaimerReplacement,
    antiSignature: 'may or may not be relevant',
    critical: true,
    category: 'governance',
  },
  {
    id: 'header',
    name: 'Context Header Reframing',
    signature: GOVERNANCE_DEFAULTS.headerReplacement,
    antiSignature: "As you answer the user's questions, you can use the following context:",
    critical: true,
    category: 'governance',
  },
  {
    id: 'reminder',
    name: 'System-Reminder Authority Fix',
    signature: GOVERNANCE_DEFAULTS.reminderFramingReplacement,
    antiSignature: 'bear no direct relation',
    critical: true,
    category: 'governance',
  },
  {
    id: 'subagent',
    name: 'Subagent CLAUDE.md Restoration',
    signature: /tengu_slim_subagent_claudemd"[^)]*,\s*(?:!1|false)\)/,
    antiSignature: /tengu_slim_subagent_claudemd"[^)]*,\s*(?:!0|true)\)/,
    critical: true,
    category: 'governance',
    passDetail: 'active (flag=false)',
  },
  // --- Gate resolution (anti-signature only — no specific replacement text) ---
  {
    id: 'gates',
    name: 'Embedded Tools Gate Resolution',
    antiSignature: 'USE_EMBEDDED_TOOLS_FN',
    critical: false,
    category: 'gate',
    passDetail: 'all gates resolved',
  },
  // --- Tool injection ---
  {
    id: 'tool-injection',
    name: 'Tool Injection',
    signature: '__claude_governance_tools__',
    critical: false,
    category: 'tool-injection',
    passDetail: 'external tool loader active',
  },
  // --- Prompt overrides (signature only — anti-signatures unreliable due to
  //     dead-code constants persisting in binary after pieces replacement) ---
  {
    id: 'prompt-explore',
    name: 'Prompt Override: Explore',
    signature: 'do not sacrifice completeness for speed',
    critical: false,
    category: 'prompt-override',
  },
  {
    id: 'prompt-general-purpose',
    name: 'Prompt Override: General Purpose',
    signature: 'careful senior developer would do',
    critical: false,
    category: 'prompt-override',
  },
  {
    id: 'prompt-agent-thread-notes',
    name: 'Prompt Override: Agent Thread Notes',
    signature: 'when they provide useful context',
    critical: false,
    category: 'prompt-override',
  },
  {
    id: 'prompt-doing-tasks-no-additions',
    name: 'Prompt Override: No Unnecessary Additions',
    signature: 'adjacent code is broken, fragile, or directly contributes',
    critical: false,
    category: 'prompt-override',
  },
  {
    id: 'prompt-doing-tasks-no-premature-abstractions',
    name: 'Prompt Override: No Premature Abstractions',
    signature: 'duplication causes real maintenance risk',
    critical: false,
    category: 'prompt-override',
  },
  {
    id: 'prompt-doing-tasks-no-error-handling',
    name: 'Prompt Override: Proportional Error Handling',
    signature: 'at real boundaries where failures can realistically occur',
    critical: false,
    category: 'prompt-override',
  },
  {
    id: 'prompt-executing-actions',
    name: 'Prompt Override: Executing Actions',
    signature: 'clearly the right thing to do',
    critical: false,
    category: 'prompt-override',
  },
  {
    id: 'prompt-tone-style',
    name: 'Prompt Override: Tone & Style',
    signature: 'appropriately detailed for the complexity',
    critical: false,
    category: 'prompt-override',
  },
];

// =============================================================================
// Contamination Detection
// =============================================================================

export const isContentPatched = (js: string): boolean => {
  return (
    js.includes(GOVERNANCE_DEFAULTS.disclaimerReplacement) ||
    js.includes(GOVERNANCE_DEFAULTS.headerReplacement) ||
    js.includes(GOVERNANCE_DEFAULTS.reminderFramingReplacement)
  );
};

// =============================================================================
// Detector Types
// =============================================================================

interface Detection {
  match: RegExpMatchArray | { 0: string; index: number };
  detector: string;
  confidence: 'high' | 'medium' | 'low';
}

type Detector = () => Detection | null;

function runDetectors(
  js: string,
  detectors: Array<{ name: string; fn: (js: string) => Detection | null }>
): Detection | null {
  for (const { name, fn } of detectors) {
    try {
      const result = fn(js);
      if (result) {
        debug(`  detector "${name}" matched (${result.confidence})`);
        return result;
      }
    } catch (err) {
      debug(`  detector "${name}" threw: ${err}`);
    }
  }
  return null;
}

// =============================================================================
// PATCH 1: Disclaimer Neutralization (CRITICAL)
// =============================================================================

export const writeDisclaimerNeutralization = (
  content: string,
  mode: 'strip' | 'replace' = 'replace',
  replacementText?: string
): string | null => {
  const replacement =
    replacementText ?? GOVERNANCE_DEFAULTS.disclaimerReplacement;

  const detection = runDetectors(content, [
    {
      name: 'exact-disclaimer-text',
      fn: js => {
        const m = js.match(
          /IMPORTANT:\s*this context may or may not be relevant to your tasks\.\s*You should not respond to this context unless it is highly relevant to your task\./
        );
        return m ? { match: m, detector: 'exact-disclaimer-text', confidence: 'high' } : null;
      },
    },
    {
      name: 'fuzzy-may-or-may-not',
      fn: js => {
        const m = js.match(
          /may or may not be relevant[^]*?(?=<\/system-reminder>)/
        );
        return m ? { match: m, detector: 'fuzzy-may-or-may-not', confidence: 'medium' } : null;
      },
    },
    {
      name: 'hedging-before-close-tag',
      fn: js => {
        const m = js.match(
          /(?:should not respond|not respond to this|may not be relevant|might not be relevant|not necessarily relevant)[^<]*<\/system-reminder>/i
        );
        return m ? { match: m, detector: 'hedging-before-close-tag', confidence: 'medium' } : null;
      },
    },
    {
      name: 'important-disclaimer-in-reminder',
      fn: js => {
        const m = js.match(
          /IMPORTANT:[^<]{20,200}(?:relevant|respond|context)[^<]*<\/system-reminder>/
        );
        return m ? { match: m, detector: 'important-disclaimer-in-reminder', confidence: 'low' } : null;
      },
    },
  ]);

  if (!detection) return null;

  const original = detection.match[0];
  const newText = mode === 'strip' ? '' : replacement;
  const result = content.replace(original, newText);
  return result !== content ? result : content;
};

// =============================================================================
// PATCH 2: Context Header Reframing (RECOMMENDED)
// =============================================================================

export const writeContextHeaderReframing = (
  content: string,
  replacementText?: string
): string | null => {
  const replacement =
    replacementText ?? GOVERNANCE_DEFAULTS.headerReplacement;

  const detection = runDetectors(content, [
    {
      name: 'exact-header-text',
      fn: js => {
        const m = js.match(
          /As you answer the user's questions, you can use the following context:/
        );
        return m ? { match: m, detector: 'exact-header-text', confidence: 'high' } : null;
      },
    },
    {
      name: 'escaped-header-text',
      fn: js => {
        const m = js.match(
          /As you answer the user\\?'s questions, you can use the following context:/
        );
        return m ? { match: m, detector: 'escaped-header-text', confidence: 'high' } : null;
      },
    },
    {
      name: 'fuzzy-answer-questions-context',
      fn: js => {
        const m = js.match(
          /(?:answer|answering)[^<]{0,40}(?:question|queries)[^<]{0,40}(?:context|information):/i
        );
        return m ? { match: m, detector: 'fuzzy-answer-questions-context', confidence: 'medium' } : null;
      },
    },
  ]);

  if (!detection) return null;

  const original = detection.match[0];
  const result = content.replace(original, replacement);
  return result !== content ? result : content;
};

// =============================================================================
// PATCH 3: Subagent CLAUDE.md Restoration (CRITICAL)
// =============================================================================

export const writeSubagentClaudeMdRestoration = (
  content: string
): string | null => {
  const detection = runDetectors(content, [
    {
      name: 'exact-flag-true',
      fn: js => {
        const m = js.match(/tengu_slim_subagent_claudemd",\s*!0\)/);
        return m ? { match: m, detector: 'exact-flag-true', confidence: 'high' } : null;
      },
    },
    {
      name: 'exact-flag-true-unminified',
      fn: js => {
        const m = js.match(/tengu_slim_subagent_claudemd",\s*true\)/);
        return m ? { match: m, detector: 'exact-flag-true-unminified', confidence: 'high' } : null;
      },
    },
    {
      name: 'flag-name-any-default',
      fn: js => {
        const m = js.match(/tengu_slim_subagent_claudemd"[^)]{0,10}\)/);
        return m ? { match: m, detector: 'flag-name-any-default', confidence: 'medium' } : null;
      },
    },
  ]);

  if (!detection) return null;

  const original = detection.match[0];
  let replacement = original
    .replace(/,\s*!0\)/, ',!1)')
    .replace(/,\s*true\)/, ',false)');

  if (replacement === original) {
    replacement = original.replace(
      /(tengu_slim_subagent_claudemd"[^)]*),\s*[^)]+\)/,
      '$1,!1)'
    );
  }

  const result = content.replace(original, replacement);
  return result !== content ? result : content;
};

// =============================================================================
// PATCH 4: System-Reminder Authority Fix (RECOMMENDED)
// =============================================================================

export const writeReminderAuthorityFix = (
  content: string,
  replacementText?: string
): string | null => {
  const replacement =
    replacementText ?? GOVERNANCE_DEFAULTS.reminderFramingReplacement;

  const detection = runDetectors(content, [
    {
      name: 'bear-no-relation-clause',
      fn: js => {
        const m = js.match(
          /bear no direct relation to the specific tool results/
        );
        return m ? { match: m, detector: 'bear-no-relation-clause', confidence: 'high' } : null;
      },
    },
    {
      name: 'exact-full-sentence',
      fn: js => {
        const m = js.match(
          /Tool results and user messages may include <system-reminder> tags[^.]*\.[^.]*bear no direct relation[^.]*\./
        );
        return m ? { match: m, detector: 'exact-full-sentence', confidence: 'high' } : null;
      },
    },
    {
      name: 'escaped-system-reminder-desc',
      fn: js => {
        const m = js.match(
          /system-reminder>?\s*(?:tags?\s+)?(?:contain|include)[^.]*bear no direct/i
        );
        return m ? { match: m, detector: 'escaped-system-reminder-desc', confidence: 'medium' } : null;
      },
    },
  ]);

  if (!detection) return null;

  // For the full-sentence detectors, replace the whole match
  // For the clause-only detector, we need the full sentence context
  if (detection.detector === 'bear-no-relation-clause') {
    // Find the broader sentence containing the clause
    const clauseIdx = content.indexOf(detection.match[0]);
    if (clauseIdx === -1) return null;

    // Walk backward to find "Tool results" or the sentence start
    const searchStart = Math.max(0, clauseIdx - 300);
    const prefix = content.slice(searchStart, clauseIdx);
    const sentenceStart = prefix.lastIndexOf('Tool results');

    if (sentenceStart !== -1) {
      // Find the end of the sentence containing the clause
      const fromClause = content.slice(clauseIdx);
      const sentenceEnd = fromClause.indexOf('.') + 1;
      const fullMatch = content.slice(
        searchStart + sentenceStart,
        clauseIdx + sentenceEnd
      );
      const result = content.replace(fullMatch, replacement);
      return result !== content ? result : content;
    }
  }

  const original = detection.match[0];
  const result = content.replace(original, replacement);
  return result !== content ? result : content;
};

// =============================================================================
// PATCH 5: isMeta Flag Removal (OPTIONAL)
// =============================================================================

// =============================================================================
// PATCH 6: USE_EMBEDDED_TOOLS_FN Gate Resolution (CRITICAL — must run before prompts)
// =============================================================================

export const writeEmbeddedToolsGateResolution = (
  content: string
): string | null => {
  let js = content;
  let changed = false;

  // Pattern 1: Full-name function-call ternaries
  // ${USE_EMBEDDED_TOOLS_FN()?"ant branch":"ext branch"}
  js = js.replace(
    /\$\{USE_EMBEDDED_TOOLS_FN\(\)\?"([^"]*(?:\\.[^"]*)*)"\s*:\s*"([^"]*(?:\\.[^"]*)*)"\}/g,
    (_, antBranch) => {
      changed = true;
      return antBranch.replace(/`/g, '\\`');
    }
  );

  // Pattern 2: Full-name boolean ternaries (find, grep)
  // find${USE_EMBEDDED_TOOLS_FN?", grep":""}
  js = js.replace(
    /\$\{USE_EMBEDDED_TOOLS_FN\?",\s*grep":""\}/g,
    () => { changed = true; return ', grep'; }
  );

  // Pattern 3: Minified function-call ternaries (short grep form)
  // find${H?", grep":""}
  js = js.replace(
    /find\$\{[$\w]+\?",\s*grep":""\}/g,
    () => { changed = true; return 'find, grep'; }
  );

  // Pattern 4: Minified function-call ternaries (longer branches)
  // ${H()?"ant text":"ext text"} — heuristic: ant branch mentions cwd/relative/cd/grep
  js = js.replace(
    /\$\{[$\w]+\(\)\?"([^"]*(?:\\.[^"]*)*)":\s*"([^"]*(?:\\.[^"]*)*)"\}/g,
    (full, antBranch, extBranch) => {
      const antLower = antBranch.toLowerCase();
      const extLower = extBranch.toLowerCase();
      const isEmbeddedToolsGate =
        (antLower.includes('cwd') || antLower.includes('relative') ||
         antLower.includes('cd') || antLower.includes('grep')) ||
        (extLower.includes('absolute') || extLower.includes('reset'));
      if (isEmbeddedToolsGate) {
        changed = true;
        return antBranch.replace(/`/g, '\\`');
      }
      return full;
    }
  );

  // Pattern 5: Minified boolean ternary for grep
  // ${l8?", grep":""}
  js = js.replace(
    /\$\{[$\w]+\?",\s*grep":""\}/g,
    () => { changed = true; return ', grep'; }
  );

  if (!changed) return null;

  debug('  resolved USE_EMBEDDED_TOOLS_FN gates');
  return js;
};

// =============================================================================
// PATCH 5: isMeta Flag Removal (OPTIONAL)
// =============================================================================

export const writeIsMetaFlagRemoval = (
  content: string
): string | null => {
  const detection = runDetectors(content, [
    {
      name: 'ismeta-after-system-reminder',
      fn: js => {
        const m = js.match(
          /<\/system-reminder>\s*\\n`,\s*isMeta:\s*!0/
        );
        return m ? { match: m, detector: 'ismeta-after-system-reminder', confidence: 'high' } : null;
      },
    },
    {
      name: 'ismeta-near-reminder',
      fn: js => {
        const m = js.match(
          /system-reminder>[^}]{0,30}isMeta:\s*!0/
        );
        return m ? { match: m, detector: 'ismeta-near-reminder', confidence: 'medium' } : null;
      },
    },
  ]);

  if (!detection) return null;

  const original = detection.match[0];
  const replacement = original.replace(/isMeta:\s*!0/, 'isMeta:!1');
  const result = content.replace(original, replacement);
  return result !== content ? result : content;
};

// =============================================================================
// PATCH 7: Tool Injection (CRITICAL for M-2)
// =============================================================================

const TOOL_LOADER_SIGNATURE = '__claude_governance_tools__';

const TOOL_LOADER_CODE = [
  `var ${TOOL_LOADER_SIGNATURE}=[];`,
  `try{`,
  `var _tpath=require("node:path").join(`,
  `require("node:os").homedir(),".claude-governance","tools","index.js"`,
  `);`,
  `if(require("node:fs").existsSync(_tpath)){`,
  `var _tm=require(_tpath);`,
  `var _ta=Array.isArray(_tm)?_tm:_tm.default||_tm.tools||[];`,
  `for(var _ti=0;_ti<_ta.length;_ti++){`,
  `var _t=_ta[_ti];`,
  `if(_t&&_t.name){`,
  `if(!_t.isEnabled)_t.isEnabled=function(){return!0};`,
  `if(!_t.isConcurrencySafe)_t.isConcurrencySafe=function(){return!1};`,
  `if(!_t.isReadOnly)_t.isReadOnly=function(){return!1};`,
  `if(!_t.isDestructive)_t.isDestructive=function(){return!1};`,
  `if(!_t.checkPermissions)_t.checkPermissions=function(a){return Promise.resolve({behavior:"allow",updatedInput:a})};`,
  `if(!_t.toAutoClassifierInput)_t.toAutoClassifierInput=function(){return""};`,
  `if(!_t.userFacingName)_t.userFacingName=function(){return _t.name};`,
  `if(!_t.renderToolUseMessage)_t.renderToolUseMessage=function(){return null};`,
  `if(!_t.mapToolResultToToolResultBlockParam)_t.mapToolResultToToolResultBlockParam=function(c,id){return{tool_use_id:id,type:"tool_result",content:typeof c==="string"?c:JSON.stringify(c)}};`,
  `if(!_t.maxResultSizeChars)_t.maxResultSizeChars=1e5;`,
  `${TOOL_LOADER_SIGNATURE}.push(_t)`,
  `}}}`,
  `}catch(_e){}`,
].join('');

// Zod passthrough shim — injected AFTER _b is built so we can borrow
// the real Zod passthrough schema from an existing base tool. The CC
// execution pipeline calls .inputSchema.safeParse() in 10+ places
// without checking for inputJSONSchema first. External tools that only
// provide inputJSONSchema crash with "_._zod is not an object".
const TOOL_ZOD_SHIM_CODE = [
  `var _zps=_b[0]&&_b[0].inputSchema;`,
  `if(_zps){for(var _zi=0;_zi<${TOOL_LOADER_SIGNATURE}.length;_zi++){`,
  `var _zt=${TOOL_LOADER_SIGNATURE}[_zi];`,
  `if(!_zt.inputSchema)_zt.inputSchema=_zps;`,
  `if(!_zt.outputSchema&&_b[0].outputSchema)_zt.outputSchema=_b[0].outputSchema;`,
  `}}`,
].join('');

export const writeToolInjection = (
  content: string
): string | null => {
  // Find getAllBaseTools (minified as Ut in 2.1.101)
  // Strategy: find `function XX(){return[` where XX is followed by a known
  // tool array pattern. We anchor on the function containing tool variable names.
  const fnStart = content.match(
    /function ([$\w]+)\(\)\{return\[([$\w]+),([$\w]+),([$\w]+),/
  );

  if (!fnStart) {
    debug('  tool injection: could not find getAllBaseTools function');
    return null;
  }

  const fnName = fnStart[1];
  const fnPrefix = `function ${fnName}(){return[`;

  // Verify this is likely getAllBaseTools by checking the function contains
  // many conditional spreads (the tool gating pattern)
  const fnStartIdx = content.indexOf(fnPrefix);
  if (fnStartIdx === -1) return null;

  // Find the function end — look for `]}function` or `]}var` after the start
  const searchFrom = fnStartIdx + fnPrefix.length;
  const fnBody = content.substring(searchFrom, searchFrom + 2000);
  const fnEndMatch = fnBody.match(/\]\}(?=function |var |let |const |[$\w]+=)/);

  if (!fnEndMatch || fnEndMatch.index === undefined) {
    debug('  tool injection: could not find end of getAllBaseTools');
    return null;
  }

  // Count conditional spreads to verify this is the tool registry
  const condSpreads = (fnBody.substring(0, fnEndMatch.index).match(/\.\.\./g) || []).length;
  if (condSpreads < 10) {
    debug(`  tool injection: function has only ${condSpreads} spreads, expected 10+`);
    return null;
  }

  debug(`  tool injection: found ${fnName}() at offset ${fnStartIdx} with ${condSpreads} spreads`);

  // Build the replacement:
  // Before: function Ut(){return[...tools...]}
  // After:  function Ut(){var _b=[...tools...];LOADER;return _b.concat(__claude_governance_tools__)}
  const fullMatch = fnPrefix + fnBody.substring(0, fnEndMatch.index + 2);
  const arrayContent = fnBody.substring(0, fnEndMatch.index);

  const replacement = [
    `function ${fnName}(){`,
    TOOL_LOADER_CODE,
    `var _b=[${arrayContent}];`,
    TOOL_ZOD_SHIM_CODE,
    `return _b.concat(${TOOL_LOADER_SIGNATURE})`,
    `}`,
  ].join('');

  const result = content.replace(fullMatch, replacement);
  if (result === content) {
    debug('  tool injection: replacement produced no change');
    return null;
  }

  debug(`  tool injection: patched ${fnName}() to load external tools`);
  return result;
};
