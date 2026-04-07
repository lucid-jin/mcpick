import { Command } from "commander";
import chalk from "chalk";
import { existsSync } from "fs";
import { resolve, isAbsolute } from "path";
import { detectInstalledTools } from "../registry/detect";
import { findToolResolved } from "../registry/detect";
import { parseConfig } from "../transform/parser";
import { adaptServer } from "../transform/adapter";
import { writeConfig } from "../transform/writer";
import { backupConfig } from "../utils/backup";

interface Issue {
  tool: string;
  server: string;
  type: "http-unsupported" | "relative-path" | "missing-file" | "oauth-unsupported" | "headers-ignored" | "transport-unsupported";
  message: string;
  fix?: string;
  fixAction?: () => Promise<void>;
}

export function doctorCommand(): Command {
  return new Command("doctor")
    .description("Validate MCP configs and suggest fixes")
    .argument("[tool]", "Specific tool to validate")
    .option("--fix", "Automatically apply suggested fixes")
    .action(async (toolId, opts) => {
      let tools = await detectInstalledTools();

      if (toolId) {
        const specific = await findToolResolved(toolId);
        if (!specific) {
          console.log(chalk.red(`Unknown tool: ${toolId}`));
          return;
        }
        tools = tools.filter((t) => t.id === specific.id);
      }

      if (tools.length === 0) {
        console.log(chalk.yellow("No tools detected."));
        return;
      }

      console.log(chalk.gray(`Scanning ${tools.length} tools...\n`));

      const issues: Issue[] = [];
      let totalServers = 0;

      for (const tool of tools) {
        const config = await parseConfig(tool);
        if (!config) continue;

        for (const [name, server] of Object.entries(config.servers)) {
          totalServers++;

          // Check: HTTP on unsupported tool
          if (server.type === "http" && !tool.httpSupport) {
            issues.push({
              tool: tool.name,
              server: name,
              type: "http-unsupported",
              message: `uses HTTP type (not supported by ${tool.name} config file)`,
              fix: `wrap with npx mcp-remote ${server.url}`,
              fixAction: async () => {
                const adapted = adaptServer(name, server, tool, tool);
                const backup = await backupConfig(tool.configPath);
                await writeConfig(tool, { [name]: adapted.server }, { merge: true });
                if (backup) console.log(chalk.gray(`    Backup: ${backup}`));
              },
            });
          }

          // Check: OpenClaw-specific unsupported features
          if (tool.id === "openclaw") {
            // OAuth / headers not supported
            const headers = (server as any).headers;
            if (headers && typeof headers === "object") {
              const authHeader = Object.entries(headers).find(
                ([k, v]) => k.toLowerCase() === "authorization" && typeof v === "string" && (v as string).toLowerCase().includes("bearer")
              );
              if (authHeader) {
                issues.push({
                  tool: tool.name,
                  server: name,
                  type: "oauth-unsupported",
                  message: "uses OAuth/Bearer authentication (not supported by OpenClaw)",
                  fix: "use mcp-remote wrapper for OAuth, or configure a static token",
                });
              } else {
                issues.push({
                  tool: tool.name,
                  server: name,
                  type: "headers-ignored",
                  message: "has 'headers' field which OpenClaw ignores at runtime",
                });
              }
            }

            // transport field not supported
            const transport = (server as any).transport;
            if (transport) {
              issues.push({
                tool: tool.name,
                server: name,
                type: "transport-unsupported",
                message: `uses '${transport}' transport (OpenClaw only supports stdio)`,
                fix: "convert to stdio with mcp-remote wrapper",
              });
            }
          }

          // Check: relative paths in env
          if (server.env) {
            for (const [key, value] of Object.entries(server.env)) {
              if (
                typeof value === "string" &&
                !isAbsolute(value) &&
                (value.includes("/") || value.includes("\\")) &&
                !value.startsWith("$") &&
                !value.startsWith("http")
              ) {
                issues.push({
                  tool: tool.name,
                  server: name,
                  type: "relative-path",
                  message: `${key} uses relative path: ${value}`,
                  fix: `resolve to absolute path`,
                });
              }
            }
          }

          // Check: referenced files don't exist
          if (server.env) {
            for (const [key, value] of Object.entries(server.env)) {
              if (
                typeof value === "string" &&
                isAbsolute(value) &&
                (value.endsWith(".json") || value.endsWith(".pem") || value.endsWith(".key")) &&
                !existsSync(value)
              ) {
                issues.push({
                  tool: tool.name,
                  server: name,
                  type: "missing-file",
                  message: `${key} references missing file: ${value}`,
                });
              }
            }
          }
        }
      }

      // Print results
      if (issues.length === 0) {
        console.log(chalk.green(`✓ ${totalServers} servers across ${tools.length} tools — no issues found`));
        return;
      }

      // Group by tool
      const grouped = new Map<string, Issue[]>();
      for (const issue of issues) {
        const existing = grouped.get(issue.tool) || [];
        existing.push(issue);
        grouped.set(issue.tool, existing);
      }

      for (const [toolName, toolIssues] of grouped) {
        console.log(chalk.yellow(`⚠ ${toolName}`));
        for (const issue of toolIssues) {
          console.log(`  └─ ${issue.server}: ${issue.message}`);
          if (issue.fix) {
            console.log(chalk.cyan(`     → Fix: ${issue.fix}`));
          }

          if (opts.fix && issue.fixAction) {
            await issue.fixAction();
            console.log(chalk.green(`     ✓ Fixed`));
          }
        }
        console.log();
      }

      console.log(
        chalk.gray(`${totalServers} servers across ${tools.length} tools — ${issues.length} issues found`)
      );
    });
}
