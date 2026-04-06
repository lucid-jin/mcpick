# mcpicker

> Pick and sync MCP server configs across AI tools.

Sync MCP server configurations between Claude Code, Claude Desktop, Cursor, Codex, Gemini CLI, and Copilot CLI. Automatically handles HTTP-to-mcp-remote conversion, JSON/TOML format translation, and path resolution.

## Install

```bash
# Run directly from GitHub (no install needed)
npx github:lucid-jin/mcpick list
npx github:lucid-jin/mcpick sync
npx github:lucid-jin/mcpick dashboard

# Or clone and run locally
git clone https://github.com/lucid-jin/mcpick
cd mcpick && bun install && bun run build
node dist/index.js list
```

## Commands

### `mcpicker list`

Scan all installed AI tools and show MCP server configs.

```bash
mcpicker list           # table output
mcpicker list --json    # JSON output
mcpicker list -v        # verbose (show env, args)
```

### `mcpicker sync`

Sync MCP servers between tools. Interactive or direct mode.

```bash
# Interactive (guided step-by-step)
mcpicker sync

# Direct
mcpicker sync claude-code claude-desktop
mcpicker sync claude-code codex --pick chrome-devtools
mcpicker sync claude-code cursor --pick sentry,clickhouse
mcpicker sync claude-code claude-desktop --dry-run
```

### `mcpicker doctor`

Validate MCP configs and detect issues.

```bash
mcpicker doctor              # scan all tools
mcpicker doctor --fix        # auto-fix issues
mcpicker doctor claude-desktop   # specific tool
```

### `mcpicker dashboard`

Web UI for visual MCP management with drag-and-drop sync.

```bash
mcpicker dashboard           # opens http://127.0.0.1:4747
mcpicker ui                  # alias
mcpicker dashboard -p 8080   # custom port
```

## Supported Tools

| Tool | Config Format | HTTP Support | Read | Write |
|------|--------------|--------------|------|-------|
| Claude Code | JSON | Yes | Yes | Yes |
| Claude Desktop | JSON | No (auto mcp-remote) | Yes | Yes |
| Cursor | JSON | Yes | Yes | Yes |
| Codex | TOML | No | Yes | Yes |
| Gemini CLI | JSON | Yes | Yes | Yes |
| Copilot CLI | JSON | Yes | Yes | Yes |

## Key Features

- **HTTP auto-conversion**: HTTP servers automatically wrapped with `mcp-remote` for tools that don't support HTTP
- **JSON/TOML translation**: Sync between JSON and TOML configs (Codex support)
- **Bidirectional sync**: Sync in any direction between any supported tools
- **Selective sync**: Pick specific servers with `--pick`
- **Web dashboard**: Drag-and-drop MCP sync at localhost:4747
- **Backup**: Auto-backup before any write operation (`~/.mcpick/backup/`)
- **Doctor**: Detect misconfigurations and auto-fix
- **Security**: CSRF protection, localhost-only binding, no wildcard CORS

## License

MIT
