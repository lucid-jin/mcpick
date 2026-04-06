import { Command } from "commander";
import { createServer } from "http";
import { randomBytes } from "crypto";
import { detectInstalledTools } from "../registry/detect";
import { findTool } from "../registry/tools";
import { parseConfig } from "../transform/parser";
import { adaptServer } from "../transform/adapter";
import { writeConfig } from "../transform/writer";
import { backupConfig } from "../utils/backup";
import { getDashboardHTML } from "../dashboard/index.html";

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
  // Generate CSRF token per session
  const csrfToken = randomBytes(32).toString("hex");

  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);

    // No CORS — same-origin only (localhost)
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    // Verify CSRF token on all POST requests
    if (req.method === "POST") {
      const token = req.headers["x-csrf-token"];
      if (token !== csrfToken) {
        json(res, { error: "Invalid CSRF token" }, 403);
        return;
      }
    }

    try {
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
            parseError: config === null ? undefined : undefined,
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
          json(res, { error: "Source config not found or invalid" }, 400);
          return;
        }

        const servers: Record<string, any> = {};
        const allWarnings: string[] = [];
        for (const name of serverNames) {
          if (sourceConfig.servers[name]) {
            const adapted = adaptServer(name, sourceConfig.servers[name], sourceTool, targetTool);
            servers[name] = adapted.server;
            if (adapted.warnings) {
              allWarnings.push(...adapted.warnings.map((w: string) => `${name}: ${w}`));
            }
          }
        }

        if (Object.keys(servers).length === 0) {
          json(res, { error: "No valid servers to sync" }, 400);
          return;
        }

        await backupConfig(targetTool.configPath);
        await writeConfig(targetTool, servers, { merge: true });

        json(res, { success: true, synced: Object.keys(servers).length, warnings: allWarnings.length > 0 ? allWarnings : undefined });
        return;
      }

      if (url.pathname === "/api/delete" && req.method === "POST") {
        const body = await readBody(req);
        const { toolId, serverName } = JSON.parse(body);

        const tool = findTool(toolId);
        if (!tool) {
          json(res, { error: "Invalid tool ID" }, 400);
          return;
        }

        // Block TOML targets
        if (tool.format === "toml") {
          json(res, { error: "TOML write not yet supported" }, 400);
          return;
        }

        const config = await parseConfig(tool);
        if (!config || !config.servers[serverName]) {
          json(res, { error: "Server not found" }, 404);
          return;
        }

        await backupConfig(tool.configPath);

        // Remove server and rewrite
        const { [serverName]: _, ...remaining } = config.servers;
        await writeConfig(tool, remaining as any, { merge: false, rawBase: config.raw });

        json(res, { success: true, deleted: serverName });
        return;
      }

      // Serve dashboard HTML with embedded CSRF token
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(getDashboardHTML(csrfToken));
    } catch (err: any) {
      console.error("[dashboard]", err.message || err);
      json(res, { error: err.message || "Internal error" }, 500);
    }
  });

  // Bind to localhost only — not accessible from other machines
  server.listen(port, "127.0.0.1", () => {
    console.log(`\n  mcpicker dashboard running at http://127.0.0.1:${port}\n`);
    const open = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
    import("child_process").then(({ exec }) => exec(`${open} http://127.0.0.1:${port}`));
  });
}

function json(res: any, data: any, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: any) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}
