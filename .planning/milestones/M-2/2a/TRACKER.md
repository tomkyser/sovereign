# Phase 2a Tracker — Tool Injection Mechanism

Status: COMPLETE
Started: 2026-04-12

## Scope

Patch the CC binary's tool registry to load external tool definitions from `~/.claude-governance/tools/`. This is the foundation for injecting REPL, Tungsten, and future custom tools.

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Research — locate tool registry in minified JS, understand schema | In Progress |
| 2 | Design — injection patch, tool loader, hot-reload, verification | Complete |
| 3 | Implement — patch, loader, module integration | Complete |
| 4 | Verify + test — registration proof, hot-reload test | Complete |
| 5 | Phase docs | Complete |

## Research Questions

- Where is `getAllBaseTools()` in the minified JS? What's its minified name?
- What's the AgentTool/Tool interface shape?
- How are tools gated (USER_TYPE, isInternal)?
- What schema format do tool parameters use?
- Where do tool handlers execute?

## Design Notes

*To be filled after research completes.*
