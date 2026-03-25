import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ManagedRuntime } from "effect";
import { Effect } from "effect";
import { z } from "zod";
import type { GrafanaError, NotFoundError } from "../../domain/errors.ts";
import { GrafanaClient } from "../../domain/GrafanaClient.ts";
import { formatError, formatSuccess } from "../utils.ts";

export const registerFolderTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<GrafanaClient, GrafanaError | NotFoundError>,
) => {
  server.tool(
    "list_folders",
    "List all Grafana folders. Returns uid, title, and url.",
    {},
    { title: "List Folders", readOnlyHint: true, openWorldHint: true },
    async () => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* GrafanaClient;
          return yield* client.listFolders();
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "create_folder",
    "Create a new Grafana folder for organising dashboards.",
    {
      title: z.string().describe("Folder title"),
      uid: z.string().optional().describe("Optional custom UID for the folder"),
    },
    { title: "Create Folder", readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    async ({ title, uid }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* GrafanaClient;
          return yield* client.createFolder(title, uid);
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "delete_folder",
    "Delete a Grafana folder by UID. Deleting a folder also deletes all dashboards within it.",
    {
      uid: z.string().describe("Folder UID"),
    },
    { title: "Delete Folder", readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    async ({ uid }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* GrafanaClient;
          yield* client.deleteFolder(uid);
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess({ ok: true });
    },
  );
};
