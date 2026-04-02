#!/usr/bin/env node
import { Command } from "commander";
import { listCommand } from "./commands/list";
import { syncCommand } from "./commands/sync";
import { doctorCommand } from "./commands/doctor";
import { dashboardCommand } from "./commands/dashboard";

const program = new Command();

program
  .name("mcpicker")
  .description("Pick and sync MCP server configs across AI tools")
  .version("0.1.0");

program.addCommand(listCommand());
program.addCommand(syncCommand());
program.addCommand(doctorCommand());
program.addCommand(dashboardCommand());

program.parse();
