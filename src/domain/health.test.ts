import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { GrafanaClientTest } from "../infra/GrafanaClientTest.ts";
import { GrafanaClient } from "./GrafanaClient.ts";

describe("health", () => {
  it("healthCheck returns ok status", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* GrafanaClient;
        return yield* client.healthCheck();
      }).pipe(Effect.provide(GrafanaClientTest)),
    );
    expect(result.database).toBe("ok");
    expect(result.version).toBe("10.0.0");
  });
});
