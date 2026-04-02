import { Command } from "commander";

export function syncCommand(): Command {
  return new Command("sync")
    .description("Sync MCP servers between AI tools")
    .argument("[source]", "Source tool ID")
    .argument("[target]", "Target tool ID")
    .option("--pick <servers>", "Sync only specific servers (comma-separated)")
    .option("--all", "Sync all servers without selection")
    .option("--dry-run", "Preview changes without applying")
    .option("--force", "Overwrite existing servers without asking")
    .action(async (source, target, opts) => {
      console.log("mcpick sync — coming soon");
    });
}
