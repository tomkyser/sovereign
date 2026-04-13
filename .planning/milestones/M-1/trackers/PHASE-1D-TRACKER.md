# Phase 1d Tracker — Modular Architecture

Status: IN PROGRESS
Started: 2026-04-12

## Scope

Create a module system so users can opt into which governance features they want. Core patching is required; env-flags, hooks integration are optional. Verification registry becomes module-driven.

## Tasks

| # | Task | Status |
|---|------|--------|
| 1 | Module interface + registry (`src/modules/`) | Pending |
| 2 | Core module — wraps existing governance patches + prompts as a module | Pending |
| 3 | Env-flags module — recommended CC env vars with apply to settings.json | Pending |
| 4 | Integrate modules into CLI (check, apply, launch use module registry) | Pending |
| 5 | Build, verify, test | Pending |
| 6 | Phase docs | Pending |

## Design

**Module interface:**
- `id`, `name`, `description`, `required`, `defaultEnabled`
- `verificationEntries` — contribute to binary verification registry
- `apply(context)` — module-specific apply logic
- `getStatus()` — check module health

**Registry:**
- Static list of all modules
- Config.json `modules` map overrides defaults
- `getEnabledModules()` filters by config
- `getVerificationRegistry()` collects entries from enabled modules

**Modules:**
- `core` — required, wraps VERIFICATION_REGISTRY from governance.ts
- `env-flags` — optional (default on), writes recommended env vars to ~/.claude/settings.json
