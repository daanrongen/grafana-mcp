import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ManagedRuntime } from "effect";
import { Effect } from "effect";
import { z } from "zod";
import type { GrafanaError, NotFoundError } from "../../domain/errors.ts";
import { GrafanaClient } from "../../domain/GrafanaClient.ts";
import { runTool } from "../utils.ts";

export const registerDashboardTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<GrafanaClient, GrafanaError | NotFoundError>,
) => {
  server.tool(
    "list_dashboards",
    "Search and list Grafana dashboards. Returns uid, title, url, folderTitle, and tags.",
    {
      query: z.string().optional().describe("Search query to filter dashboards by title"),
      limit: z.number().optional().describe("Maximum number of results (default: 100)"),
    },
    {
      title: "List Dashboards",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    ({ query, limit }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* GrafanaClient;
          return yield* client.listDashboards(query, limit);
        }),
      ),
  );

  server.tool(
    "get_dashboard",
    "Get a Grafana dashboard by UID. Returns full dashboard JSON, version, and folder.",
    {
      uid: z.string().describe("Dashboard UID"),
    },
    {
      title: "Get Dashboard",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    ({ uid }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* GrafanaClient;
          return yield* client.getDashboard(uid);
        }),
      ),
  );

  server.tool(
    "create_dashboard",
    "Create a new Grafana dashboard from a JSON definition string.",
    {
      dashboardJson: z
        .string()
        .describe("Dashboard JSON as a string (must include at minimum a 'title' field)"),
      folderUid: z.string().optional().describe("UID of the folder to place the dashboard in"),
      message: z.string().optional().describe("Commit message for the dashboard version"),
    },
    {
      title: "Create Dashboard",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    ({ dashboardJson, folderUid, message }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* GrafanaClient;
          return yield* client.createDashboard(dashboardJson, folderUid, message);
        }),
      ),
  );

  server.tool(
    "update_dashboard",
    "Update an existing Grafana dashboard by UID with a new JSON definition.",
    {
      uid: z.string().describe("Dashboard UID"),
      dashboardJson: z.string().describe("Updated dashboard JSON as a string"),
      message: z.string().optional().describe("Commit message for the new version"),
    },
    {
      title: "Update Dashboard",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    ({ uid, dashboardJson, message }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* GrafanaClient;
          return yield* client.updateDashboard(uid, dashboardJson, message);
        }),
      ),
  );

  server.tool(
    "delete_dashboard",
    "Delete a Grafana dashboard by UID.",
    {
      uid: z.string().describe("Dashboard UID"),
    },
    {
      title: "Delete Dashboard",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
    ({ uid }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* GrafanaClient;
          yield* client.deleteDashboard(uid);
          return { ok: true };
        }),
      ),
  );
};
