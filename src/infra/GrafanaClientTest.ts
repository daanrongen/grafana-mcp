import { Effect, Layer, Ref } from "effect";
import { GrafanaError, NotFoundError } from "../domain/errors.ts";
import { GrafanaClient } from "../domain/GrafanaClient.ts";
import {
  type AlertRule,
  Annotation,
  Dashboard,
  DashboardDetail,
  Datasource,
  Folder,
  HealthStatus,
} from "../domain/models.ts";

export const GrafanaClientTest = Layer.effect(
  GrafanaClient,
  Effect.gen(function* () {
    const dashboardsRef = yield* Ref.make<Map<string, DashboardDetail>>(new Map());
    const datasourcesRef = yield* Ref.make<Map<string, Datasource>>(new Map());
    const alertRulesRef = yield* Ref.make<Map<string, AlertRule>>(new Map());
    const foldersRef = yield* Ref.make<Map<string, Folder>>(new Map());
    const annotationsRef = yield* Ref.make<Map<number, Annotation>>(new Map());
    let nextAnnotationId = 1;

    const requireDashboard = (uid: string) =>
      Effect.gen(function* () {
        const m = yield* Ref.get(dashboardsRef);
        const d = m.get(uid);
        if (!d) return yield* Effect.fail(new NotFoundError({ resource: "dashboard", id: uid }));
        return d;
      });

    const requireDatasource = (uid: string) =>
      Effect.gen(function* () {
        const m = yield* Ref.get(datasourcesRef);
        const d = m.get(uid);
        if (!d) return yield* Effect.fail(new NotFoundError({ resource: "datasource", id: uid }));
        return d;
      });

    const requireAlertRule = (uid: string) =>
      Effect.gen(function* () {
        const m = yield* Ref.get(alertRulesRef);
        const r = m.get(uid);
        if (!r) return yield* Effect.fail(new NotFoundError({ resource: "alert-rule", id: uid }));
        return r;
      });

    const requireFolder = (uid: string) =>
      Effect.gen(function* () {
        const m = yield* Ref.get(foldersRef);
        const f = m.get(uid);
        if (!f) return yield* Effect.fail(new NotFoundError({ resource: "folder", id: uid }));
        return f;
      });

    return GrafanaClient.of({
      listDashboards: (_query, _limit) =>
        Ref.get(dashboardsRef).pipe(
          Effect.map((m) =>
            [...m.values()].map(
              (d) =>
                new Dashboard({
                  uid: d.uid,
                  title: d.title,
                  url: `/d/${d.uid}`,
                  tags: [],
                }),
            ),
          ),
        ),

      getDashboard: requireDashboard,

      createDashboard: (dashboardJson, _folderUid, _message) =>
        Effect.gen(function* () {
          const parsed = JSON.parse(dashboardJson) as Record<string, unknown>;
          const uid = String(parsed.uid ?? `test-uid-${Date.now()}`);
          const detail = new DashboardDetail({
            uid,
            title: String(parsed.title ?? "Untitled"),
            json: dashboardJson,
            version: 1,
          });
          yield* Ref.update(dashboardsRef, (m) => new Map(m).set(uid, detail));
          return detail;
        }),

      updateDashboard: (uid, dashboardJson, _message) =>
        Effect.gen(function* () {
          yield* requireDashboard(uid);
          const parsed = JSON.parse(dashboardJson) as Record<string, unknown>;
          const m = yield* Ref.get(dashboardsRef);
          const existing =
            m.get(uid) ?? new DashboardDetail({ uid, title: "", json: "{}", version: 0 });
          const updated = new DashboardDetail({
            uid,
            title: String(parsed.title ?? existing.title),
            json: dashboardJson,
            version: existing.version + 1,
          });
          yield* Ref.update(dashboardsRef, (map) => new Map(map).set(uid, updated));
          return updated;
        }),

      deleteDashboard: (uid) =>
        Effect.gen(function* () {
          yield* requireDashboard(uid);
          yield* Ref.update(dashboardsRef, (m) => {
            const next = new Map(m);
            next.delete(uid);
            return next;
          });
        }),

      listDatasources: () => Ref.get(datasourcesRef).pipe(Effect.map((m) => [...m.values()])),

      getDatasource: requireDatasource,

      createDatasource: (name, type, url, isDefault = false) =>
        Effect.gen(function* () {
          const uid = `ds-${Date.now()}`;
          const ds = new Datasource({ id: nextAnnotationId++, uid, name, type, url, isDefault });
          yield* Ref.update(datasourcesRef, (m) => new Map(m).set(uid, ds));
          return ds;
        }),

      deleteDatasource: (uid) =>
        Effect.gen(function* () {
          yield* requireDatasource(uid);
          yield* Ref.update(datasourcesRef, (m) => {
            const next = new Map(m);
            next.delete(uid);
            return next;
          });
        }),

      listAlertRules: () => Ref.get(alertRulesRef).pipe(Effect.map((m) => [...m.values()])),

      getAlertRule: requireAlertRule,

      listAlertInstances: () => Effect.succeed([]),

      listFolders: () => Ref.get(foldersRef).pipe(Effect.map((m) => [...m.values()])),

      createFolder: (title, uid) =>
        Effect.gen(function* () {
          const id = uid ?? `folder-${Date.now()}`;
          const folder = new Folder({ uid: id, title, url: `/dashboards/f/${id}` });
          yield* Ref.update(foldersRef, (m) => new Map(m).set(id, folder));
          return folder;
        }),

      deleteFolder: (uid) =>
        Effect.gen(function* () {
          yield* requireFolder(uid);
          yield* Ref.update(foldersRef, (m) => {
            const next = new Map(m);
            next.delete(uid);
            return next;
          });
        }),

      listAnnotations: (_dashboardUID, _limit) =>
        Ref.get(annotationsRef).pipe(Effect.map((m) => [...m.values()])),

      createAnnotation: (text, tags, dashboardUID, time, timeEnd) =>
        Effect.gen(function* () {
          const id = nextAnnotationId++;
          const annotation = new Annotation({
            id,
            dashboardUID,
            time: time ?? Date.now(),
            timeEnd,
            text,
            tags,
          });
          yield* Ref.update(annotationsRef, (m) => new Map(m).set(id, annotation));
          return annotation;
        }),

      healthCheck: () =>
        Effect.succeed(
          new HealthStatus({
            commit: "test-commit",
            database: "ok",
            version: "10.0.0",
          }),
        ),
    });
  }),
);

export const GrafanaClientTestFailing = Layer.succeed(
  GrafanaClient,
  GrafanaClient.of({
    listDashboards: () => Effect.fail(new GrafanaError({ message: "connection refused" })),
    getDashboard: () => Effect.fail(new GrafanaError({ message: "connection refused" })),
    createDashboard: () => Effect.fail(new GrafanaError({ message: "connection refused" })),
    updateDashboard: () => Effect.fail(new GrafanaError({ message: "connection refused" })),
    deleteDashboard: () => Effect.fail(new GrafanaError({ message: "connection refused" })),
    listDatasources: () => Effect.fail(new GrafanaError({ message: "connection refused" })),
    getDatasource: () => Effect.fail(new GrafanaError({ message: "connection refused" })),
    createDatasource: () => Effect.fail(new GrafanaError({ message: "connection refused" })),
    deleteDatasource: () => Effect.fail(new GrafanaError({ message: "connection refused" })),
    listAlertRules: () => Effect.fail(new GrafanaError({ message: "connection refused" })),
    getAlertRule: () => Effect.fail(new GrafanaError({ message: "connection refused" })),
    listAlertInstances: () => Effect.fail(new GrafanaError({ message: "connection refused" })),
    listFolders: () => Effect.fail(new GrafanaError({ message: "connection refused" })),
    createFolder: () => Effect.fail(new GrafanaError({ message: "connection refused" })),
    deleteFolder: () => Effect.fail(new GrafanaError({ message: "connection refused" })),
    listAnnotations: () => Effect.fail(new GrafanaError({ message: "connection refused" })),
    createAnnotation: () => Effect.fail(new GrafanaError({ message: "connection refused" })),
    healthCheck: () => Effect.fail(new GrafanaError({ message: "connection refused" })),
  }),
);
