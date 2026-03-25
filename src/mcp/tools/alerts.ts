import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ManagedRuntime } from "effect";
import { Effect } from "effect";
import { z } from "zod";
import type { GrafanaError, NotFoundError } from "../../domain/errors.ts";
import { GrafanaClient } from "../../domain/GrafanaClient.ts";
import { formatError, formatSuccess } from "../utils.ts";

export const registerAlertTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<GrafanaClient, GrafanaError | NotFoundError>,
) => {
  server.tool(
    "list_alert_rules",
    "List all Grafana alert rules. Returns uid, title, condition, folder, rule group, and state settings.",
    {},
    { title: "List Alert Rules", readOnlyHint: true, openWorldHint: true },
    async () => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* GrafanaClient;
          return yield* client.listAlertRules();
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "get_alert_rule",
    "Get a Grafana alert rule by UID.",
    {
      uid: z.string().describe("Alert rule UID"),
    },
    { title: "Get Alert Rule", readOnlyHint: true, openWorldHint: true },
    async ({ uid }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* GrafanaClient;
          return yield* client.getAlertRule(uid);
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "list_alert_instances",
    "List currently firing Grafana alert instances from Alertmanager. Returns labels, state, and activeAt.",
    {},
    { title: "List Alert Instances", readOnlyHint: true, openWorldHint: true },
    async () => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* GrafanaClient;
          return yield* client.listAlertInstances();
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );
};
