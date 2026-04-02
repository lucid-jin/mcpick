import { access } from "fs/promises";
import { getTools, type Tool } from "./tools";

export async function detectInstalledTools(): Promise<Tool[]> {
  const tools = getTools();
  const installed: Tool[] = [];

  for (const tool of tools) {
    try {
      await access(tool.configPath);
      installed.push(tool);
    } catch {
      // file doesn't exist
    }
  }

  return installed;
}
