import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ManagedRuntime } from "effect";
import { Effect } from "effect";
import { z } from "zod";
import type { GrafanaError, NotFoundError } from "../../domain/errors.ts";
import { GrafanaClient } from "../../domain/GrafanaClient.ts";
import { formatError, formatSuccess } from "../utils.ts";

export const registerDatasourceTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<GrafanaClient, GrafanaError | NotFoundError>,
) => {
  server.tool(
    "list_datasources",
    "List all configured Grafana datasources. Returns id, uid, name, type, url, and isDefault.",
    {},
    { title: "List Datasources", readOnlyHint: true, openWorldHint: true },
    async () => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* GrafanaClient;
          return yield* client.listDatasources();
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "get_datasource",
    "Get a Grafana datasource by UID.",
    {
      uid: z.string().describe("Datasource UID"),
    },
    { title: "Get Datasource", readOnlyHint: true, openWorldHint: true },
    async ({ uid }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* GrafanaClient;
          return yield* client.getDatasource(uid);
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
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
    async ({ name, type, url, isDefault }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* GrafanaClient;
          return yield* client.createDatasource(name, type, url, isDefault);
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "delete_datasource",
    "Delete a Grafana datasource by UID.",
    {
      uid: z.string().describe("Datasource UID"),
    },
    { title: "Delete Datasource", readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    async ({ uid }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* GrafanaClient;
          yield* client.deleteDatasource(uid);
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess({ ok: true });
    },
  );
};
