import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { GrafanaClientTest } from "../infra/GrafanaClientTest.ts";
import { GrafanaClient } from "./GrafanaClient.ts";

describe("datasources", () => {
  it("listDatasources returns empty list initially", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* GrafanaClient;
        return yield* client.listDatasources();
      }).pipe(Effect.provide(GrafanaClientTest)),
    );
    expect(result).toEqual([]);
  });

  it("createDatasource then listDatasources contains the datasource", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* GrafanaClient;
        yield* client.createDatasource("Prometheus", "prometheus", "http://localhost:9090");
        return yield* client.listDatasources();
      }).pipe(Effect.provide(GrafanaClientTest)),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Prometheus");
    expect(result[0]?.type).toBe("prometheus");
  });

  it("getDatasource returns the datasource by uid", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* GrafanaClient;
        const created = yield* client.createDatasource("Loki", "loki", "http://localhost:3100");
        return yield* client.getDatasource(created.uid);
      }).pipe(Effect.provide(GrafanaClientTest)),
    );
    expect(result.name).toBe("Loki");
    expect(result.type).toBe("loki");
  });

  it("getDatasource fails with NotFoundError for missing uid", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* GrafanaClient;
        return yield* Effect.either(client.getDatasource("nonexistent"));
      }).pipe(Effect.provide(GrafanaClientTest)),
    );
    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(result.left._tag).toBe("NotFoundError");
    }
  });

  it("deleteDatasource removes it from the list", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* GrafanaClient;
        const created = yield* client.createDatasource("Postgres", "postgres", "localhost:5432");
        yield* client.deleteDatasource(created.uid);
        return yield* client.listDatasources();
      }).pipe(Effect.provide(GrafanaClientTest)),
    );
    expect(result).toHaveLength(0);
  });
});
