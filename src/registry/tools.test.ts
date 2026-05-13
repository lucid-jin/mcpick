import { test, expect, describe } from "bun:test";
import { getTools, findTool } from "./tools";

describe("getTools", () => {
  test("returns all registered tools", () => {
    const tools = getTools();
    expect(tools.length).toBeGreaterThanOrEqual(8);
  });

  test("includes OpenClaw", () => {
    const tools = getTools();
    const openclaw = tools.find((t) => t.id === "openclaw");
    expect(openclaw).toBeDefined();
    expect(openclaw!.serversKey).toBe("mcp.servers");
    expect(openclaw!.httpSupport).toBe(false);
    expect(openclaw!.format).toBe("json");
  });

  test("includes Hermes Agent", () => {
    const tools = getTools();
    const hermes = tools.find((t) => t.id === "hermes");
    expect(hermes).toBeDefined();
    expect(hermes!.serversKey).toBe("mcp_servers");
    expect(hermes!.httpSupport).toBe(false);
    expect(hermes!.format).toBe("yaml");
    expect(hermes!.configPath).toContain(".hermes");
    expect(hermes!.configPath).toContain("config.yaml");
  });

  test("all tools have required fields", () => {
    for (const tool of getTools()) {
      expect(tool.id).toBeTruthy();
      expect(tool.name).toBeTruthy();
      expect(["json", "toml", "yaml"]).toContain(tool.format);
      expect(typeof tool.httpSupport).toBe("boolean");
      expect(tool.serversKey).toBeTruthy();
      expect(tool.configPath).toBeTruthy();
      expect(tool.keywords.length).toBeGreaterThan(0);
    }
  });

  test("no duplicate tool IDs", () => {
    const tools = getTools();
    const ids = tools.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("findTool", () => {
  test("finds by exact id", () => {
    expect(findTool("openclaw")?.id).toBe("openclaw");
    expect(findTool("claude-code")?.id).toBe("claude-code");
    expect(findTool("codex")?.id).toBe("codex");
  });

  test("finds by keyword", () => {
    expect(findTool("lobster")?.id).toBe("openclaw");
    expect(findTool("claw")?.id).toBe("openclaw");
    expect(findTool("anthropic")?.id).toBe("claude-code");
    expect(findTool("google")?.id).toBe("gemini");
    expect(findTool("hermes-agent")?.id).toBe("hermes");
  });

  test("finds by name (case insensitive)", () => {
    expect(findTool("OpenClaw")?.id).toBe("openclaw");
    expect(findTool("Claude Code")?.id).toBe("claude-code");
  });

  test("returns undefined for unknown tool", () => {
    expect(findTool("nonexistent")).toBeUndefined();
    expect(findTool("")).toBeUndefined();
  });

  test("trims whitespace", () => {
    expect(findTool("  openclaw  ")?.id).toBe("openclaw");
  });
});
