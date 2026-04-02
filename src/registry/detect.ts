import { getTools, type Tool } from "./tools";

export async function detectInstalledTools(): Promise<Tool[]> {
  const tools = getTools();
  const installed: Tool[] = [];

  for (const tool of tools) {
    const file = Bun.file(tool.configPath);
    if (await file.exists()) {
      installed.push(tool);
    }
  }

  return installed;
}
