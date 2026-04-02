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
  options: { merge?: boolean } = {}
): Promise<void> {
  let existing: Record<string, unknown> = {};

  try {
    await access(tool.configPath);
    const content = await readFile(tool.configPath, "utf-8");
    existing = JSON.parse(content);
  } catch {
    // file doesn't exist yet
  }

  const existingServers = (existing[tool.serversKey] as Record<string, unknown>) || {};

  // Build output servers
  const outputServers: Record<string, unknown> = options.merge
    ? { ...existingServers }
    : {};

  for (const [name, server] of Object.entries(servers)) {
    outputServers[name] = serializeServer(server, tool);
  }

  // Preserve all non-MCP fields
  const output = { ...existing, [tool.serversKey]: outputServers };

  await mkdir(dirname(tool.configPath), { recursive: true });
  await writeFile(tool.configPath, JSON.stringify(output, null, 2) + "\n", "utf-8");
}

/**
 * Serialize a canonical MCPServer to the format expected by the tool.
 */
function serializeServer(server: MCPServer, tool: Tool): Record<string, unknown> {
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

  // Copy extra fields
  for (const [key, value] of Object.entries(server)) {
    if (!["type", "command", "args", "url", "env"].includes(key) && value !== undefined) {
      result[key] = value;
    }
  }

  return result;
}
