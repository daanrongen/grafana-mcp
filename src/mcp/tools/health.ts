import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ManagedRuntime } from "effect";
import { Effect } from "effect";
import type { GrafanaError, NotFoundError } from "../../domain/errors.ts";
import { GrafanaClient } from "../../domain/GrafanaClient.ts";
import { runTool } from "../utils.ts";

export const registerHealthTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<GrafanaClient, GrafanaError | NotFoundError>,
) => {
  server.tool(
    "health_check",
    "Check the health of the Grafana instance. Returns version, database status, and commit hash.",
    {},
    { title: "Health Check", readOnlyHint: true, openWorldHint: true },
    () =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const client = yield* GrafanaClient;
          return yield* client.healthCheck();
        }),
      ),
  );
};
