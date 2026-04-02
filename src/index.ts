#!/usr/bin/env bun
import { Command } from "commander";
import { listCommand } from "./commands/list";
import { syncCommand } from "./commands/sync";
import { doctorCommand } from "./commands/doctor";

const program = new Command();

program
  .name("mcpick")
  .description("Pick and sync MCP server configs across AI tools")
  .version("0.1.0");

program.addCommand(listCommand());
program.addCommand(syncCommand());
program.addCommand(doctorCommand());

program.parse();
