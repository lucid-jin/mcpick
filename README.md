# mcpicker

> Pick and sync MCP server configs across AI tools.

Sync MCP server configurations between Claude Code, Claude Desktop, Cursor, Codex, Gemini CLI, and Copilot CLI. Automatically handles HTTP-to-mcp-remote conversion, path resolution, and format differences.

## Install

```bash
# Run directly
npx mcpicker list
bunx mcpicker list

# Global install
npm install -g mcpicker
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

## Supported Tools

| Tool | Config Format | HTTP Support |
|------|--------------|--------------|
| Claude Code | JSON | Yes |
| Claude Desktop | JSON | No (auto-converts via mcp-remote) |
| Cursor | JSON | Yes |
| Codex | TOML | No |
| Gemini CLI | JSON | Yes |
| Copilot CLI | JSON | Yes |

## Key Features

- **HTTP auto-conversion**: HTTP servers automatically wrapped with `mcp-remote` for tools that don't support HTTP
- **Bidirectional sync**: Sync in any direction between any supported tools
- **Selective sync**: Pick specific servers with `--pick`
- **Backup**: Auto-backup before any write operation
- **Doctor**: Detect misconfigurations and auto-fix

## License

MIT
