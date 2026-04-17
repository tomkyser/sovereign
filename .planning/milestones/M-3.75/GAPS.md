# Milestone 3.75 Gap Analysis — RALPH

## Gaps Identified

### G1: Longitudinal Metrics Not Yet Measurable
**Severity:** Low (expected)
**Description:** First-pass success rate (>85% target), context efficiency
(≤50% tool calls), and training effect require multi-session observation
across real projects. Cannot be measured in a single implementation session.
**Mitigation:** Track informally during M-4 work. Revisit after 10+ sessions.

### G2: RALPH Only Enforces on REPL, Not Edit/Write
**Severity:** Low (by design)
**Description:** The PreToolUse checkpoint only fires for REPL tool calls.
Direct Edit/Write calls don't get RALPH enforcement. This is intentional —
most complex operations go through REPL — but means a model could bypass
RALPH by using Edit directly for a multi-file change.
**Mitigation:** Monitor. If this becomes a pattern, add Edit/Write matcher.

### G3: Module Not Enabled by Default
**Severity:** Informational
**Description:** `defaultEnabled: false` means users must opt in via
module config. This is intentional for a new behavioral feature, but means
zero adoption unless users know about it.
**Mitigation:** Document in README. Consider `defaultEnabled: true` after
validation period.

### G4: No Uninstall Path Tested
**Severity:** Medium
**Description:** The `unregisterHooksFromSettings()` function exists but
was never tested end-to-end. Disabling the module should cleanly remove
hooks from settings.json and delete hook files.
**Mitigation:** Test uninstall path before M-4 ship.

### G5: Hook Context Accumulation
**Severity:** Low
**Description:** The REPL checkpoint adds ~10 lines of system-reminder to
every qualifying REPL result. Over a long session, this accumulates in
context. No session-level "already acknowledged" state exists.
**Mitigation:** Monitor context impact during M-4. Consider a
session-state flag if it becomes problematic.

## No Gaps Found In

- Layer 0 cognitive redirect (verified interactive + headless)
- REPL checkpoint detection (10/10 test cases pass)
- SOVEREIGN non-regression (32/32)
- TUI rendering post-integration
- Module lifecycle (apply, getStatus)
- Hook composition with existing hooks
