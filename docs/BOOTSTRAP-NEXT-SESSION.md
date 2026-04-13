# Bootstrap Prompt — Paste This After Compaction

---

Read these files before doing anything else:

1. `docs/ROADMAP.md` — Phase status and what's next
2. `docs/STATE.md` — Current project state

Context: `claude-governance` at `/Users/tom.kyser/dev/claude-code-patches/claude-governance/` — fork of tweakcc, 126KB build, 6/6 SOVEREIGN.

**Completed:** 1a (fork & strip), 1a-gaps (contamination detection, already-applied, dead file cleanup, warning suppression)

Quick verify:
```bash
cd /Users/tom.kyser/dev/claude-code-patches/claude-governance
node dist/index.mjs check
```

**Next phase (unless redirected):** 1a-verification-foundation
- Per-patch signature + anti-signature registry
- Full prompt override verification (all 8, not spot-check)
- Apply state output (~/.claude-governance/state.json)
