import { readFile, writeFile, access, mkdir } from "fs/promises";
import { dirname } from "path";
import type { Tool } from "../registry/tools";
import type { MCPServer } from "./parser";

/**
 * Write servers to a tool's config file.
 * Preserves existing non-MCP fields.
 */
export async function writeConfig(
  tool: Tool,
  servers: Record<string, MCPServer>,
  options: { merge?: boolean; rawBase?: Record<string, unknown> } = {}
): Promise<void> {
  // Guard: refuse to write TOML
  if (tool.format === "toml") {
    throw new Error(`TOML write not supported for ${tool.name}. Codex sync coming soon.`);
  }

  let existing: Record<string, unknown> = options.rawBase || {};

  if (!options.rawBase) {
    try {
      await access(tool.configPath);
      const content = await readFile(tool.configPath, "utf-8");
      existing = JSON.parse(content);
    } catch {
      // file doesn't exist or is invalid — start fresh
    }
  }

  const existingServers = (existing[tool.serversKey] as Record<string, unknown>) || {};

  const outputServers: Record<string, unknown> = options.merge
    ? { ...existingServers }
    : {};

  for (const [name, server] of Object.entries(servers)) {
    outputServers[name] = serializeServer(server);
  }

  const output = { ...existing, [tool.serversKey]: outputServers };

  await mkdir(dirname(tool.configPath), { recursive: true });
  await writeFile(tool.configPath, JSON.stringify(output, null, 2) + "\n", "utf-8");
}

function serializeServer(server: MCPServer): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (server.type === "http" && server.url) {
    result.type = "http";
    result.url = server.url;
  } else {
    if (server.command) result.command = server.command;
    if (server.args && server.args.length > 0) result.args = server.args;
  }

  if (server.env && Object.keys(server.env).length > 0) {
    result.env = server.env;
  }

  for (const [key, value] of Object.entries(server)) {
    if (!["type", "command", "args", "url", "env"].includes(key) && value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}
