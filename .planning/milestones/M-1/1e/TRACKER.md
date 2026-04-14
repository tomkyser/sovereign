# Phase 1e Tracker — CLI & Distribution

Status: COMPLETE
Started: 2026-04-12

## Scope

Make claude-governance npx-runnable and npm-installable. Add postinstall welcome, first-run setup wizard, and ensure the npm package includes all runtime data.

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Package config — `files` field, delete `.npmignore`, postinstall script | Complete |
| 2 | Setup wizard — `src/setup.ts` with interactive module selection | Complete |
| 3 | CLI integration — add `setup` subcommand to `src/index.tsx` | Complete |
| 4 | Build, verify, test — pnpm build, npm pack inspect, setup flow test | Complete |
| 5 | Phase docs — handoff, roadmap, state, context, bootstrap | Complete |

## Design

**Package (`files` field):**
- `dist/` — built output (CLI + lib)
- `data/` — prompt JSON files for version matching
- `scripts/` — postinstall welcome

**Postinstall (`scripts/postinstall.mjs`):**
- Lightweight welcome message + next-steps guidance
- Never throws (postinstall failure = install failure)
- Suggests `setup` for first-run, `apply` for immediate use

**Setup wizard (`src/setup.ts`):**
- Detect CC installation + version
- Detect first-run (no config dir or config.json)
- Interactive module selection via readline
- Create `~/.claude-governance/`, write config.json
- Run apply + verify
- Print summary with next steps

**CLI changes:**
- `setup` subcommand wired into index.tsx
- Postinstall script in package.json scripts

## Files (5)

| File | Change |
|------|--------|
| `package.json` | Add `files`, `postinstall` script, version |
| `.npmignore` | DELETE (replaced by `files` whitelist) |
| `scripts/postinstall.mjs` | NEW — postinstall welcome |
| `src/setup.ts` | NEW — first-run setup wizard |
| `src/index.tsx` | ADD `setup` subcommand |
