import { readFile, writeFile, access, mkdir } from "fs/promises";
import { dirname } from "path";
import TOML from "@iarna/toml";
import type { Tool } from "../registry/tools";
import type { MCPServer } from "./parser";

export async function writeConfig(
  tool: Tool,
  servers: Record<string, MCPServer>,
  options: { merge?: boolean; rawBase?: Record<string, unknown> } = {}
): Promise<void> {
  if (tool.format === "toml") {
    return writeTomlConfig(tool, servers, options);
  }

  return writeJsonConfig(tool, servers, options);
}

async function writeJsonConfig(
  tool: Tool,
  servers: Record<string, MCPServer>,
  options: { merge?: boolean; rawBase?: Record<string, unknown> }
): Promise<void> {
  let existing: Record<string, unknown> = options.rawBase || {};

  if (!options.rawBase) {
    try {
      await access(tool.configPath);
      const content = await readFile(tool.configPath, "utf-8");
      existing = JSON.parse(content);
    } catch { /* start fresh */ }
  }

  const existingServers = (existing[tool.serversKey] as Record<string, unknown>) || {};
  const outputServers: Record<string, unknown> = options.merge ? { ...existingServers } : {};

  for (const [name, server] of Object.entries(servers)) {
    outputServers[name] = serializeJsonServer(server);
  }

  const output = { ...existing, [tool.serversKey]: outputServers };

  await mkdir(dirname(tool.configPath), { recursive: true });
  await writeFile(tool.configPath, JSON.stringify(output, null, 2) + "\n", "utf-8");
}

async function writeTomlConfig(
  tool: Tool,
  servers: Record<string, MCPServer>,
  options: { merge?: boolean; rawBase?: Record<string, unknown> }
): Promise<void> {
  let existing: Record<string, unknown> = options.rawBase || {};

  if (!options.rawBase) {
    try {
      await access(tool.configPath);
      const content = await readFile(tool.configPath, "utf-8");
      existing = TOML.parse(content) as Record<string, unknown>;
    } catch { /* start fresh */ }
  }

  const existingServers = (existing[tool.serversKey] as Record<string, unknown>) || {};
  const outputServers: Record<string, unknown> = options.merge ? { ...existingServers } : {};

  for (const [name, server] of Object.entries(servers)) {
    outputServers[name] = serializeTomlServer(server);
  }

  const output = { ...existing, [tool.serversKey]: outputServers };

  await mkdir(dirname(tool.configPath), { recursive: true });
  await writeFile(tool.configPath, TOML.stringify(output as any), "utf-8");
}

function serializeJsonServer(server: MCPServer): Record<string, unknown> {
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

function serializeTomlServer(server: MCPServer): Record<string, unknown> {
  const isWin = process.platform === "win32";
  const command = server.command || "npx";
  const args = server.args || [];

  // Codex on Windows needs cmd /c wrapper
  const finalCommand = isWin ? "cmd" : command;
  const finalArgs = isWin ? ["/c", command, ...args] : args;

  // Ensure -y for npx
  if (command === "npx" && !finalArgs.includes("-y")) {
    finalArgs.unshift("-y");
  }

  const result: Record<string, unknown> = {
    command: finalCommand,
    args: finalArgs,
    env: server.env || {},
    startup_timeout_ms: 60000,
  };

  return result;
}
