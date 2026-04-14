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
