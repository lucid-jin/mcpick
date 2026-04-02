import { Command } from "commander";
import { select, checkbox, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import { detectInstalledTools } from "../registry/detect";
import { findTool, type Tool } from "../registry/tools";
import { parseConfig } from "../transform/parser";
import { adaptServer, type AdaptResult } from "../transform/adapter";
import { writeConfig } from "../transform/writer";
import { backupConfig } from "../utils/backup";

export function syncCommand(): Command {
  return new Command("sync")
    .description("Sync MCP servers between AI tools")
    .argument("[source]", "Source tool ID")
    .argument("[target]", "Target tool ID")
    .option("--pick <servers>", "Sync only specific servers (comma-separated)")
    .option("--all", "Sync all servers without selection")
    .option("--dry-run", "Preview changes without applying")
    .option("--force", "Overwrite existing servers without asking")
    .action(async (sourceId, targetId, opts) => {
      if (sourceId && targetId) {
        await runDirectSync(sourceId, targetId, opts);
      } else {
        await runInteractiveSync(opts);
      }
    });
}

async function runInteractiveSync(opts: any) {
  const tools = await detectInstalledTools();
  if (tools.length < 2) {
    console.log(chalk.yellow("Need at least 2 tools with MCP configs to sync."));
    return;
  }

  // Step 1: Source
  const toolsWithServers = await Promise.all(
    tools.map(async (t) => {
      const config = await parseConfig(t);
      const count = config ? Object.keys(config.servers).length : 0;
      return { tool: t, count };
    })
  );

  const sourceId = await select({
    message: "어디서 가져올까요? (Source)",
    choices: toolsWithServers
      .filter((t) => t.count > 0)
      .map((t) => ({
        name: `${t.tool.name} (${t.count} servers)`,
        value: t.tool.id,
      })),
  });

  const sourceTool = tools.find((t) => t.id === sourceId)!;
  const sourceConfig = await parseConfig(sourceTool);
  if (!sourceConfig || Object.keys(sourceConfig.servers).length === 0) {
    console.log(chalk.yellow("Source has no MCP servers."));
    return;
  }

  // Step 2: Pick servers
  const serverEntries = Object.entries(sourceConfig.servers);
  const selectedServers = await checkbox({
    message: "어떤 서버를 싱크할까요?",
    choices: serverEntries.map(([name, server]) => ({
      name: `${name.padEnd(25)} ${server.type === "http" ? chalk.yellow("http") : chalk.green("stdio")}`,
      value: name,
      checked: true,
    })),
  });

  if (selectedServers.length === 0) {
    console.log(chalk.yellow("No servers selected."));
    return;
  }

  // Step 3: Target
  const targetId = await select({
    message: "어디로 넣을까요? (Target)",
    choices: tools
      .filter((t) => t.id !== sourceId)
      .map((t) => {
        const hint = !t.httpSupport ? chalk.gray(" (HTTP → mcp-remote 자동변환)") : "";
        return { name: `${t.name}${hint}`, value: t.id };
      }),
  });

  const targetTool = tools.find((t) => t.id === targetId)!;

  // Step 4: Preview
  const pickedServers: Record<string, any> = {};
  for (const name of selectedServers) {
    pickedServers[name] = sourceConfig.servers[name];
  }

  await previewAndApply(sourceTool, targetTool, pickedServers, opts);
}

async function runDirectSync(sourceId: string, targetId: string, opts: any) {
  const sourceTool = findTool(sourceId);
  const targetTool = findTool(targetId);

  if (!sourceTool) {
    console.log(chalk.red(`Unknown source: ${sourceId}`));
    return;
  }
  if (!targetTool) {
    console.log(chalk.red(`Unknown target: ${targetId}`));
    return;
  }

  const sourceConfig = await parseConfig(sourceTool);
  if (!sourceConfig || Object.keys(sourceConfig.servers).length === 0) {
    console.log(chalk.yellow(`No MCP servers found in ${sourceTool.name}.`));
    return;
  }

  let servers = sourceConfig.servers;

  // Filter by --pick
  if (opts.pick) {
    const picks = opts.pick.split(",").map((s: string) => s.trim());
    servers = Object.fromEntries(
      Object.entries(servers).filter(([name]) => picks.includes(name))
    );
    if (Object.keys(servers).length === 0) {
      console.log(chalk.yellow("No matching servers found for --pick filter."));
      return;
    }
  }

  await previewAndApply(sourceTool, targetTool, servers, opts);
}

async function previewAndApply(
  sourceTool: Tool,
  targetTool: Tool,
  servers: Record<string, any>,
  opts: any
) {
  // Check existing target config for conflicts
  const targetConfig = await parseConfig(targetTool);
  const existingServerNames = targetConfig ? Object.keys(targetConfig.servers) : [];

  console.log(chalk.bold(`\n${sourceTool.name} → ${targetTool.name}\n`));

  const adaptedServers: Record<string, any> = {};
  const results: AdaptResult[] = [];

  for (const [name, server] of Object.entries(servers)) {
    const result = adaptServer(name, server as any, sourceTool, targetTool);
    adaptedServers[name] = result.server;
    results.push(result);

    const exists = existingServerNames.includes(name);
    const prefix = exists ? chalk.yellow("~") : chalk.green("+");
    const suffix = result.changed ? chalk.cyan(` (${result.description})`) : chalk.gray(" (그대로)");
    const conflict = exists ? chalk.yellow(" [overwrite]") : "";

    console.log(`  ${prefix} ${name.padEnd(25)} ${suffix}${conflict}`);
  }

  console.log();

  if (opts.dryRun) {
    console.log(chalk.gray("Dry run — no changes applied."));
    return;
  }

  // Confirm
  if (!opts.force) {
    const ok = await confirm({
      message: "Apply?",
      default: true,
    });
    if (!ok) {
      console.log(chalk.gray("Cancelled."));
      return;
    }
  }

  // Backup
  const backupPath = await backupConfig(targetTool.configPath);

  // Write
  await writeConfig(targetTool, adaptedServers, { merge: true });

  console.log(chalk.green(`\n✓ Synced ${Object.keys(adaptedServers).length} servers: ${sourceTool.name} → ${targetTool.name}`));
  if (backupPath) {
    console.log(chalk.gray(`  Backup saved: ${backupPath}`));
  }
}
