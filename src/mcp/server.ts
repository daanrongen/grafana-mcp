import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ManagedRuntime } from "effect";
import type { GrafanaError, NotFoundError } from "../domain/errors.ts";
import type { GrafanaClient } from "../domain/GrafanaClient.ts";
import { registerAlertTools } from "./tools/alerts.ts";
import { registerAnnotationTools } from "./tools/annotations.ts";
import { registerDashboardTools } from "./tools/dashboards.ts";
import { registerDatasourceTools } from "./tools/datasources.ts";
import { registerFolderTools } from "./tools/folders.ts";
import { registerHealthTools } from "./tools/health.ts";

export const createMcpServer = (
  runtime: ManagedRuntime.ManagedRuntime<GrafanaClient, GrafanaError | NotFoundError>,
): McpServer => {
  const server = new McpServer({
    name: "grafana-mcp-server",
    version: "1.0.0",
  });

  registerDashboardTools(server, runtime);
  registerDatasourceTools(server, runtime);
  registerAlertTools(server, runtime);
  registerFolderTools(server, runtime);
  registerAnnotationTools(server, runtime);
  registerHealthTools(server, runtime);

  return server;
};
