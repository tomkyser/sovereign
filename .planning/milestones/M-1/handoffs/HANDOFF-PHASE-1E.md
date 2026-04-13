# Phase 1e Handoff — CLI & Distribution

Written: 2026-04-12
Status: COMPLETE

## What Was Done

### NPM Packaging

**`files` field** in package.json (replaces `.npmignore`):
- `dist/` — built CLI + lib output (139KB)
- `data/prompts/prompts-2.1.9*.json` + `data/prompts/prompts-2.1.10*.json` — recent prompt data for offline matching
- `scripts/` — postinstall welcome

**Package stats:** 2.2MB compressed, 7.7MB unpacked, 22 files.

Older prompt versions (2.0.x, 2.1.0–2.1.89) are not shipped — the tool downloads them on demand from GitHub via the inherited `systemPromptDownload.ts` pipeline.

### Postinstall Script (`scripts/postinstall.mjs`)

- Lightweight welcome message with next-steps guidance
- Only shows for global installs (`npm_config_global=true`) — silent for library consumers
- Never throws — postinstall failure would block `npm install`

### Setup Wizard (`src/setup.ts`)

Interactive first-run flow:
1. Detect existing config — asks before overwriting
2. Detect CC installation + version
3. Show modules — required modules auto-included, optional modules get Y/n prompt
4. Show configuration summary
5. Confirm, create config dir + `config.json` with module selections
6. Apply governance patches
7. Run module apply (env-flags etc.)
8. Verify — writes state.json
9. Print summary with next steps

**Readline approach:** Line-queue pattern — a single `readline.Interface` captures all `line` events into a queue. The `ask()` function drains from the queue (immediate if data already buffered) or registers a waiter (resolves when next line arrives). This handles both interactive and piped stdin correctly.

### CLI Integration

`setup` subcommand registered in `index.tsx` — `claude-governance setup`.

## Files Changed

| File | Change |
|------|--------|
| `package.json` | ADD `files` field, `postinstall` script |
| `.npmignore` | DELETED (replaced by `files` whitelist) |
| `scripts/postinstall.mjs` | NEW — postinstall welcome message |
| `src/setup.ts` | NEW — first-run setup wizard |
| `src/index.tsx` | ADD `setup` subcommand, import |

## Test Results

| Test | Result |
|------|--------|
| `pnpm build` | 139KB, clean typecheck |
| `check` | 13/13 SOVEREIGN |
| `setup` (fresh config) | CC detected, modules selected, patches applied, SOVEREIGN |
| `setup` (existing config) | Prompts before overwriting |
| `postinstall` (global) | Welcome message with next steps |
| `postinstall` (local) | Silent exit |
| `npm pack --dry-run` | 2.2MB, 22 files |
| `--help` | Shows `setup` in commands list |

## Key Design Decisions

1. **`files` over `.npmignore`:** Whitelist approach — explicitly declare what ships. Prevents accidental inclusion of src/, tests, or config files.
2. **Ship recent prompt data only:** 2.1.90+ covers current users (~1.9MB compressed). Older versions download on demand from GitHub. Keeps package under 3MB.
3. **Line-queue readline:** Avoids the classic piped-stdin bug where `readline.question()` drops buffered lines. Events are captured immediately, consumed on demand.
4. **Postinstall is suggestion-only:** No automatic patching on install — too risky. Just points to `setup` and `apply`.
5. **Setup writes to CC's config dir:** Module selections go to `~/.claude-governance/config.json`. Env vars go to `~/.claude/settings.json` (via env-flags module). Each lives where it belongs.

## What's Next

Phase 1e completes Milestone 1 (Core Engine). Next milestone:
- **Phase 2a:** Tool Injection Mechanism — patch `getAllBaseTools()` to load external tool definitions
- **Phase 2b:** Clean-Room REPL — Node VM with persistent context
- **Phase 2c:** Clean-Room Tungsten — tmux session management

### Phase 1 Milestone Retro Items (evaluate before starting M-2)
- Canary prompts — inject test phrases, verify via model response
- Verification dashboard — rich terminal overview of all governance state
