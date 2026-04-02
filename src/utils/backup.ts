import { homedir } from "os";
import { join, basename } from "path";
import { access, mkdir, copyFile } from "fs/promises";

/**
 * Backup a config file before modifying it.
 * Returns the backup path or null if file doesn't exist.
 */
export async function backupConfig(configPath: string): Promise<string | null> {
  try { await access(configPath); } catch { return null; }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const backupDir = join(homedir(), ".mcpick", "backup", timestamp);
  const backupPath = join(backupDir, basename(configPath));

  await mkdir(backupDir, { recursive: true });
  await copyFile(configPath, backupPath);

  return backupPath;
}
