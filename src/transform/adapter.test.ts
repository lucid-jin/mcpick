import { test, expect, describe } from "bun:test";
import { adaptServer } from "./adapter";
import type { MCPServer } from "./parser";
import type { Tool } from "../registry/tools";

function makeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    id: "test",
    name: "Test",
    format: "json",
    httpSupport: true,
    serversKey: "mcpServers",
    configPath: "/tmp/test.json",
    keywords: [],
    ...overrides,
  };
}

const httpTool = makeTool({ id: "claude-code", httpSupport: true });
const noHttpTool = makeTool({ id: "claude-desktop", httpSupport: false });
const openclawTool = makeTool({ id: "openclaw", httpSupport: false, serversKey: "mcp.servers" });

// --- HTTP → mcp-remote ---

describe("HTTP → mcp-remote conversion", () => {
  test("wraps HTTP server with mcp-remote when target has no HTTP support", () => {
    const server: MCPServer = { type: "http", url: "https://example.com/mcp" };
    const result = adaptServer("srv", server, httpTool, noHttpTool);

    expect(result.changed).toBe(true);
    expect(result.changeType).toBe("http-to-mcp-remote");
    expect(result.server.type).toBe("stdio");
    expect(result.server.command).toBe("npx");
    expect(result.server.args).toEqual(["-y", "mcp-remote", "https://example.com/mcp"]);
  });

  test("preserves env when converting HTTP to mcp-remote", () => {
    const server: MCPServer = { type: "http", url: "https://x.com", env: { KEY: "val" } };
    const result = adaptServer("s", server, httpTool, noHttpTool);

    expect(result.server.env).toEqual({ KEY: "val" });
  });

  test("does not convert when target supports HTTP", () => {
    const server: MCPServer = { type: "http", url: "https://x.com" };
    const result = adaptServer("s", server, httpTool, httpTool);

    expect(result.changed).toBe(false);
    expect(result.changeType).toBe("none");
    expect(result.server.type).toBe("http");
  });
});

// --- mcp-remote → HTTP ---

describe("mcp-remote → HTTP unwrap", () => {
  test("unwraps mcp-remote to HTTP when target supports it", () => {
    const server: MCPServer = {
      type: "stdio",
      command: "npx",
      args: ["-y", "mcp-remote", "https://remote.com/mcp"],
    };
    const result = adaptServer("s", server, noHttpTool, httpTool);

    expect(result.changed).toBe(true);
    expect(result.changeType).toBe("mcp-remote-to-http");
    expect(result.server.type).toBe("http");
    expect(result.server.url).toBe("https://remote.com/mcp");
  });

  test("does not unwrap mcp-remote when target has no HTTP support", () => {
    const server: MCPServer = {
      type: "stdio",
      command: "npx",
      args: ["-y", "mcp-remote", "https://remote.com/mcp"],
    };
    const result = adaptServer("s", server, noHttpTool, noHttpTool);

    expect(result.changed).toBe(false);
    expect(result.server.type).toBe("stdio");
  });

  test("does not unwrap non-mcp-remote stdio server", () => {
    const server: MCPServer = { type: "stdio", command: "npx", args: ["-y", "other-tool"] };
    const result = adaptServer("s", server, noHttpTool, httpTool);

    expect(result.changed).toBe(false);
    expect(result.server.command).toBe("npx");
  });
});

// --- stdio passthrough ---

describe("stdio passthrough", () => {
  test("passes through stdio server unchanged", () => {
    const server: MCPServer = { type: "stdio", command: "node", args: ["server.js"] };
    const result = adaptServer("s", server, httpTool, httpTool);

    expect(result.changed).toBe(false);
    expect(result.changeType).toBe("none");
    expect(result.server).toEqual(server);
  });
});

// --- OpenClaw defensive checks ---

describe("OpenClaw defensive checks", () => {
  test("warns and strips OAuth Bearer headers", () => {
    const server: MCPServer = {
      type: "stdio",
      command: "npx",
      args: ["my-tool"],
      headers: { Authorization: "Bearer token123" },
    } as MCPServer & { headers: Record<string, string> };

    const result = adaptServer("s", server, httpTool, openclawTool);

    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some((w) => w.includes("OAuth"))).toBe(true);
    expect(result.warnings!.some((w) => w.includes("headers"))).toBe(true);
    expect((result.server as any).headers).toBeUndefined();
    expect(result.changed).toBe(true);
  });

  test("warns and strips non-OAuth headers", () => {
    const server: MCPServer = {
      type: "stdio",
      command: "npx",
      args: ["tool"],
      headers: { "X-Custom": "value" },
    } as MCPServer & { headers: Record<string, string> };

    const result = adaptServer("s", server, httpTool, openclawTool);

    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some((w) => w.includes("headers"))).toBe(true);
    expect((result.server as any).headers).toBeUndefined();
  });

  test("warns about transport field", () => {
    const server: MCPServer = {
      type: "stdio",
      command: "npx",
      args: ["tool"],
      transport: "sse",
    } as MCPServer & { transport: string };

    const result = adaptServer("s", server, httpTool, openclawTool);

    expect(result.warnings).toBeDefined();
    expect(result.warnings!.some((w) => w.includes("transport"))).toBe(true);
  });

  test("no warnings for clean stdio server", () => {
    const server: MCPServer = { type: "stdio", command: "npx", args: ["tool"] };
    const result = adaptServer("s", server, httpTool, openclawTool);

    expect(result.warnings).toBeUndefined();
  });

  test("HTTP server gets converted AND no extra warnings for clean HTTP", () => {
    const server: MCPServer = { type: "http", url: "https://example.com" };
    const result = adaptServer("s", server, httpTool, openclawTool);

    expect(result.changed).toBe(true);
    expect(result.changeType).toBe("http-to-mcp-remote");
    expect(result.server.type).toBe("stdio");
    // no headers/transport warnings, just the conversion
  });

  test("does not warn when target is not OpenClaw", () => {
    const server: MCPServer = {
      type: "stdio",
      command: "npx",
      args: ["tool"],
      headers: { Authorization: "Bearer x" },
    } as MCPServer & { headers: Record<string, string> };

    const result = adaptServer("s", server, httpTool, noHttpTool);
    expect(result.warnings).toBeUndefined();
  });
});
