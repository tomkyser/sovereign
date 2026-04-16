# Milestone 3.5 Bootstrap — Wire Inter-Session Communication

---

**Status:** BLOCKED — Repack crash. Fix path identified: ESM→CJS transform via esbuild.
**Baseline:** 24/24 SOVEREIGN working, 27/27 SOVEREIGN patched-but-broken
**Blocking Issue:** npm cli.js is ESM; Bun binary requires CJS wrapper; need ESM→CJS bundling

## CRITICAL: Read This First

1. `.planning/journals/session-2026-04-16-f.md` — **COMPLETE root cause analysis + fix spec + verified working components**
2. `.planning/journals/session-2026-04-16-e.md` — Earlier investigation (bytecode discovery)
3. `claude-governance/src/patches/index.ts` — Main apply pipeline (needs fetchNpmSource + detection)
4. `claude-governance/src/nativeInstallation.ts` — rebuildBunData + repackMachO (needs clearBytecode + raw overwrite)

## Current State

- **Binary**: Unpatched 2.1.101 (restored from backup)
- **Shim**: Bypassed — `~/.claude-governance/bin/claude.bak`
- **Code**: HEAD at f5e0c7f, clean working tree
- **Thinking patches**: 27/27 SOVEREIGN verified against extracted JS, repack blocked

## The Problem (Three Layers)

1. **Bun bytecode**: Binary stores `cli.js` as bytecode stubs, not readable JS. Can't interpret after repack.
2. **npm source is ESM**: `cli.js` has 753 static imports, 67 default imports, 12 import.meta, 6 top-level await
3. **CJS wrapper required**: Bun binary format needs `(function(exports, require, module, __filename, __dirname){...})` — ESM syntax invalid inside

## The Fix: ESM → CJS via esbuild

### Implementation Plan (3 files, ~60 lines of new code)

#### File 1: `claude-governance/src/patches/index.ts`
1. Add `import { execFileSync } from 'node:child_process'`
2. Add `fetchNpmSource(version)` function (downloads npm package, extracts cli.js, **runs esbuild to convert ESM→CJS**, returns CJS buffer)
3. Add `let clearBytecode = false` after `let content: string`
4. After extraction: detect `// @bun @bytecode` prefix → call fetchNpmSource → strip shebang → CJS-wrap → set clearBytecode=true
5. Pass `clearBytecode` to `repackNativeInstallation()`

The esbuild transform goes inside fetchNpmSource:
```bash
npx esbuild cli.js --bundle --format=cjs --platform=node --outfile=cli.cjs
```

#### File 2: `claude-governance/src/nativeInstallation.ts`
1. Add `clearBytecode: boolean` param to `rebuildBunData()`
2. When clearBytecode + claude module: set `bytecodeBytes = Buffer.alloc(0)`, `encoding = 0`
3. Add `clearBytecode = false` param to `repackNativeInstallation()`, thread to rebuildBunData
4. Add raw overwrite path in `repackMachO()` for when new data ≤ original section size (18MB << 128MB)

#### File 3: `claude-governance/src/nativeInstallationLoader.ts`
1. Add `clearBytecode = false` param to `repackNativeInstallation()` wrapper, thread to module call

### Key Technical Notes
- **LIEF bug**: `bunSection.content = newData` is silently ignored without `extendSegment()`. Use raw overwrite.
- **Raw overwrite**: Read binary, `newSectionData.copy(binaryData, segmentFileOffset)`, zero-fill remaining, write+resign
- **esbuild handles**: static imports → require(), import.meta.url → __filename equiv, top-level await
- **Encoding=0**: Tell Bun to interpret source, not look for bytecode
- **Only module 0** (cli.js) has bytecode (111MB). Other 10 modules have bcLen=0.

## Build & Verify
```bash
cd claude-governance && pnpm build
/bin/cp ~/.claude-governance/native-binary.backup ~/.local/share/claude/versions/2.1.101
node claude-governance/dist/index.mjs -a
~/.local/share/claude/versions/2.1.101 --version   # Must show "2.1.101 (Claude Code)"
node claude-governance/dist/index.mjs check         # Target: 25/27+ SOVEREIGN
```

## After Fix, Continue P1
- T11: Interactive TUI verification of thinking blocks
- Gap analysis for P1
- Housekeeping + bootstrap for P2
