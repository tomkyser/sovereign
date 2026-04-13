import type {
  GovernanceModule,
  ModulesConfig,
  VerificationEntry,
  ModuleContext,
  ModuleApplyResult,
} from './types';
import { coreModule } from './core';
import { envFlagsModule } from './env-flags';

const ALL_MODULES: GovernanceModule[] = [
  coreModule,
  envFlagsModule,
];

export function getAllModules(): GovernanceModule[] {
  return ALL_MODULES;
}

export function getEnabledModules(
  modulesConfig?: ModulesConfig,
): GovernanceModule[] {
  return ALL_MODULES.filter(m => {
    if (m.required) return true;
    if (modulesConfig && m.id in modulesConfig) return modulesConfig[m.id];
    return m.defaultEnabled;
  });
}

export function getVerificationRegistry(
  modulesConfig?: ModulesConfig,
): VerificationEntry[] {
  return getEnabledModules(modulesConfig).flatMap(m => m.verificationEntries);
}

export async function applyModules(
  context: ModuleContext,
  modulesConfig?: ModulesConfig,
): Promise<Map<string, ModuleApplyResult>> {
  const results = new Map<string, ModuleApplyResult>();
  const enabled = getEnabledModules(modulesConfig);

  for (const mod of enabled) {
    if (mod.apply) {
      try {
        const result = await mod.apply(context);
        results.set(mod.id, result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.set(mod.id, { applied: false, message: msg });
      }
    }
  }

  return results;
}
