import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { writeFile, readFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import {
  writeConfig,
  getNestedValue,
  setNestedValue,
  serializeJsonServer,
  serializeTomlServer,
} from "./writer";
import type { MCPServer } from "./parser";
import type { Tool } from "../registry/tools";

const TMP = join(tmpdir(), "mcpick-test-writer-" + Date.now());

function makeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    id: "test",
    name: "Test",
    format: "json",
    httpSupport: true,
    serversKey: "mcpServers",
    configPath: join(TMP, "config.json"),
    keywords: [],
    ...overrides,
  };
}

beforeEach(async () => {
  await mkdir(TMP, { recursive: true });
});

afterEach(async () => {
  await rm(TMP, { recursive: true, force: true });
});

// --- getNestedValue ---

describe("getNestedValue", () => {
  test("resolves single key", () => {
    expect(getNestedValue({ a: 1 }, "a")).toBe(1);
  });

  test("resolves nested path", () => {
    expect(getNestedValue({ x: { y: { z: 42 } } }, "x.y.z")).toBe(42);
  });

  test("returns undefined for missing key", () => {
    expect(getNestedValue({}, "a.b")).toBeUndefined();
  });
});

// --- setNestedValue ---

describe("setNestedValue", () => {
  test("sets top-level key", () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, "foo", "bar");
    expect(obj.foo).toBe("bar");
  });

  test("sets nested key, creating intermediates", () => {
    const obj: Record<string, unknown> = {};
    setNestedValue(obj, "mcp.servers", { s1: {} });
    expect((obj as any).mcp.servers).toEqual({ s1: {} });
  });

  test("preserves sibling keys at intermediate levels", () => {
    const obj: Record<string, unknown> = { mcp: { version: 2 } };
    setNestedValue(obj, "mcp.servers", { s1: {} });
    expect((obj as any).mcp.version).toBe(2);
    expect((obj as any).mcp.servers).toEqual({ s1: {} });
  });

  test("overwrites non-object intermediate", () => {
    const obj: Record<string, unknown> = { mcp: "string" };
    setNestedValue(obj, "mcp.servers", { s1: {} });
    expect((obj as any).mcp.servers).toEqual({ s1: {} });
  });
});

// --- serializeJsonServer ---

describe("serializeJsonServer", () => {
  test("serializes stdio server", () => {
    const server: MCPServer = { type: "stdio", command: "npx", args: ["-y", "tool"] };
    const result = serializeJsonServer(server);

    expect(result.command).toBe("npx");
    expect(result.args).toEqual(["-y", "tool"]);
    expect(result.type).toBeUndefined(); // type is not included in output
    expect(result.url).toBeUndefined();
  });

  test("serializes http server with url", () => {
    const server: MCPServer = { type: "http", url: "https://example.com" };
    const result = serializeJsonServer(server);

    expect(result.type).toBe("http");
    expect(result.url).toBe("https://example.com");
    expect(result.command).toBeUndefined();
  });

  test("includes env when present", () => {
    const server: MCPServer = { type: "stdio", command: "node", env: { KEY: "val" } };
    const result = serializeJsonServer(server);

    expect(result.env).toEqual({ KEY: "val" });
  });

  test("omits empty env", () => {
    const server: MCPServer = { type: "stdio", command: "node", env: {} };
    const result = serializeJsonServer(server);

    expect(result.env).toBeUndefined();
  });

  test("preserves extra fields", () => {
    const server: MCPServer = { type: "stdio", command: "x", transport: "sse" } as any;
    const result = serializeJsonServer(server);

    expect(result.transport).toBe("sse");
  });
});

// --- serializeTomlServer ---

describe("serializeTomlServer", () => {
  test("serializes basic stdio server", () => {
    const server: MCPServer = { type: "stdio", command: "npx", args: ["-y", "tool"] };
    const result = serializeTomlServer(server);

    expect(result.command).toBeDefined();
    expect(result.args).toBeDefined();
    expect(result.startup_timeout_ms).toBe(60000);
  });

  test("ensures -y flag for npx", () => {
    const server: MCPServer = { type: "stdio", command: "npx", args: ["tool"] };
    const result = serializeTomlServer(server);

    const args = result.args as string[];
    expect(args).toContain("-y");
  });

  test("does not duplicate -y flag", () => {
    const server: MCPServer = { type: "stdio", command: "npx", args: ["-y", "tool"] };
    const result = serializeTomlServer(server);

    const args = result.args as string[];
    const yCount = args.filter((a) => a === "-y").length;
    expect(yCount).toBe(1);
  });
});

// --- writeConfig (integration) ---

describe("writeConfig — JSON", () => {
  test("writes servers to new file", async () => {
    const tool = makeTool();
    const servers: Record<string, MCPServer> = {
      s1: { type: "stdio", command: "npx", args: ["-y", "foo"] },
    };

    await writeConfig(tool, servers);

    const content = JSON.parse(await readFile(tool.configPath, "utf-8"));
    expect(content.mcpServers.s1.command).toBe("npx");
  });

  test("merges with existing config", async () => {
    const tool = makeTool();
    const initial = { mcpServers: { existing: { command: "node", args: ["a"] } }, version: 1 };
    await writeFile(tool.configPath, JSON.stringify(initial));

    const servers: Record<string, MCPServer> = {
      newSrv: { type: "http", url: "https://x.com" },
    };
    await writeConfig(tool, servers, { merge: true });

    const content = JSON.parse(await readFile(tool.configPath, "utf-8"));
    expect(content.mcpServers.existing).toBeDefined();
    expect(content.mcpServers.newSrv).toBeDefined();
    expect(content.version).toBe(1);
  });

  test("overwrites when merge is false", async () => {
    const tool = makeTool();
    const initial = { mcpServers: { old: { command: "x" } } };
    await writeFile(tool.configPath, JSON.stringify(initial));

    const servers: Record<string, MCPServer> = {
      newOnly: { type: "stdio", command: "y" },
    };
    await writeConfig(tool, servers, { merge: false });

    const content = JSON.parse(await readFile(tool.configPath, "utf-8"));
    expect(content.mcpServers.old).toBeUndefined();
    expect(content.mcpServers.newOnly).toBeDefined();
  });

  test("writes to nested key path (OpenClaw)", async () => {
    const tool = makeTool({ serversKey: "mcp.servers" });
    const servers: Record<string, MCPServer> = {
      s1: { type: "stdio", command: "npx", args: ["tool"] },
    };

    await writeConfig(tool, servers);

    const content = JSON.parse(await readFile(tool.configPath, "utf-8"));
    expect(content.mcp.servers.s1.command).toBe("npx");
  });

  test("preserves other OpenClaw config fields", async () => {
    const tool = makeTool({ serversKey: "mcp.servers" });
    const initial = { mcp: { version: 3 }, name: "my-openclaw" };
    await writeFile(tool.configPath, JSON.stringify(initial));

    const servers: Record<string, MCPServer> = {
      s1: { type: "stdio", command: "npx" },
    };
    await writeConfig(tool, servers, { merge: true });

    const content = JSON.parse(await readFile(tool.configPath, "utf-8"));
    expect(content.mcp.servers.s1).toBeDefined();
    expect(content.mcp.version).toBe(3);
    expect(content.name).toBe("my-openclaw");
  });
});

describe("writeConfig — YAML (Hermes)", () => {
  function hermesTool(): Tool {
    return makeTool({
      id: "hermes",
      name: "Hermes Agent",
      format: "yaml",
      httpSupport: false,
      serversKey: "mcp_servers",
      configPath: join(TMP, "config.yaml"),
    });
  }

  test("writes mcp_servers to new YAML file", async () => {
    const tool = hermesTool();
    const servers: Record<string, MCPServer> = {
      sentry: { type: "stdio", command: "npx", args: ["-y", "mcp-remote", "https://mcp.sentry.dev/mcp"] },
    };

    await writeConfig(tool, servers);

    const content = await readFile(tool.configPath, "utf-8");
    expect(content).toContain("mcp_servers:");
    expect(content).toContain("sentry:");
    expect(content).toContain("mcp.sentry.dev");
  });

  test("preserves unrelated hermes config keys when merging", async () => {
    const tool = hermesTool();
    const initial = `model:
  default: gpt-5.5
  provider: openai-codex
agent:
  max_turns: 90
mcp_servers:
  existing:
    command: node
    args:
      - /existing/server.js
timezone: 'Asia/Seoul'
`;
    await writeFile(tool.configPath, initial);

    const servers: Record<string, MCPServer> = {
      newSrv: { type: "stdio", command: "npx", args: ["-y", "new-mcp"] },
    };
    await writeConfig(tool, servers, { merge: true });

    const content = await readFile(tool.configPath, "utf-8");
    // Other top-level keys must survive
    expect(content).toContain("default: gpt-5.5");
    expect(content).toContain("provider: openai-codex");
    expect(content).toContain("max_turns: 90");
    expect(content).toContain("Asia/Seoul");
    // Both servers must be present
    expect(content).toContain("existing:");
    expect(content).toContain("newSrv:");
    expect(content).toContain("new-mcp");
  });

  test("preserves YAML comments via Document API", async () => {
    const tool = hermesTool();
    const initial = `# Top-level config
model:
  default: gpt-5.5  # primary model
mcp_servers:
  legacy:
    command: node
`;
    await writeFile(tool.configPath, initial);

    const servers: Record<string, MCPServer> = {
      added: { type: "stdio", command: "npx", args: ["tool"] },
    };
    await writeConfig(tool, servers, { merge: true });

    const content = await readFile(tool.configPath, "utf-8");
    expect(content).toContain("# Top-level config");
    expect(content).toContain("# primary model");
    expect(content).toContain("legacy:");
    expect(content).toContain("added:");
  });

  test("overwrites mcp_servers when merge is false", async () => {
    const tool = hermesTool();
    const initial = `model:
  default: gpt-5.5
mcp_servers:
  old:
    command: x
`;
    await writeFile(tool.configPath, initial);

    const servers: Record<string, MCPServer> = {
      fresh: { type: "stdio", command: "npx", args: ["new"] },
    };
    await writeConfig(tool, servers, { merge: false });

    const content = await readFile(tool.configPath, "utf-8");
    // The unrelated key survives, but mcp_servers entries are replaced
    expect(content).toContain("default: gpt-5.5");
    expect(content).toContain("fresh:");
    expect(content).not.toContain("old:");
  });
});
