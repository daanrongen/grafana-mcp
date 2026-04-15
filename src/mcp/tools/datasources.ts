import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ManagedRuntime } from "effect";
import { Effect } from "effect";
import { z } from "zod";
import type { GrafanaError, NotFoundError } from "../../domain/errors.ts";
import { GrafanaClient } from "../../domain/GrafanaClient.ts";
import { runTool } from "../utils.ts";

export const registerDatasourceTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<GrafanaClient, GrafanaError | NotFoundError>,
) => {
  server.tool(
    "list_datasources",
    "List all configured Grafana datasources. Returns id, uid, name, type, url, and isDefault.",
    {},
    { title: "List Datasources", readOnlyHint: true, openWorldHint: true },
    () =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* GrafanaClient;
          return yield* client.listDatasources();
        }),
      ),
  );

  server.tool(
    "get_datasource",
    "Get a Grafana datasource by UID.",
    {
      uid: z.string().describe("Datasource UID"),
    },
    { title: "Get Datasource", readOnlyHint: true, openWorldHint: true },
    ({ uid }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* GrafanaClient;
          return yield* client.getDatasource(uid);
        }),
      ),
  );

  server.tool(
    "create_datasource",
    "Create a new Grafana datasource.",
    {
      name: z.string().describe("Datasource name"),
      type: z.string().describe("Datasource type (e.g. prometheus, loki, elasticsearch, postgres)"),
      url: z.string().describe("Datasource URL"),
      isDefault: z.boolean().optional().describe("Set as the default datasource (default: false)"),
    },
    {
      title: "Create Datasource",
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
    ({ name, type, url, isDefault }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* GrafanaClient;
          return yield* client.createDatasource(name, type, url, isDefault);
        }),
      ),
  );

  server.tool(
    "delete_datasource",
    "Delete a Grafana datasource by UID.",
    {
      uid: z.string().describe("Datasource UID"),
    },
    { title: "Delete Datasource", readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    ({ uid }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* GrafanaClient;
          yield* client.deleteDatasource(uid);
          return { ok: true };
        }),
      ),
  );
};
