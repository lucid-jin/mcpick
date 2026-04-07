import { access } from "fs/promises";
import { getTools, findTool as findToolStatic, type Tool } from "./tools";

/**
 * Detect installed tools by checking if their config files exist.
 * Supports configPaths fallback (e.g., Windows Store MSIX sandboxed paths).
 */
export async function detectInstalledTools(): Promise<Tool[]> {
  const tools = getTools();
  const installed: Tool[] = [];

  for (const tool of tools) {
    const resolved = await resolveTool(tool);
    if (resolved) {
      installed.push(resolved);
    }
  }

  return installed;
}

/**
 * Find a tool by keyword and resolve its config path.
 * This should be used instead of the static findTool() for any file operations.
 */
export async function findToolResolved(keyword: string): Promise<Tool | undefined> {
  const tool = findToolStatic(keyword);
  if (!tool) return undefined;
  return await resolveTool(tool) || tool;
}

/**
 * Resolve a tool's config path, trying fallbacks if needed.
 * Returns tool with resolved configPath, or null if no config exists.
 */
async function resolveTool(tool: Tool): Promise<Tool | null> {
  // Try default path first
  try {
    await access(tool.configPath);
    return tool;
  } catch {}

  // Try fallback paths (e.g., Windows Store MSIX)
  if (tool.configPaths) {
    for (const path of tool.configPaths) {
      try {
        await access(path);
        return { ...tool, configPath: path };
      } catch {}
    }
  }

  return null;
}
