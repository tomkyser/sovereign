import type { VerificationEntry } from '../patches/governance';

export type { VerificationEntry };

export interface ModuleContext {
  configDir: string;
  ccVersion: string;
  binaryPath: string;
}

export interface ModuleApplyResult {
  applied: boolean;
  message?: string;
  details?: string[];
}

export interface ModuleStatus {
  enabled: boolean;
  healthy: boolean;
  details?: string;
}

export interface GovernanceModule {
  id: string;
  name: string;
  description: string;
  required: boolean;
  defaultEnabled: boolean;
  verificationEntries: VerificationEntry[];
  apply?(context: ModuleContext): Promise<ModuleApplyResult>;
  getStatus?(context: ModuleContext): Promise<ModuleStatus>;
}

export interface ModulesConfig {
  [moduleId: string]: boolean;
}
