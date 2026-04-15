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
// Contamination Detection
// =============================================================================

export const isContentPatched = (js: string): boolean => {
  return (
    js.includes(GOVERNANCE_DEFAULTS.disclaimerReplacement) ||
    js.includes(GOVERNANCE_DEFAULTS.headerReplacement) ||
    js.includes(GOVERNANCE_DEFAULTS.reminderFramingReplacement)
  );
};
