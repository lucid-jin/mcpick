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
  parseError?: string;
}

export async function parseConfig(tool: Tool): Promise<ParsedConfig | null> {
  try {
    await access(tool.configPath);
  } catch {
    return null; // file doesn't exist
  }

  try {
    const content = await readFile(tool.configPath, "utf-8");

    if (tool.format === "json") {
      return parseJsonConfig(content, tool);
    }

    // TOML — read-only support (no write yet)
    return null;
  } catch (err: any) {
    // Return empty config with error info instead of crashing
    console.error(`[mcpicker] Failed to parse ${tool.name} config: ${err.message}`);
    return {
      servers: {},
      raw: {},
      parseError: `Failed to parse: ${err.message}`,
    };
  }
}

function parseJsonConfig(content: string, tool: Tool): ParsedConfig {
  const raw = JSON.parse(content);

  if (!raw || typeof raw !== "object") {
    return { servers: {}, raw: {}, parseError: "Config is not a valid JSON object" };
  }

  const serversSection = raw[tool.serversKey];
  if (!serversSection || typeof serversSection !== "object") {
    return { servers: {}, raw };
  }

  const servers: Record<string, MCPServer> = {};

  for (const [name, config] of Object.entries(serversSection)) {
    if (!config || typeof config !== "object") continue;

    const c = config as Record<string, unknown>;
    servers[name] = {
      type: c.type === "http" || c.url ? "http" : "stdio",
      command: typeof c.command === "string" ? c.command : undefined,
      args: Array.isArray(c.args) ? c.args.map(String) : undefined,
      url: typeof c.url === "string" ? c.url : undefined,
      env: c.env && typeof c.env === "object" ? (c.env as Record<string, string>) : undefined,
      ...Object.fromEntries(
        Object.entries(c).filter(
          ([k]) => !["type", "command", "args", "url", "env"].includes(k)
        )
      ),
    };
  }

  return { servers, raw };
}
