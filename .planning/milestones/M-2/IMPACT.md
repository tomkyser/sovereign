# Milestone 2 Impact — Native Tool Injection

## Milestone Scope

Clean-room implementations of ant-only tools (REPL, Tungsten), injected into CC's
tool registry via binary patching. Users get the tools that Anthropic restricts to
internal use.

## References

- [tweakcc1] — Fork source (binary patching infrastructure)
- [haseebAnalysis1] — Ant vs external divergence analysis
- [ptcDocs1] — Programmatic tool calling docs (M4 research)
- [advancedToolUse1] — Advanced tool use patterns
- [replScratchpad1] — REPL scratchpad project reference

## Phase Impact

| Phase | Key Impact |
|-------|-----------|
| 2a | Tool injection patch, external tool loader, transparent shim |
| 2a-gaps | Binary vault, Zod passthrough, shim failsafe, 15/15 SOVEREIGN |
| 2b | Clean-room REPL: VM, 9 handlers, coexist/replace modes |
| 2b-gaps | 14/14 hardening: probes, validation, handler fixes, execution semantics |
| 2b-gaps-2 | Production readiness: embedded search confirmed, prompt effectiveness |
| 2b-gaps-3 | Coexist hardening: glob .gitignore, mode-aware prompts, replace verified |
| 2c | Clean-room Tungsten: 6 deliverables, FS9 patch, panel injection, 19/19 SOVEREIGN |
| 2c-gaps-1 | Panel crash fix, restore/apply vault wiring, verification honesty, FS9 verified, tungsten.js robustness, 19/19 SOVEREIGN. All live testing passed. |
| 2-PM-update | PM restructuring + rename: REFERENCES.md, per-phase dirs, lifecycle updates, project → claude-governance |

## Cross-Milestone Discoveries

- Tungsten enables Claude-spawning-Claude in persistent sessions (inception test — 3 nested SOVEREIGN instances verified)
- Operator pattern demonstrated: Claude managing server + monitor + client across 3 concurrent Tungsten sessions
- Wire (dynamo project) replaces UDS Sockets at M-4.5 — uses CC's native Channels API for structured inter-session communication, architecturally superior to Anthropic's UDS Inbox
- Combined Tungsten + Wire + REPL + Tool Injection = distributed agent platform infrastructure
