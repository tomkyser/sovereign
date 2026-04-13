# Phase 2b Tracker — Clean-Room REPL

Status: PENDING
Started: —

## Scope

Implement a clean-room REPL tool (Node.js VM with persistent context) that plugs into the Phase 2a tool injection mechanism. Users get batch JS execution with inner tool handlers for file I/O, shell, and grep/glob.

## Design Spec

`/Users/tom.kyser/dev/claude-code-patches/specs/repl-clean-room.md`

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Implement REPL tool definition (matches injection contract) | Pending |
| 2 | Node VM sandbox — persistent context, timeout, result serialization | Pending |
| 3 | Inner tool handlers — read, write, edit, bash, grep, glob, fetch | Pending |
| 4 | Operation tracking via Proxy | Pending |
| 5 | Safety — blocked paths, traversal prevention, size limits | Pending |
| 6 | Deploy to ~/.claude-governance/tools/, test in live CC session | Pending |
| 7 | Phase docs | Pending |

## Tool Contract (from 2a)

```javascript
{
  name: 'REPL',
  inputJSONSchema: {
    type: 'object',
    properties: {
      script: { type: 'string', description: 'JavaScript code to execute' },
      description: { type: 'string', description: 'Brief description of the script' },
    },
    required: ['script'],
  },
  async prompt() { return '...' },
  async description() { return '...' },
  async call(args, context) { return { data: { success, result, operations, stdout, stderr, duration } } },
}
```

## Key Decisions (from spec)

- **Phase 1 handlers:** Direct fs/child_process (Option A), not CC internal tool handlers
- **Persistence:** VM context survives across REPL calls within a session
- **Coexistence:** REPL supplements primitive tools (Bash/Read/Edit stay available)
- **Safety:** Blocked paths (.env, .ssh, .git), execFile not exec, per-script timeout
