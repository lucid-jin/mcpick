import { access } from "fs/promises";
import { getTools, type Tool } from "./tools";

/**
 * Detect installed tools by checking if their config files exist.
 * Supports configPaths fallback (e.g., Windows Store MSIX sandboxed paths).
 */
export async function detectInstalledTools(): Promise<Tool[]> {
  const tools = getTools();
  const installed: Tool[] = [];

  for (const tool of tools) {
    const resolvedPath = await resolveConfigPath(tool);
    if (resolvedPath) {
      // Use the resolved path (may differ from default if fallback matched)
      installed.push({ ...tool, configPath: resolvedPath });
    }
  }

  return installed;
}

async function resolveConfigPath(tool: Tool): Promise<string | null> {
  // Try default path first
  try {
    await access(tool.configPath);
    return tool.configPath;
  } catch {}

  // Try fallback paths (e.g., Windows Store MSIX)
  if (tool.configPaths) {
    for (const path of tool.configPaths) {
      try {
        await access(path);
        return path;
      } catch {}
    }
  }

  return null;
}
