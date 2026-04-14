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
    antiSignature:
      "As you answer the user's questions, you can use the following context:",
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
  // --- Embedded tools Glob/Grep exclusion (G11) ---
  {
    id: 'embedded-tools-exclusion',
    name: 'Embedded Tools: Glob/Grep Exclusion',
    signature: /[$\w]+\(\)\?\[\]:\[[$\w]+,[$\w]+\]/,
    critical: false,
    category: 'gate',
    passDetail: 'Glob/Grep excluded when embedded tools active',
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
  {
    id: 'prompt-doing-tasks-ambitious',
    name: 'Prompt Override: Ambitious Tasks + REPL',
    signature: 'prefer REPL over individual tool calls',
    critical: false,
    category: 'prompt-override',
  },
  {
    id: 'repl-tool-guidance',
    name: 'REPL Tool Guidance Injection',
    signature: 'could one REPL call do this',
    critical: false,
    category: 'governance',
    passDetail: 'active in Using your tools',
  },
  // --- Tungsten infrastructure ---
  {
    id: 'tungsten-fs9',
    name: 'Tungsten: bashProvider tmux Activation',
    signature: '__CLAUDE_GOVERNANCE_TMUX_ENV',
    antiSignature: /function FS9\(\)\{return null\}/,
    critical: false,
    category: 'tool-injection',
    passDetail: 'FS9() reads Tungsten socket info',
  },
  {
    id: 'tungsten-panel',
    name: 'Tungsten: Live Panel Injection',
    signature: '__tungsten_panel__',
    critical: false,
    category: 'tool-injection',
    passDetail: 'panel component mounted in render tree',
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
        return m
          ? { match: m, detector: 'exact-disclaimer-text', confidence: 'high' }
          : null;
      },
    },
    {
      name: 'fuzzy-may-or-may-not',
      fn: js => {
        const m = js.match(
          /may or may not be relevant[^]*?(?=<\/system-reminder>)/
        );
        return m
          ? { match: m, detector: 'fuzzy-may-or-may-not', confidence: 'medium' }
          : null;
      },
    },
    {
      name: 'hedging-before-close-tag',
      fn: js => {
        const m = js.match(
          /(?:should not respond|not respond to this|may not be relevant|might not be relevant|not necessarily relevant)[^<]*<\/system-reminder>/i
        );
        return m
          ? {
              match: m,
              detector: 'hedging-before-close-tag',
              confidence: 'medium',
            }
          : null;
      },
    },
    {
      name: 'important-disclaimer-in-reminder',
      fn: js => {
        const m = js.match(
          /IMPORTANT:[^<]{20,200}(?:relevant|respond|context)[^<]*<\/system-reminder>/
        );
        return m
          ? {
              match: m,
              detector: 'important-disclaimer-in-reminder',
              confidence: 'low',
            }
          : null;
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
  const replacement = replacementText ?? GOVERNANCE_DEFAULTS.headerReplacement;

  const detection = runDetectors(content, [
    {
      name: 'exact-header-text',
      fn: js => {
        const m = js.match(
          /As you answer the user's questions, you can use the following context:/
        );
        return m
          ? { match: m, detector: 'exact-header-text', confidence: 'high' }
          : null;
      },
    },
    {
      name: 'escaped-header-text',
      fn: js => {
        const m = js.match(
          /As you answer the user\\?'s questions, you can use the following context:/
        );
        return m
          ? { match: m, detector: 'escaped-header-text', confidence: 'high' }
          : null;
      },
    },
    {
      name: 'fuzzy-answer-questions-context',
      fn: js => {
        const m = js.match(
          /(?:answer|answering)[^<]{0,40}(?:question|queries)[^<]{0,40}(?:context|information):/i
        );
        return m
          ? {
              match: m,
              detector: 'fuzzy-answer-questions-context',
              confidence: 'medium',
            }
          : null;
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
        return m
          ? { match: m, detector: 'exact-flag-true', confidence: 'high' }
          : null;
      },
    },
    {
      name: 'exact-flag-true-unminified',
      fn: js => {
        const m = js.match(/tengu_slim_subagent_claudemd",\s*true\)/);
        return m
          ? {
              match: m,
              detector: 'exact-flag-true-unminified',
              confidence: 'high',
            }
          : null;
      },
    },
    {
      name: 'flag-name-any-default',
      fn: js => {
        const m = js.match(/tengu_slim_subagent_claudemd"[^)]{0,10}\)/);
        return m
          ? {
              match: m,
              detector: 'flag-name-any-default',
              confidence: 'medium',
            }
          : null;
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
        return m
          ? {
              match: m,
              detector: 'bear-no-relation-clause',
              confidence: 'high',
            }
          : null;
      },
    },
    {
      name: 'exact-full-sentence',
      fn: js => {
        const m = js.match(
          /Tool results and user messages may include <system-reminder> tags[^.]*\.[^.]*bear no direct relation[^.]*\./
        );
        return m
          ? { match: m, detector: 'exact-full-sentence', confidence: 'high' }
          : null;
      },
    },
    {
      name: 'escaped-system-reminder-desc',
      fn: js => {
        const m = js.match(
          /system-reminder>?\s*(?:tags?\s+)?(?:contain|include)[^.]*bear no direct/i
        );
        return m
          ? {
              match: m,
              detector: 'escaped-system-reminder-desc',
              confidence: 'medium',
            }
          : null;
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
  js = js.replace(/\$\{USE_EMBEDDED_TOOLS_FN\?",\s*grep":""\}/g, () => {
    changed = true;
    return ', grep';
  });

  // Pattern 3: Minified function-call ternaries (short grep form)
  // find${H?", grep":""}
  js = js.replace(/find\$\{[$\w]+\?",\s*grep":""\}/g, () => {
    changed = true;
    return 'find, grep';
  });

  // Pattern 4: Minified function-call ternaries (longer branches)
  // ${H()?"ant text":"ext text"} — heuristic: ant branch mentions cwd/relative/cd/grep
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
  // ${l8?", grep":""}
  js = js.replace(/\$\{[$\w]+\?",\s*grep":""\}/g, () => {
    changed = true;
    return ', grep';
  });

  if (!changed) return null;

  debug('  resolved USE_EMBEDDED_TOOLS_FN gates');
  return js;
};

// =============================================================================
// PATCH 5: isMeta Flag Removal (OPTIONAL)
// =============================================================================

export const writeIsMetaFlagRemoval = (content: string): string | null => {
  const detection = runDetectors(content, [
    {
      name: 'ismeta-after-system-reminder',
      fn: js => {
        const m = js.match(/<\/system-reminder>\s*\\n`,\s*isMeta:\s*!0/);
        return m
          ? {
              match: m,
              detector: 'ismeta-after-system-reminder',
              confidence: 'high',
            }
          : null;
      },
    },
    {
      name: 'ismeta-near-reminder',
      fn: js => {
        const m = js.match(/system-reminder>[^}]{0,30}isMeta:\s*!0/);
        return m
          ? { match: m, detector: 'ismeta-near-reminder', confidence: 'medium' }
          : null;
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

// Zod passthrough shim — self-contained passthrough schema that accepts
// any input. The CC execution pipeline calls tool.inputSchema.safeParse()
// in toolExecution.ts:615 and .parse() in permissions.ts. External tools
// only provide inputJSONSchema (plain JSON Schema for the API), not a Zod
// schema. Without this shim, safeParse validates against whatever schema
// was borrowed — previously _b[0] (Agent tool), which requires "description"
// and "prompt" fields, causing InputValidationError on any external tool call.
const TOOL_ZOD_SHIM_CODE = [
  `var _zps={`,
  `safeParse:function(d){return{success:!0,data:d}},`,
  `parse:function(d){return d}`,
  `};`,
  `for(var _zi=0;_zi<${TOOL_LOADER_SIGNATURE}.length;_zi++){`,
  `var _zt=${TOOL_LOADER_SIGNATURE}[_zi];`,
  `if(!_zt.inputSchema)_zt.inputSchema=_zps;`,
  `if(!_zt.outputSchema)_zt.outputSchema=_zps;`,
  `}`,
].join('');

// Replace mode: filter REPL_ONLY_TOOLS from _b when repl.mode is "replace".
// Same tools Ant filters (tools.ts:314-321): Read, Write, Edit, Bash,
// NotebookEdit, Agent. Glob/Grep already excluded by embedded tools gate.
// In replace mode, filter primitives from _b BUT stash them on the REPL tool
// so it can still delegate. Ant's getReplPrimitiveTools() does this by bypassing
// getAllBaseTools() entirely — we stash on the tool object instead.
const TOOL_REPLACE_FILTER_CODE = [
  `try{`,
  `var _cfgPath=require("node:path").join(`,
  `require("node:os").homedir(),".claude-governance","config.json"`,
  `);`,
  `var _cfg=JSON.parse(require("node:fs").readFileSync(_cfgPath,"utf8"));`,
  `if(_cfg.repl&&_cfg.repl.mode==="replace"){`,
  `var _replOnly={"Read":1,"Write":1,"Edit":1,"Bash":1,"NotebookEdit":1,"Agent":1};`,
  // Stash filtered tools on the REPL tool object before removing them
  `var _replTool=null;`,
  `for(var _ri=0;_ri<${TOOL_LOADER_SIGNATURE}.length;_ri++){`,
  `if(${TOOL_LOADER_SIGNATURE}[_ri].name==="REPL"){_replTool=${TOOL_LOADER_SIGNATURE}[_ri];break}`,
  `}`,
  `if(_replTool){`,
  `_replTool._stashedTools=_b.filter(function(t){return!!_replOnly[t.name]})`,
  `}`,
  // Now filter primitives from the returned array
  `_b=_b.filter(function(t){return!_replOnly[t.name]})`,
  `}`,
  `}catch(_re){}`,
].join('');

// G9: Multiple detection strategies for getAllBaseTools, ordered by confidence.
// The minifier can change function names, syntax style, and body size across
// CC versions. Each strategy extracts: fnName, arrayStartIdx, arrayContent.

interface ToolArrayDetection {
  fnName: string;
  fnDeclStart: string;
  arrayContent: string;
  fullMatch: string;
  strategy: string;
  spreads: number;
}

function findArrayEnd(content: string, startIdx: number): number {
  let depth = 1;
  for (let i = startIdx; i < content.length && i < startIdx + 8000; i++) {
    if (content[i] === '[') depth++;
    else if (content[i] === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function detectToolArray(content: string): ToolArrayDetection | null {
  const strategies: Array<{
    name: string;
    fn: () => ToolArrayDetection | null;
  }> = [
    {
      name: 'function-declaration',
      fn: () => {
        const m = content.match(
          /function ([$\w]+)\(\)\{return\[([$\w]+),([$\w]+),([$\w]+),/
        );
        if (!m || m.index === undefined) return null;
        const fnName = m[1];
        const prefix = `function ${fnName}(){return[`;
        const prefixIdx = content.indexOf(prefix);
        if (prefixIdx === -1) return null;
        const arrayStart = prefixIdx + prefix.length;
        const arrayEnd = findArrayEnd(content, arrayStart);
        if (arrayEnd === -1) return null;
        const arrayContent = content.substring(arrayStart, arrayEnd);
        const spreads = (arrayContent.match(/\.\.\./g) || []).length;
        if (spreads < 10) return null;
        return {
          fnName,
          fnDeclStart: prefix,
          arrayContent,
          fullMatch: prefix + arrayContent + ']}',
          strategy: 'function-declaration',
          spreads,
        };
      },
    },
    {
      name: 'arrow-function',
      fn: () => {
        const m = content.match(
          /(?:var |let |const )([$\w]+)=\(\)=>\[([$\w]+),([$\w]+),([$\w]+),/
        );
        if (!m || m.index === undefined) return null;
        const fnName = m[1];
        const prefix = `${fnName}=()=>[`;
        const prefixIdx = content.indexOf(prefix);
        if (prefixIdx === -1) return null;
        const declStart = content.lastIndexOf(
          content[prefixIdx - 1] === '=' ? 'var ' : 'const ',
          prefixIdx
        );
        const arrayStart = prefixIdx + prefix.length;
        const arrayEnd = findArrayEnd(content, arrayStart);
        if (arrayEnd === -1) return null;
        const arrayContent = content.substring(arrayStart, arrayEnd);
        const spreads = (arrayContent.match(/\.\.\./g) || []).length;
        if (spreads < 10) return null;
        const fullDeclPrefix =
          content.substring(
            declStart === -1 ? prefixIdx : declStart,
            prefixIdx
          ) + prefix;
        return {
          fnName,
          fnDeclStart: fullDeclPrefix,
          arrayContent,
          fullMatch: fullDeclPrefix + arrayContent + ']',
          strategy: 'arrow-function',
          spreads,
        };
      },
    },
    {
      name: 'content-based',
      fn: () => {
        const toolSig = /name:"(?:Bash|Read|Edit|Write|Agent)"/;
        const sigMatch = content.match(toolSig);
        if (!sigMatch || sigMatch.index === undefined) return null;
        const nearby = content.substring(
          Math.max(0, sigMatch.index - 3000),
          sigMatch.index
        );
        const fnMatch = nearby.match(/function ([$\w]+)\(\)\{return\[/);
        const arrowMatch = nearby.match(
          /(?:var |let |const )([$\w]+)=\(\)=>\[/
        );
        const match = fnMatch || arrowMatch;
        if (!match) return null;
        const fnName = match[1];
        const isArrow = !fnMatch;
        const prefix = isArrow
          ? `${fnName}=()=>[`
          : `function ${fnName}(){return[`;
        const prefixIdx = content.indexOf(prefix);
        if (prefixIdx === -1) return null;
        const arrayStart = prefixIdx + prefix.length;
        const arrayEnd = findArrayEnd(content, arrayStart);
        if (arrayEnd === -1) return null;
        const arrayContent = content.substring(arrayStart, arrayEnd);
        const spreads = (arrayContent.match(/\.\.\./g) || []).length;
        if (spreads < 8) return null;
        const fullMatch = isArrow
          ? prefix + arrayContent + ']'
          : prefix + arrayContent + ']}';
        return {
          fnName,
          fnDeclStart: prefix,
          arrayContent,
          fullMatch,
          strategy: 'content-based',
          spreads,
        };
      },
    },
  ];

  for (const { name, fn } of strategies) {
    try {
      const result = fn();
      if (result) {
        debug(
          `  tool injection: strategy "${name}" matched — ${result.fnName}() with ${result.spreads} spreads`
        );
        return result;
      }
    } catch (err) {
      debug(`  tool injection: strategy "${name}" threw: ${err}`);
    }
  }

  return null;
}

export const writeToolInjection = (content: string): string | null => {
  const detection = detectToolArray(content);

  if (!detection) {
    debug('  tool injection: all detection strategies failed');
    return null;
  }

  const { fnName, arrayContent, fullMatch, strategy } = detection;
  const isArrow = strategy === 'arrow-function';

  const replacement = isArrow
    ? [
        `${fnName}=()=>{`,
        TOOL_LOADER_CODE,
        `var _b=[${arrayContent}];`,
        TOOL_ZOD_SHIM_CODE,
        TOOL_REPLACE_FILTER_CODE,
        `return _b.concat(${TOOL_LOADER_SIGNATURE})`,
        `}`,
      ].join('')
    : [
        `function ${fnName}(){`,
        TOOL_LOADER_CODE,
        `var _b=[${arrayContent}];`,
        TOOL_ZOD_SHIM_CODE,
        TOOL_REPLACE_FILTER_CODE,
        `return _b.concat(${TOOL_LOADER_SIGNATURE})`,
        `}`,
      ].join('');

  const result = content.replace(fullMatch, replacement);
  if (result === content) {
    debug('  tool injection: replacement produced no change');
    return null;
  }

  debug(`  tool injection: patched ${fnName}() via ${strategy}`);
  return result;
};

// =============================================================================
// PATCH 8: REPL Tool Guidance Injection
// =============================================================================
// Injects REPL guidance into the "Using your tools" section (mk5/getUsingYourToolsSection).
// The model's tool selection is dominated by this section — "Use Read instead of cat" etc.
// Without REPL guidance here, the model reasons about REPL but still reaches for individual
// tools. This patch adds REPL as a peer-level recommendation.

const REPL_GUIDANCE =
  'Before issuing multiple tool calls, ask: could one REPL call do this? REPL executes JavaScript ' +
  'with access to glob, grep, read, write, edit, and bash \\u2014 an entire scan-filter-act pipeline ' +
  'in a single tool call. Three Bash calls that REPL could combine into one means 3x the context ' +
  'consumed and 3x the inference cost. At scale this accelerates compaction and degrades session ' +
  'quality. Use individual tools only for single-file operations and safety-critical edits where ' +
  'diff visibility matters.';

export const writeReplToolGuidance = (content: string): string | null => {
  // Target: the T array closing in mk5's full-mode path (path 3).
  // The array ends with: ...sequentially instead."].filter(($)=>$!==null)
  // Strategy: inject a new array element before the "].filter" closing.
  // This is unique (1 match) because of the full return pattern after it.

  // Already patched check
  if (content.includes('could one REPL call do this? REPL executes')) {
    debug('  REPL tool guidance: already applied');
    return content;
  }

  const detection = runDetectors(content, [
    {
      name: 'using-your-tools-array-close',
      fn: js => {
        const m = js.match(
          /sequentially instead\."\]\.filter\(\([$\w]+\)=>[$\w]+!==null\);return\["# Using your tools"/
        );
        return m
          ? {
              match: m,
              detector: 'using-your-tools-array-close',
              confidence: 'high',
            }
          : null;
      },
    },
  ]);

  if (!detection) return null;

  const original = detection.match[0];
  const escapedGuidance = REPL_GUIDANCE.replace(/"/g, '\\"');
  const replacement = original.replace(
    'sequentially instead."]',
    `sequentially instead.","${escapedGuidance}"]`
  );

  const result = content.replace(original, replacement);
  return result !== content ? result : null;
};

// =============================================================================
// PATCH 9: Tungsten FS9() — bashProvider tmux Activation
// =============================================================================
// The binary stubs getClaudeTmuxEnv() as FS9(){return null}. bashProvider calls
// FS9() unconditionally and sets TMUX env if non-null. Replacing the stub with a
// function that reads our env var activates tmux environment inheritance for ALL
// Bash commands (including REPL's bash() delegation).

const FS9_REPLACEMENT = [
  'function FS9(){',
  'var _e=process.env.__CLAUDE_GOVERNANCE_TMUX_ENV;',
  'return _e||null',
  '}',
].join('');

export const writeTungstenFs9Patch = (content: string): string | null => {
  if (content.includes('__CLAUDE_GOVERNANCE_TMUX_ENV')) {
    debug('  Tungsten FS9: already applied');
    return content;
  }

  const detection = runDetectors(content, [
    {
      name: 'exact-fs9-stub',
      fn: js => {
        const m = js.match(/function FS9\(\)\{return null\}/);
        return m
          ? { match: m, detector: 'exact-fs9-stub', confidence: 'high' }
          : null;
      },
    },
    {
      name: 'pattern-tmux-env-stub',
      fn: js => {
        // Fallback: any stubbed function whose result feeds into a TMUX env assignment.
        // In bashProvider: let z = FS9(); if(z) w.TMUX = z;
        // The function name may change across versions but the pattern is stable.
        const m = js.match(
          /function ([$\w]+)\(\)\{return null\}[^]*?;if\(\1\)[$\w]+\.TMUX=\1/
        );
        if (!m) return null;
        const fnName = m[1];
        const stubMatch = js.match(
          new RegExp(
            `function ${fnName.replace(/\$/g, '\\$')}\\(\\)\\{return null\\}`
          )
        );
        return stubMatch
          ? {
              match: stubMatch,
              detector: 'pattern-tmux-env-stub',
              confidence: 'medium',
            }
          : null;
      },
    },
  ]);

  if (!detection) return null;

  const original = detection.match[0];
  // If the function name isn't FS9, adapt the replacement
  const fnNameMatch = original.match(/function ([$\w]+)\(/);
  if (!fnNameMatch) return null;
  const fnName = fnNameMatch[1];

  const replacement =
    fnName === 'FS9' ? FS9_REPLACEMENT : FS9_REPLACEMENT.replace('FS9', fnName);

  const result = content.replace(original, replacement);
  return result !== content ? result : null;
};

// =============================================================================
// PATCH 10: Tungsten Live Panel — Render Tree Injection
// =============================================================================
// The DCE'd TungstenLiveMonitor left `!1,null` in the React children array.
// We replace it with a self-executing function that require()s our panel
// component and creates a React element from it. The panel receives React
// primitives as props since it's loaded from outside the binary's module scope.

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
