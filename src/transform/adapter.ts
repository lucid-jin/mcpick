import type { Tool } from "../registry/tools";
import type { MCPServer } from "./parser";

export interface AdaptResult {
  server: MCPServer;
  changed: boolean;
  changeType: "none" | "http-to-mcp-remote" | "mcp-remote-to-http" | "path-resolved";
  description?: string;
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

  return { server: result, changed, changeType, description };
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
