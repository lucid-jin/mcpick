import { readFile, access } from "fs/promises";
import type { Tool } from "../registry/tools";

export interface MCPServer {
  type: "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  [key: string]: unknown;
}

export interface ParsedConfig {
  servers: Record<string, MCPServer>;
  raw: Record<string, unknown>;
}

export async function parseConfig(tool: Tool): Promise<ParsedConfig | null> {
  try {
    await access(tool.configPath);
  } catch {
    return null;
  }

  const content = await readFile(tool.configPath, "utf-8");

  if (tool.format === "json") {
    return parseJsonConfig(content, tool);
  }

  // TOML (Codex) — coming later
  return null;
}

function parseJsonConfig(content: string, tool: Tool): ParsedConfig {
  const raw = JSON.parse(content);
  const serversSection = raw[tool.serversKey] || {};
  const servers: Record<string, MCPServer> = {};

  for (const [name, config] of Object.entries(serversSection)) {
    const c = config as Record<string, unknown>;
    servers[name] = {
      type: c.type === "http" || c.url ? "http" : "stdio",
      command: c.command as string | undefined,
      args: c.args as string[] | undefined,
      url: c.url as string | undefined,
      env: c.env as Record<string, string> | undefined,
      ...Object.fromEntries(
        Object.entries(c).filter(
          ([k]) => !["type", "command", "args", "url", "env"].includes(k)
        )
      ),
    };
  }

  return { servers, raw };
}
