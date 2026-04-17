import { debug } from '../../utils';

// =============================================================================
// PATCH 7: Tool Injection (CRITICAL for M-2)
// =============================================================================

const TOOL_LOADER_SIGNATURE = '__claude_governance_tools__';


const REACT_REF_CAPTURE_CODE = [
  'try{',
  'var _govR=require("react");',
  'var _govInk;try{_govInk=require("ink")}catch(_){}',
  'globalThis.__govReactRefs={',
  'R:_govR.default||_govR,',
  'Box:_govInk?_govInk.Box:null,',
  'Text:_govInk?_govInk.Text:null',
  '};',
  '}catch(_govE){}',
].join('');

const TOOL_LOADER_CODE = [
  REACT_REF_CAPTURE_CODE,
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
  `if(!_t.renderToolUseMessage)_t.renderToolUseMessage=function(d,o){var _r=globalThis.__govReactRefs;if(_r&&_r.R&&_r.R.createElement&&_r.Text)return _r.R.createElement(_r.Text,{color:"cyan"},_t.name+(d&&d.description?" — "+d.description:""));return _t.name};`,
  `if(!_t.mapToolResultToToolResultBlockParam)_t.mapToolResultToToolResultBlockParam=function(c,id){return{tool_use_id:id,type:"tool_result",content:typeof c==="string"?c:JSON.stringify(c)}};`,
  `if(!_t.maxResultSizeChars)_t.maxResultSizeChars=1e5;`,
  `${TOOL_LOADER_SIGNATURE}.push(_t)`,
  `}}}`,
  `}catch(_e){}`,
].join('');

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

const TOOL_REPLACE_FILTER_CODE = [
  `try{`,
  `var _cfgPath=require("node:path").join(`,
  `require("node:os").homedir(),".claude-governance","config.json"`,
  `);`,
  `var _cfg=JSON.parse(require("node:fs").readFileSync(_cfgPath,"utf8"));`,
  `if(_cfg.repl&&_cfg.repl.mode==="replace"){`,
  `var _replOnly={"Read":1,"Write":1,"Edit":1,"Bash":1,"NotebookEdit":1,"Agent":1};`,
  `var _replTool=null;`,
  `for(var _ri=0;_ri<${TOOL_LOADER_SIGNATURE}.length;_ri++){`,
  `if(${TOOL_LOADER_SIGNATURE}[_ri].name==="REPL"){_replTool=${TOOL_LOADER_SIGNATURE}[_ri];break}`,
  `}`,
  `if(_replTool){`,
  `_replTool._stashedTools=_b.filter(function(t){return!!_replOnly[t.name]})`,
  `}`,
  `_b=_b.filter(function(t){return!_replOnly[t.name]})`,
  `}`,
  `}catch(_re){}`,
].join('');

// G9: Multiple detection strategies for getAllBaseTools

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
          /function\s+([$\w]+)\(\)\s*\{\s*\n?\s*return\s*\[([$\w]+),\s*([$\w]+),\s*([$\w]+),/
        );
        if (!m || m.index === undefined) return null;
        const fnName = m[1];
        const prefix = `function ${fnName}(){return[`;
        const prefixAlt = `function ${fnName}() {\n  return [`;
        let prefixIdx = content.indexOf(prefix);
        let usedPrefix = prefix;
        if (prefixIdx === -1) {
          prefixIdx = content.indexOf(prefixAlt);
          usedPrefix = prefixAlt;
        }
        if (prefixIdx === -1) return null;
        const arrayStart = prefixIdx + usedPrefix.length;
        const arrayEnd = findArrayEnd(content, arrayStart);
        if (arrayEnd === -1) return null;
        const arrayContent = content.substring(arrayStart, arrayEnd);
        const spreads = (arrayContent.match(/\.\.\./g) || []).length;
        if (spreads < 10) return null;
        return {
          fnName,
          fnDeclStart: usedPrefix,
          arrayContent,
          fullMatch: usedPrefix + arrayContent + (usedPrefix === prefix ? ']}' : '];\n}'),
          strategy: 'function-declaration',
          spreads,
        };
      },
    },
    {
      name: 'arrow-function',
      fn: () => {
        const m = content.match(
          /(?:var |let |const )([$\w]+)\s*=\s*\(\)\s*=>\s*\[([$\w]+),\s*([$\w]+),\s*([$\w]+),/
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
        const toolSig = /name:\s*"(?:Bash|Read|Edit|Write|Agent)"/;
        const sigMatch = content.match(toolSig);
        if (!sigMatch || sigMatch.index === undefined) return null;
        const nearby = content.substring(
          Math.max(0, sigMatch.index - 3000),
          sigMatch.index
        );
        const fnMatch = nearby.match(/function\s+([$\w]+)\(\)\s*\{\s*\n?\s*return\s*\[/);
        const arrowMatch = nearby.match(
          /(?:var |let |const )([$\w]+)\s*=\s*\(\)\s*=>\s*\[/
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
