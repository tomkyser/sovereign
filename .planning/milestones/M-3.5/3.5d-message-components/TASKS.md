# Phase 3.5d Tasks — Message Components Control

Status: P2 COMPLETE + bugfixes (29/29 SOVEREIGN). Phase steps 4-6 done. P3 next session.

---

## P0: Tool Visibility — COMPLETE
- [x] T1-T6: All tool visibility tasks complete and verified in live TUI

## P1: Thinking Restoration — COMPLETE
- [x] T7-T11: All thinking patches + TUI verification

## P1.5: Binary Patch Pattern Migration — COMPLETE
- [x] T25-T32: 13 patterns migrated + explore fix

## P2: Override System — COMPLETE
- [x] T12-T16: Override registry + binary injection + deploy pipeline + verification

## Verification — COMPLETE
- [x] T21-T23: Registry, SOVEREIGN 29/29, interactive TUI verified

## Post-Verification Bugfixes — COMPLETE
- [x] F33: Tool userFacingName returns proper names (Ping/REPL/Tungsten)
- [x] F34: React refs use _govR.default||_govR for esbuild CJS createElement resolution
- [x] Replace mode verified working (primitives filtered, REPL-only)
- [x] REPL tool call renders visibly in TUI (user confirmed)

## P3: User Customization — INCOMPLETE (gap phase required)
- [x] T17: Component directory loading (~/.claude-governance/components/)
- [ ] ~~T18: Default component overrides~~ **MARKED IN ERROR** — skeleton only, zero tested overrides
- [x] T19: Unhide hidden commands patch (30/30 SOVEREIGN, TUI verified)
- [ ] ~~T20: Component override API docs~~ **MARKED IN ERROR** — handler signature unverified against binary
- [x] T21: Unhide Commands added to verification registry

## P3-GAP: Component Override Verification
> Remediation phase. P3 tasks T18/T20 were rubber-stamped without behavioral testing.
> The override system pipeline exists but has never rendered a single user-defined
> component in the TUI. This gap phase exists because of sloppy verification.

- [ ] T18a: Verify handler signature — read binary injection code, confirm args passed to handlers
- [ ] T18b: Write a real component override (e.g., custom thinking block render)
- [ ] T18c: End-to-end test: drop .js in components/, launch TUI, confirm it renders
- [ ] T18d: Ship verified default overrides in data/components/ (replace skeleton)
- [ ] T20a: Verify and correct docs/README.md Component Override API against tested behavior
- [ ] T20b: Document update resilience — what survives CC updates, what needs re-apply