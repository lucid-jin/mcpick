import type { Tool } from "../registry/tools";
import type { MCPServer } from "./parser";

export interface AdaptResult {
  server: MCPServer;
  changed: boolean;
  changeType: "none" | "http-to-mcp-remote" | "mcp-remote-to-http" | "path-resolved";
  description?: string;
  warnings?: string[];
}

/**
 * Adapt a server config for the target tool.
 * Handles HTTP↔stdio conversion and path resolution.
 */
export function adaptServer(
  name: string,
  server: MCPServer,
  sourceTool: Tool,
  targetTool: Tool
): AdaptResult {
  let result = { ...server };
  let changed = false;
  let changeType: AdaptResult["changeType"] = "none";
  let description: string | undefined;
  const warnings: string[] = [];

  // 1. HTTP → mcp-remote (target doesn't support HTTP)
  if (server.type === "http" && !targetTool.httpSupport) {
    const url = server.url;
    if (url) {
      result = {
        type: "stdio",
        command: "npx",
        args: ["-y", "mcp-remote", url],
        env: server.env,
      };
      changed = true;
      changeType = "http-to-mcp-remote";
      description = `http → mcp-remote (${url})`;
    }
  }

  // 2. mcp-remote → HTTP (target supports HTTP, source was wrapped)
  if (
    server.type === "stdio" &&
    targetTool.httpSupport &&
    isMcpRemoteWrapper(server)
  ) {
    const url = extractMcpRemoteUrl(server);
    if (url) {
      result = {
        type: "http",
        url,
        env: server.env,
      };
      changed = true;
      changeType = "mcp-remote-to-http";
      description = `mcp-remote → http (${url})`;
    }
  }

  // 3. OpenClaw-specific defensive checks
  if (targetTool.id === "openclaw") {
    // OAuth is not supported — detect common OAuth patterns
    if (
      server.headers &&
      typeof server.headers === "object" &&
      hasOAuthHeader(server.headers as Record<string, string>)
    ) {
      warnings.push("OpenClaw does not support OAuth authentication — OAuth headers will be ignored");
    }

    // headers field is accepted in config but not processed at runtime
    if (server.headers && typeof server.headers === "object") {
      warnings.push("OpenClaw ignores the 'headers' field — HTTP headers will not be sent");
      // Strip headers from the output since they won't work
      const { headers, ...rest } = result;
      result = rest as MCPServer;
      changed = true;
    }

    // transport field (sse/streamable-http) not supported
    if (server.transport) {
      warnings.push(`OpenClaw does not support '${server.transport}' transport — only stdio works`);
    }
  }

  // 4. AntiGravity: enforce absolute paths
  if (targetTool.requireAbsolutePaths) {
    // Check command path
    if (result.command && !result.command.startsWith("/") && !result.command.startsWith("C:\\") && !isWellKnownCommand(result.command)) {
      warnings.push(`${targetTool.name} requires absolute paths — "${result.command}" may not work`);
    }
    // Check args for relative paths
    if (result.args) {
      for (const arg of result.args) {
        if (arg.startsWith("./") || arg.startsWith("../")) {
          warnings.push(`${targetTool.name} requires absolute paths — relative arg "${arg}" may not work`);
        }
      }
    }
    // Check env for relative file paths
    if (result.env) {
      for (const [key, value] of Object.entries(result.env)) {
        if (typeof value === "string" && (value.startsWith("./") || value.startsWith("../"))) {
          warnings.push(`${targetTool.name} requires absolute paths — ${key}="${value}" is relative`);
        }
      }
    }
  }

  return { server: result, changed, changeType, description, warnings: warnings.length > 0 ? warnings : undefined };
}

function isWellKnownCommand(cmd: string): boolean {
  const known = ["node", "npx", "python", "python3", "uvx", "bun", "bunx", "deno", "cmd"];
  return known.includes(cmd.toLowerCase());
}

/**
 * Check if headers contain OAuth-related values.
 */
function hasOAuthHeader(headers: Record<string, string>): boolean {
  for (const [key, value] of Object.entries(headers)) {
    const k = key.toLowerCase();
    const v = typeof value === "string" ? value.toLowerCase() : "";
    if (k === "authorization" && (v.includes("bearer") || v.includes("oauth"))) return true;
    if (k.includes("oauth") || k.includes("token")) return true;
  }
  return false;
}

/**
 * Check if a server config is a mcp-remote wrapper.
 */
function isMcpRemoteWrapper(server: MCPServer): boolean {
  if (!server.args) return false;
  return server.args.some((arg) => arg === "mcp-remote");
}

/**
 * Extract the URL from a mcp-remote wrapper.
 */
function extractMcpRemoteUrl(server: MCPServer): string | undefined {
  if (!server.args) return undefined;
  const idx = server.args.indexOf("mcp-remote");
  if (idx === -1) return undefined;
  // URL is the next arg after "mcp-remote"
  return server.args[idx + 1];
}
