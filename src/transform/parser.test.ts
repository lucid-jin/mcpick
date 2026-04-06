import { test, expect, describe, beforeEach, afterEach } from "bun:test";
import { writeFile, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { parseConfig, extractServer, getNestedValue } from "./parser";
import type { Tool } from "../registry/tools";

const TMP = join(tmpdir(), "mcpick-test-parser-" + Date.now());

function makeTool(overrides: Partial<Tool> = {}): Tool {
  return {
    id: "test-tool",
    name: "Test Tool",
    format: "json",
    httpSupport: true,
    serversKey: "mcpServers",
    configPath: join(TMP, "config.json"),
    keywords: ["test"],
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
  test("resolves top-level key", () => {
    expect(getNestedValue({ foo: "bar" }, "foo")).toBe("bar");
  });

  test("resolves dot-separated nested key", () => {
    const obj = { mcp: { servers: { s1: "ok" } } };
    expect(getNestedValue(obj, "mcp.servers")).toEqual({ s1: "ok" });
  });

  test("returns undefined for missing path", () => {
    expect(getNestedValue({ a: 1 }, "x.y.z")).toBeUndefined();
  });

  test("returns undefined when intermediate is not object", () => {
    expect(getNestedValue({ a: "string" }, "a.b")).toBeUndefined();
  });

  test("handles single-level key path", () => {
    expect(getNestedValue({ mcpServers: { s: {} } }, "mcpServers")).toEqual({ s: {} });
  });
});

// --- extractServer ---

describe("extractServer", () => {
  test("detects stdio server from command + args", () => {
    const result = extractServer({ command: "npx", args: ["-y", "foo"] });
    expect(result.type).toBe("stdio");
    expect(result.command).toBe("npx");
    expect(result.args).toEqual(["-y", "foo"]);
  });

  test("detects http server from url field", () => {
    const result = extractServer({ url: "https://example.com/mcp" });
    expect(result.type).toBe("http");
    expect(result.url).toBe("https://example.com/mcp");
  });

  test("detects http server from explicit type", () => {
    const result = extractServer({ type: "http", url: "https://x.com" });
    expect(result.type).toBe("http");
  });

  test("preserves env variables", () => {
    const result = extractServer({ command: "node", env: { API_KEY: "secret" } });
    expect(result.env).toEqual({ API_KEY: "secret" });
  });

  test("preserves extra fields", () => {
    const result = extractServer({ command: "npx", headers: { "X-Custom": "val" }, transport: "sse" });
    expect((result as any).headers).toEqual({ "X-Custom": "val" });
    expect((result as any).transport).toBe("sse");
  });

  test("handles empty config", () => {
    const result = extractServer({});
    expect(result.type).toBe("stdio");
    expect(result.command).toBeUndefined();
  });
});

// --- parseConfig (JSON) ---

describe("parseConfig — JSON", () => {
  test("parses standard mcpServers config", async () => {
    const config = {
      mcpServers: {
        context7: { command: "uvx", args: ["context7-mcp"] },
        remote: { url: "https://example.com/mcp" },
      },
    };
    await writeFile(join(TMP, "config.json"), JSON.stringify(config));
    const tool = makeTool();

    const result = await parseConfig(tool);
    expect(result).not.toBeNull();
    expect(Object.keys(result!.servers)).toEqual(["context7", "remote"]);
    expect(result!.servers.context7!.type).toBe("stdio");
    expect(result!.servers.remote!.type).toBe("http");
  });

  test("parses nested key (mcp.servers) for OpenClaw", async () => {
    const config = {
      mcp: {
        servers: {
          s1: { command: "npx", args: ["foo"] },
        },
      },
      otherField: true,
    };
    await writeFile(join(TMP, "config.json"), JSON.stringify(config));
    const tool = makeTool({ serversKey: "mcp.servers" });

    const result = await parseConfig(tool);
    expect(result).not.toBeNull();
    expect(result!.servers.s1!.type).toBe("stdio");
    expect(result!.servers.s1!.command).toBe("npx");
  });

  test("returns empty servers when key is missing", async () => {
    await writeFile(join(TMP, "config.json"), JSON.stringify({ other: true }));
    const tool = makeTool();

    const result = await parseConfig(tool);
    expect(result).not.toBeNull();
    expect(Object.keys(result!.servers)).toHaveLength(0);
  });

  test("returns null when file does not exist", async () => {
    const tool = makeTool({ configPath: join(TMP, "nonexistent.json") });
    const result = await parseConfig(tool);
    expect(result).toBeNull();
  });

  test("returns parseError for invalid JSON", async () => {
    await writeFile(join(TMP, "config.json"), "{ broken json");
    const tool = makeTool();

    const result = await parseConfig(tool);
    expect(result).not.toBeNull();
    expect(result!.parseError).toBeDefined();
  });

  test("preserves raw config for merge writes", async () => {
    const config = { mcpServers: { s: { command: "x" } }, version: 2 };
    await writeFile(join(TMP, "config.json"), JSON.stringify(config));
    const tool = makeTool();

    const result = await parseConfig(tool);
    expect(result!.raw).toHaveProperty("version", 2);
  });
});

// --- parseConfig (TOML / Codex) ---

describe("parseConfig — TOML", () => {
  test("parses Codex-style TOML config", async () => {
    const toml = `
[mcp_servers.context7]
command = "npx"
args = ["-y", "context7-mcp"]
startup_timeout_ms = 60000

[mcp_servers.context7.env]
API_KEY = "test123"
`;
    await writeFile(join(TMP, "config.toml"), toml);
    const tool = makeTool({ format: "toml", serversKey: "mcp_servers", configPath: join(TMP, "config.toml") });

    const result = await parseConfig(tool);
    expect(result).not.toBeNull();
    expect(result!.servers.context7!.type).toBe("stdio");
    expect(result!.servers.context7!.command).toBe("npx");
    expect(result!.servers.context7!.env).toEqual({ API_KEY: "test123" });
  });

  test("unwraps Windows cmd /c wrapper", async () => {
    const toml = `
[mcp_servers.srv]
command = "cmd"
args = ["/c", "npx", "-y", "mcp-remote", "https://example.com"]
`;
    await writeFile(join(TMP, "config.toml"), toml);
    const tool = makeTool({ format: "toml", serversKey: "mcp_servers", configPath: join(TMP, "config.toml") });

    const result = await parseConfig(tool);
    expect(result!.servers.srv!.command).toBe("npx");
    expect(result!.servers.srv!.args).toEqual(["-y", "mcp-remote", "https://example.com"]);
  });
});
