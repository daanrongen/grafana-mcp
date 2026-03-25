import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ManagedRuntime } from "effect";
import { Effect } from "effect";
import { z } from "zod";
import type { GrafanaError, NotFoundError } from "../../domain/errors.ts";
import { GrafanaClient } from "../../domain/GrafanaClient.ts";
import { formatError, formatSuccess } from "../utils.ts";

export const registerAnnotationTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<GrafanaClient, GrafanaError | NotFoundError>,
) => {
  server.tool(
    "list_annotations",
    "List Grafana annotations, optionally filtered by dashboard UID.",
    {
      dashboardUid: z.string().optional().describe("Filter annotations by dashboard UID"),
      limit: z.number().optional().describe("Maximum number of results (default: 100)"),
    },
    { title: "List Annotations", readOnlyHint: true, openWorldHint: true },
    async ({ dashboardUid, limit }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* GrafanaClient;
          return yield* client.listAnnotations(dashboardUid, limit);
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "create_annotation",
    "Create a Grafana annotation, optionally pinned to a dashboard.",
    {
      text: z.string().describe("Annotation text / description"),
      tags: z.array(z.string()).describe("Tags to attach to the annotation"),
      dashboardUid: z.string().optional().describe("Dashboard UID to attach the annotation to"),
      time: z.number().optional().describe("Epoch time in milliseconds (default: now)"),
      timeEnd: z
        .number()
        .optional()
        .describe("End epoch time in milliseconds for a time-range annotation"),
    },
    {
      title: "Create Annotation",
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: true,
    },
    async ({ text, tags, dashboardUid, time, timeEnd }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* GrafanaClient;
          return yield* client.createAnnotation(text, tags, dashboardUid, time, timeEnd);
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );
};
