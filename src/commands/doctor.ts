import { Command } from "commander";

export function doctorCommand(): Command {
  return new Command("doctor")
    .description("Validate MCP configs and suggest fixes")
    .argument("[tool]", "Specific tool to validate")
    .option("--fix", "Automatically apply suggested fixes")
    .action(async (tool, opts) => {
      console.log("mcpick doctor — coming soon");
    });
}
