import { Command } from "commander";
import { createServer } from "http";
import { detectInstalledTools } from "../registry/detect";
import { getTools, findTool } from "../registry/tools";
import { parseConfig } from "../transform/parser";
import { adaptServer } from "../transform/adapter";
import { writeConfig } from "../transform/writer";
import { backupConfig } from "../utils/backup";
import { dashboardHTML } from "../dashboard/index.html";

const PORT = 4747;

export function dashboardCommand(): Command {
  return new Command("dashboard")
    .alias("ui")
    .description("Open web dashboard for visual MCP management")
    .option("-p, --port <port>", "Port number", String(PORT))
    .action(async (opts) => {
      const port = parseInt(opts.port) || PORT;
      await startDashboard(port);
    });
}

async function startDashboard(port: number) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);

    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }

    // API Routes
    if (url.pathname === "/api/tools") {
      const tools = await detectInstalledTools();
      const result = [];
      for (const tool of tools) {
        const config = await parseConfig(tool);
        result.push({
          ...tool,
          servers: config?.servers || {},
          serverCount: config ? Object.keys(config.servers).length : 0,
        });
      }
      json(res, result);
      return;
    }

    if (url.pathname === "/api/sync" && req.method === "POST") {
      const body = await readBody(req);
      const { sourceId, targetId, serverNames } = JSON.parse(body);

      const sourceTool = findTool(sourceId);
      const targetTool = findTool(targetId);
      if (!sourceTool || !targetTool) {
        json(res, { error: "Invalid tool IDs" }, 400);
        return;
      }

      const sourceConfig = await parseConfig(sourceTool);
      if (!sourceConfig) {
        json(res, { error: "Source has no config" }, 400);
        return;
      }

      const servers: Record<string, any> = {};
      for (const name of serverNames) {
        if (sourceConfig.servers[name]) {
          const adapted = adaptServer(name, sourceConfig.servers[name], sourceTool, targetTool);
          servers[name] = adapted.server;
        }
      }

      await backupConfig(targetTool.configPath);
      await writeConfig(targetTool, servers, { merge: true });

      json(res, { success: true, synced: Object.keys(servers).length });
      return;
    }

    // Serve dashboard HTML
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(dashboardHTML);
  });

  server.listen(port, () => {
    console.log(`\n  mcpicker dashboard running at http://localhost:${port}\n`);
    // Auto-open browser
    const open = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    import("child_process").then(({ exec }) => exec(`${open} http://localhost:${port}`));
  });
}

function json(res: any, data: any, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function readBody(req: any): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk: any) => (body += chunk));
    req.on("end", () => resolve(body));
  });
}
