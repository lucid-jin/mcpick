import { Command } from "commander";
import chalk from "chalk";
import { detectInstalledTools } from "../registry/detect";
import { parseConfig } from "../transform/parser";

export function listCommand(): Command {
  return new Command("list")
    .description("List all MCP server configs across installed AI tools")
    .option("--json", "Output as JSON")
    .option("-v, --verbose", "Show detailed server info")
    .action(async (opts) => {
      const tools = await detectInstalledTools();

      if (tools.length === 0) {
        console.log(chalk.yellow("No AI tools with MCP configs detected."));
        return;
      }

      const results: Record<string, any> = {};
      let totalServers = 0;

      for (const tool of tools) {
        const config = await parseConfig(tool);
        if (!config) continue;

        const serverNames = Object.keys(config.servers);
        if (serverNames.length === 0) continue;

        results[tool.id] = config.servers;
        totalServers += serverNames.length;

        if (!opts.json) {
          console.log(chalk.bold.cyan(`\n${tool.name}`) + chalk.gray(` (${tool.configPath})`));
          for (const [name, server] of Object.entries(config.servers)) {
            const type = (server as any).type === "http" ? chalk.yellow("http") : chalk.green("stdio");
            console.log(`  ${chalk.white(name.padEnd(25))} ${type}`);
            if (opts.verbose && (server as any).command) {
              console.log(chalk.gray(`    command: ${(server as any).command} ${((server as any).args || []).join(" ")}`));
            }
            if (opts.verbose && (server as any).url) {
              console.log(chalk.gray(`    url: ${(server as any).url}`));
            }
            if (opts.verbose && (server as any).env && Object.keys((server as any).env).length > 0) {
              console.log(chalk.gray(`    env: ${Object.keys((server as any).env).join(", ")}`));
            }
          }
        }
      }

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(chalk.gray(`\n${tools.length} tools detected, ${totalServers} servers total`));
      }
    });
}
