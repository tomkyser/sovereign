// Barrel re-exports for all governance patches
export { GOVERNANCE_DEFAULTS, isContentPatched } from './defaults';
export type { Detection } from './types';
export { runDetectors } from './types';

// Verification registry
export type { VerificationEntry } from './registry';
export { VERIFICATION_REGISTRY } from './registry';

// Patch implementations
export { writeDisclaimerNeutralization } from './disclaimer';
export { writeContextHeaderReframing } from './context-header';
export { writeSubagentClaudeMdRestoration } from './subagent-claudemd';
export { writeReminderAuthorityFix } from './system-reminder';
export { writeIsMetaFlagRemoval } from './ismeta-flag';
export { writeEmbeddedToolsGateResolution } from './embedded-tools-gate';
export { writeToolInjection } from './tool-injection';
export { writeReplToolGuidance } from './repl-guidance';
export { writeTungstenFs9Patch } from './fs9';
export { writeTungstenPanelInjection } from './render-tree';
export { writeTungstenToolGuidance } from './tungsten-guidance';
export { writeClientDataCachePatch } from './client-data-cache';
