# Phase 3.5d Context — Message Components Control

Date: 2026-04-16
Status: ALL PHASES COMPLETE (P0-P3) — 30/30 SOVEREIGN
Previous: P2 Override System COMPLETE (29/29 SOVEREIGN)

## Scope
Complete user-facing customization layer for message component overrides.

## P3 Deliverables
1. T17: Component directory loading (~/.claude-governance/components/)
2. T18: Default component overrides shipped in data/components/
3. T19: Unhide hidden commands patch
4. T20: Documentation for component override API

## Architecture
- Override system: globalThis.__govMessageOverrides + __govContentOverrides (P2)
- Deploy pipeline: deploy.ts — deployTools/deployUiComponents/deployOverrides pattern
- Binary patch loads defaults.js lazily on first render
- defaults.js must be extended to scan and require components/ directory
- Handler signature: (message/block, props, React) → element | null

## Key Binary Locations (v2.1.101 esbuild)
- isHidden filters: idx 13610517, 15735658, 15738415, 15739461
- Message override injection: oOY() switch statement
- Content override injection: sOY() switch statement

## Decisions
- D-01 through D-05 from P2 carry forward
- D-06: Components loaded from defaults.js (already in binary require chain)
- D-07: isHidden patch targets filter predicates, not command objects
