import { debug } from '../../utils';
import { runDetectors } from './types';

// =============================================================================
// PATCH 12: clientDataCache Bootstrap Preservation (quiet_salted_ember)
// =============================================================================
//
// ms7() is the bootstrap function that fetches client_data from Anthropic's API.
// For external users, the server returns client_data: null — which overwrites
// any locally-set clientDataCache values in ~/.claude.json.
//
// This patch modifies ms7() to skip the clientDataCache field in both the
// deep-equal comparison and the config write, preserving any values we set
// (quiet_salted_ember, coral_reef_sonnet) while still allowing model options
// and model costs to update normally.
//
// Source function (v2.1.101):
//   async function ms7(){try{
//     let H=await ip5();if(!H)return;
//     let _=H.client_data??null,
//         q=H.additional_model_options??[],
//         K=H.additional_model_costs??{},
//         O=w_();
//     if(Pj(O.clientDataCache,_)&&Pj(O.additionalModelOptionsCache,q)
//        &&Pj(O.additionalModelCostsCache,K)){
//       N("[Bootstrap] Cache unchanged, skipping write");return}
//     N("[Bootstrap] Cache updated, persisting to disk"),
//     p_((T)=>({...T,clientDataCache:_,
//       additionalModelOptionsCache:q,additionalModelCostsCache:K}))
//   }catch(H){wH(H)}}

const PATCH_SIGNATURE = '__cdc_preserved__';

export const writeClientDataCachePatch = (content: string): string | null => {
  if (content.includes(PATCH_SIGNATURE)) {
    debug('  clientDataCache: already applied');
    return content;
  }

  const detection = runDetectors(content, [
    {
      name: 'exact-ms7-pj-chain',
      fn: js => {
        // Match the Pj comparison chain inside ms7
        // Pattern: Pj(O.clientDataCache,_)&&Pj(O.additionalModelOptionsCache,q)&&Pj(O.additionalModelCostsCache,K)
        const m = js.match(
          /([$\w]+)\(([$\w]+)\.clientDataCache,\s*([$\w]+)\)\s*&&\s*\1\(\2\.additionalModelOptionsCache,\s*([$\w]+)\)\s*&&\s*\1\(\2\.additionalModelCostsCache,\s*([$\w]+)\)/
        );
        return m
          ? { match: m, detector: 'exact-ms7-pj-chain', confidence: 'high' }
          : null;
      },
    },
    {
      name: 'p_-callback-clientdata',
      fn: js => {
        // Match the p_ callback that writes clientDataCache
        // Pattern: p_((T)=>({...T,clientDataCache:_,additionalModelOptionsCache:q,additionalModelCostsCache:K}))
        const m = js.match(
          /([$\w]+)\(\(([$\w]+)\)\s*=>\s*\(\{\s*\.\.\.\2,\s*clientDataCache:\s*([$\w]+),\s*additionalModelOptionsCache:\s*([$\w]+),\s*additionalModelCostsCache:\s*([$\w]+)\s*\}\)\)/
        );
        return m
          ? {
              match: m,
              detector: 'p_-callback-clientdata',
              confidence: 'high',
            }
          : null;
      },
    },
  ]);

  if (!detection) {
    debug('  clientDataCache: no detection matched');
    return null;
  }

  let result = content;

  // Strategy: find the ms7 function and make two surgical edits:
  //
  // 1. Remove clientDataCache from the Pj comparison chain
  //    OLD: Pj(O.clientDataCache,_)&&Pj(O.additionalModelOptionsCache,q)&&Pj(O.additionalModelCostsCache,K)
  //    NEW: Pj(O.additionalModelOptionsCache,q)&&Pj(O.additionalModelCostsCache,K)
  //
  // 2. Remove clientDataCache from the p_ write callback
  //    OLD: p_((T)=>({...T,clientDataCache:_,additionalModelOptionsCache:q,additionalModelCostsCache:K}))
  //    NEW: p_((T)=>({...T,additionalModelOptionsCache:q,additionalModelCostsCache:K}))

  // Edit 1: Remove clientDataCache from Pj comparison chain
  const pjChainPattern =
    /([$\w]+)\(([$\w]+)\.clientDataCache,\s*([$\w]+)\)\s*&&\s*(\1\(\2\.additionalModelOptionsCache,\s*([$\w]+)\)\s*&&\s*\1\(\2\.additionalModelCostsCache,\s*([$\w]+)\))/;
  const pjMatch = result.match(pjChainPattern);
  if (!pjMatch) {
    debug('  clientDataCache: Pj chain pattern not found for replacement');
    return null;
  }

  const pjOld = pjMatch[0];
  const pjNew = pjMatch[4]; // Just the remaining two Pj checks
  result = result.replace(pjOld, pjNew);

  debug(
    `  clientDataCache: removed Pj(*.clientDataCache,*) from comparison chain`
  );

  // Edit 2: Remove clientDataCache from p_ write callback
  const writePattern =
    /([$\w]+)\(\(([$\w]+)\)\s*=>\s*\(\{\s*\.\.\.\2,\s*clientDataCache:\s*([$\w]+),\s*additionalModelOptionsCache:\s*([$\w]+),\s*additionalModelCostsCache:\s*([$\w]+)\s*\}\)\)/;
  const writeMatch = result.match(writePattern);
  if (!writeMatch) {
    debug('  clientDataCache: p_ write pattern not found for replacement');
    return null;
  }

  const writeOld = writeMatch[0];
  const pFn = writeMatch[1]; // p_
  const tVar = writeMatch[2]; // T
  const qVar = writeMatch[4]; // q (model options)
  const kVar = writeMatch[5]; // K (model costs)
  const writeNew = `${pFn}((${tVar})=>({...${tVar},additionalModelOptionsCache:${qVar},additionalModelCostsCache:${kVar}}))`;
  result = result.replace(writeOld, writeNew);

  debug(
    `  clientDataCache: removed clientDataCache field from p_() write callback`
  );

  // Edit 3: Also remove the unused client_data variable assignment
  // OLD: let _=H.client_data??null,q=H.additional_model_options...
  // NEW: let q=H.additional_model_options...
  // This prevents the dead variable from triggering lint-like warnings in
  // the minified code and is cleaner.
  const varPattern =
    /let\s+([$\w]+)\s*=\s*([$\w]+)\.client_data\s*\?\?\s*null,\s*([$\w]+)\s*=\s*\2\.additional_model_options/;
  const varMatch = result.match(varPattern);
  if (varMatch) {
    const varOld = varMatch[0];
    const hVar = varMatch[2]; // H (response)
    const qVarName = varMatch[3]; // q
    const varNew = `let ${qVarName}=${hVar}.additional_model_options`;
    result = result.replace(varOld, varNew);
    debug('  clientDataCache: removed unused client_data variable assignment');
  }

  // Inject signature comment for verification
  // Place it right after the function keyword to be findable
  const ms7Decl = 'async function ms7()';
  const ms7DeclAlt = result.match(/async function ([$\w]+)\(\)\s*\{\s*\n?\s*try\s*\{\s*\n?\s*let\s+([$\w]+)\s*=\s*await\s+([$\w]+)\(\);\s*\n?\s*if\s*\(!\2\)\s*return;\s*\n?\s*let\s+([$\w]+)\s*=\s*\2\.additional_model_options/);

  if (ms7DeclAlt) {
    // The function name might not be ms7 in future versions
    const fnDecl = ms7DeclAlt[0];
    const sigInjection = fnDecl.replace(
      'async function',
      `/*${PATCH_SIGNATURE}*/async function`
    );
    result = result.replace(fnDecl, sigInjection);
    debug('  clientDataCache: injected verification signature');
  } else if (result.includes(ms7Decl)) {
    result = result.replace(
      ms7Decl,
      `/*${PATCH_SIGNATURE}*/${ms7Decl}`
    );
    debug('  clientDataCache: injected verification signature (exact name)');
  }

  return result !== content ? result : null;
};
