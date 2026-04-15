```
claude-governance/       # The product — fork of tweakcc, governance-only (170KB build)
  data/overrides/        # 9 degradation-fix prompt override .md files
  data/tools/            # Deployed tool implementations (Ping, REPL, Tungsten)
  data/ui/               # UI components (tungsten-panel.js)

~/.claude/hooks/         # Session hooks (governance verify, embedded tools verify, statusline)
~/.claude/settings.json  # Env vars (EMBEDDED_SEARCH_TOOLS, ENABLE_LSP_TOOL, etc.)
~/.claude-governance/    # Config dir (config.json, system-prompts/, backup)
```
