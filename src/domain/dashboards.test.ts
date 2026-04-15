import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { GrafanaClientTest } from "../infra/GrafanaClientTest.ts";
import { GrafanaClient } from "./GrafanaClient.ts";

describe("dashboards", () => {
  it("listDashboards returns empty list initially", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* GrafanaClient;
        return yield* client.listDashboards();
      }).pipe(Effect.provide(GrafanaClientTest)),
    );
    expect(result).toEqual([]);
  });

  it("createDashboard then listDashboards returns the dashboard", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* GrafanaClient;
        yield* client.createDashboard(JSON.stringify({ uid: "dash-1", title: "My Dashboard" }));
        return yield* client.listDashboards();
      }).pipe(Effect.provide(GrafanaClientTest)),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe("My Dashboard");
    expect(result[0]?.uid).toBe("dash-1");
  });

  it("getDashboard returns the created dashboard", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* GrafanaClient;
        yield* client.createDashboard(JSON.stringify({ uid: "dash-2", title: "Detail Dashboard" }));
        return yield* client.getDashboard("dash-2");
      }).pipe(Effect.provide(GrafanaClientTest)),
    );
    expect(result.uid).toBe("dash-2");
    expect(result.title).toBe("Detail Dashboard");
    expect(result.version).toBe(1);
  });

  it("getDashboard fails with NotFoundError for missing uid", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* GrafanaClient;
        return yield* Effect.either(client.getDashboard("nonexistent"));
      }).pipe(Effect.provide(GrafanaClientTest)),
    );
    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(result.left._tag).toBe("NotFoundError");
    }
  });

  it("updateDashboard increments version", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* GrafanaClient;
        yield* client.createDashboard(JSON.stringify({ uid: "dash-3", title: "Original" }));
        return yield* client.updateDashboard(
          "dash-3",
          JSON.stringify({ uid: "dash-3", title: "Updated" }),
        );
      }).pipe(Effect.provide(GrafanaClientTest)),
    );
    expect(result.title).toBe("Updated");
    expect(result.version).toBe(2);
  });

  it("deleteDashboard removes dashboard from list", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* GrafanaClient;
        yield* client.createDashboard(JSON.stringify({ uid: "dash-4", title: "To Delete" }));
        yield* client.deleteDashboard("dash-4");
        return yield* client.listDashboards();
      }).pipe(Effect.provide(GrafanaClientTest)),
    );
    expect(result.find((d) => d.uid === "dash-4")).toBeUndefined();
  });

  it("deleteDashboard fails with NotFoundError for missing uid", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* GrafanaClient;
        return yield* Effect.either(client.deleteDashboard("nonexistent"));
      }).pipe(Effect.provide(GrafanaClientTest)),
    );
    expect(result._tag).toBe("Left");
  });
});
