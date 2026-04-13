# Phase 1d Handoff — Modular Architecture

Written: 2026-04-12
Status: COMPLETE

## What Was Done

### Module System (`src/modules/`)

Created a pluggable module architecture so users can opt into which governance features they want.

**Module interface** (`types.ts`):
- `GovernanceModule` — id, name, description, required, defaultEnabled
- `verificationEntries` — contributes to binary verification registry
- `apply(context)` — module-specific apply logic
- `getStatus(context)` — health check for `modules` subcommand
- `ModulesConfig` — config.json override map

**Registry** (`registry.ts`):
- `getAllModules()` — returns all registered modules
- `getEnabledModules(config)` — filters by config, required modules always included
- `getVerificationRegistry(config)` — collects verification entries from enabled modules
- `applyModules(context, config)` — runs apply for all enabled modules with apply logic

**Core module** (`core.ts`):
- Wraps existing `VERIFICATION_REGISTRY` (13 entries) as a module
- Required, always enabled
- No custom apply logic — handled by existing `applyCustomization` flow

**Env-flags module** (`env-flags.ts`):
- Optional (default enabled)
- 6 recommended CC env vars: `DISABLE_ADAPTIVE_THINKING`, `MAX_THINKING_TOKENS`, `EFFORT_LEVEL`, `DISABLE_AUTOUPDATER`, `ENABLE_LSP_TOOL`, `EMBEDDED_SEARCH_TOOLS`
- `apply()` reads `~/.claude/settings.json`, merges vars without overriding existing values
- `getStatus()` reports how many vars are set vs missing

### CLI Integration

- **`modules` subcommand**: Lists all modules with enabled/disabled status, health check, verification entry count
- **`--apply` flow**: After patching, runs `applyModules()` for enabled modules. Shows per-module results.
- **`check` flow**: Uses `getVerificationRegistry()` from module system instead of static import
- **`launch` flow**: Same module-driven verification in `handleApplyForLaunch`
- **Config override**: `config.json` `modules` map overrides defaults — `{ "modules": { "env-flags": false } }`

### Verification Refactor

`runVerification()` in `verification.ts` now accepts a registry parameter:
```typescript
export function runVerification(js: string, registry: VerificationEntry[]): CheckResult[]
```
All callers pass `getVerificationRegistry(modulesConfig)` — making the registry dynamic and module-driven.

## Files Changed

| File | Change |
|------|--------|
| `src/modules/types.ts` | NEW — GovernanceModule interface, ModulesConfig |
| `src/modules/core.ts` | NEW — wraps VERIFICATION_REGISTRY as a module |
| `src/modules/env-flags.ts` | NEW — recommended env vars with apply to settings.json |
| `src/modules/registry.ts` | NEW — module discovery, filtering, verification collection |
| `src/modules/index.ts` | NEW — barrel exports |
| `src/verification.ts` | CHANGED — runVerification takes registry parameter |
| `src/index.tsx` | CHANGED — modules subcommand, module apply in --apply, module-driven verification |

## Test Results

| Test | Result |
|------|--------|
| `pnpm build` | 135KB, clean typecheck |
| `check` | 13/13 SOVEREIGN (module-driven registry) |
| `modules` | Core: 13 entries, required. Env-flags: 6/6 vars set |
| `--apply` | Patches applied, env-flags "already set", verified SOVEREIGN |
| Module disable | `{ "modules": { "env-flags": false } }` removes env-flags from flow |

## What's Next

**Phase 1e: CLI & Distribution**
- NPX-runnable: `npx claude-governance apply`
- NPM installable: `npm install -g claude-governance`
- Post-install verification + first-run setup
- First-run setup wizard (what modules do you want?)

## Key Design Decisions

1. **Modules declare verification entries, not verification logic:** Each module contributes `VerificationEntry[]` to the central registry. The verification engine (`runVerification`) is module-agnostic — it just iterates whatever entries it receives.
2. **Config override, not config requirement:** Modules have `defaultEnabled`. Config.json `modules` map overrides defaults. No config = all defaults apply. Zero-config experience.
3. **Env-flags writes to settings.json, not config.json:** The env vars belong in CC's native `~/.claude/settings.json`, not in our config. This means they persist even if claude-governance is uninstalled.
4. **Core module has no apply():** Binary patching is handled by the existing `applyCustomization` flow, not the module system. The core module's role is purely to own verification entries. This avoids double-patching.
