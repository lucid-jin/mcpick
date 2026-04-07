import { homedir } from "os";
import { join } from "path";

export interface Tool {
  id: string;
  name: string;
  format: "json" | "toml";
  httpSupport: boolean;
  serversKey: string;
  configPath: string;
  keywords: string[];
  httpUrlField?: string; // "url" (default) or "serverUrl" (AntiGravity)
  requireAbsolutePaths?: boolean; // AntiGravity requires absolute paths
}

function home(...segments: string[]): string {
  return join(homedir(), ...segments);
}

function appdata(...segments: string[]): string {
  if (process.platform === "win32") {
    return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), ...segments);
  }
  return home(...segments);
}

export function getTools(): Tool[] {
  const isWin = process.platform === "win32";
  const isMac = process.platform === "darwin";

  return [
    {
      id: "claude-code",
      name: "Claude Code",
      format: "json",
      httpSupport: true,
      serversKey: "mcpServers",
      configPath: home(".claude", "settings.json"),
      keywords: ["claude", "claude-code", "anthropic"],
    },
    {
      id: "claude-mcp",
      name: "Claude Code (.mcp.json)",
      format: "json",
      httpSupport: true,
      serversKey: "mcpServers",
      configPath: home(".claude", ".mcp.json"),
      keywords: ["claude-mcp"],
    },
    {
      id: "claude-desktop",
      name: "Claude Desktop",
      format: "json",
      httpSupport: false,
      serversKey: "mcpServers",
      configPath: isMac
        ? home("Library", "Application Support", "Claude", "claude_desktop_config.json")
        : isWin
          ? appdata("Claude", "claude_desktop_config.json")
          : home(".config", "Claude", "claude_desktop_config.json"),
      keywords: ["claude-desktop", "desktop"],
    },
    {
      id: "codex",
      name: "Codex",
      format: "toml",
      httpSupport: false,
      serversKey: "mcp_servers",
      configPath: home(".codex", "config.toml"),
      keywords: ["codex", "openai"],
    },
    {
      id: "cursor",
      name: "Cursor",
      format: "json",
      httpSupport: true,
      serversKey: "mcpServers",
      configPath: isWin
        ? appdata("Cursor", "mcp.json")
        : home(".cursor", "mcp.json"),
      keywords: ["cursor"],
    },
    {
      id: "gemini",
      name: "Gemini CLI",
      format: "json",
      httpSupport: true,
      serversKey: "mcpServers",
      configPath: isWin
        ? appdata(".gemini", "settings.json")
        : home(".gemini", "settings.json"),
      keywords: ["gemini", "google"],
    },
    {
      id: "copilot",
      name: "GitHub Copilot CLI",
      format: "json",
      httpSupport: true,
      serversKey: "mcpServers",
      configPath: home(".copilot", "mcp-config.json"),
      keywords: ["copilot", "github", "gh"],
    },
    {
      id: "antigravity",
      name: "AntiGravity",
      format: "json",
      httpSupport: true,
      serversKey: "mcpServers",
      configPath: home(".gemini", "antigravity", "mcp_config.json"),
      keywords: ["antigravity", "anti-gravity", "google-antigravity", "ag"],
      httpUrlField: "serverUrl",
      requireAbsolutePaths: true,
    },
    {
      id: "openclaw",
      name: "OpenClaw",
      format: "json",
      httpSupport: false,
      serversKey: "mcp.servers",
      configPath: home(".openclaw", "openclaw.json"),
      keywords: ["openclaw", "claw", "lobster"],
    },
  ];
}

export function findTool(keyword: string): Tool | undefined {
  const normalized = keyword.trim().toLowerCase();
  return getTools().find(
    (t) =>
      t.id === normalized ||
      t.name.toLowerCase() === normalized ||
      t.keywords.some((k) => k === normalized)
  );
}
