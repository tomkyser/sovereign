import { VERIFICATION_REGISTRY } from '../patches/governance';
import type { GovernanceModule } from './types';

export const coreModule: GovernanceModule = {
  id: 'core',
  name: 'Core Governance',
  description: 'Binary patches, prompt overrides, and gate resolution',
  required: true,
  defaultEnabled: true,
  verificationEntries: VERIFICATION_REGISTRY,
};
