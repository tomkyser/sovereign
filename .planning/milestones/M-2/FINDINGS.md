# Milestone 2 Findings

See `.planning/FINDINGS.md` F1-F21 for all findings discovered during M-2 phases.

## Key Findings by Phase

| ID | Phase | Summary |
|----|-------|---------|
| F1 | 2b planning | ToolUseContext exposes full tool registry — eliminates Option A |
| F2 | 2b planning | Ant REPL prompt handling — replaces "Using your tools" section |
| F9 | 2b planning | REPLTool.ts not in leaked source — confirms clean-room |
| F10 | 2b planning | Tool.call() return shapes — delegation contracts |
| F11 | 2b planning | Tool call delegation pattern confirmed |
| F12 | 2b impl | "Using Your Tools" is runtime-generated, not patchable via data |
| F13 | 2b gaps | Replace mode requires tool stashing |
| F14 | 2b gaps | VM SyntaxError crosses realms — instanceof fails |
| F15 | 2b gaps | IIFE wrapping kills variable persistence |
| F16 | 2b gaps | WebFetch returns AI-processed content, not raw HTTP |
| F17 | 2b-gaps | parentMessage is load-bearing for tool delegation |
| F18 | 2b-gaps-2 | Bash tool shell snapshot shadows find/grep with embedded tools |
| F19 | 2c research | FS9() is stubbed getClaudeTmuxEnv — bashProvider plumbing intact |
| F20 | 2c research | TungstenLiveMonitor DCE left render tree marker |
| F21 | 2c research | All Tungsten AppState fields survive as writable |
