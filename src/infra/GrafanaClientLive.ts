import { Effect, Layer, Redacted } from "effect";
import { GrafanaConfig } from "../config.ts";
import { GrafanaError, NotFoundError } from "../domain/errors.ts";
import { GrafanaClient } from "../domain/GrafanaClient.ts";
import {
  AlertInstance,
  AlertRule,
  Annotation,
  Dashboard,
  DashboardDetail,
  Datasource,
  Folder,
  HealthStatus,
} from "../domain/models.ts";

const wrapFetch = <A>(label: string, fn: () => Promise<A>): Effect.Effect<A, GrafanaError> =>
  Effect.tryPromise({
    try: fn,
    catch: (e) => new GrafanaError({ message: `${label} failed`, cause: e }),
  });

export const GrafanaClientLive = Layer.effect(
  GrafanaClient,
  Effect.gen(function* () {
    const { url, apiKey } = yield* Effect.orDie(GrafanaConfig);
    const baseUrl = url.replace(/\/$/, "");
    const token = Redacted.value(apiKey);

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const get = <A>(path: string): Effect.Effect<A, GrafanaError> =>
      wrapFetch(`GET ${path}`, async () => {
        const res = await fetch(`${baseUrl}${path}`, { headers });
        if (res.status === 404) {
          throw new Error(`404 Not Found: ${path}`);
        }
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }
        return res.json() as Promise<A>;
      });

    const post = <A>(path: string, body: unknown): Effect.Effect<A, GrafanaError> =>
      wrapFetch(`POST ${path}`, async () => {
        const res = await fetch(`${baseUrl}${path}`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }
        return res.json() as Promise<A>;
      });

    const del = (path: string): Effect.Effect<void, GrafanaError> =>
      wrapFetch(`DELETE ${path}`, async () => {
        const res = await fetch(`${baseUrl}${path}`, { method: "DELETE", headers });
        if (res.status === 404) {
          throw new Error(`404 Not Found: ${path}`);
        }
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }
      });

    const mapNotFound = <A>(
      resource: string,
      id: string,
      effect: Effect.Effect<A, GrafanaError>,
    ): Effect.Effect<A, GrafanaError | NotFoundError> =>
      Effect.catchAll(effect, (e): Effect.Effect<never, GrafanaError | NotFoundError> => {
        if (e.message.includes("404")) {
          return Effect.fail(new NotFoundError({ resource, id }));
        }
        return Effect.fail(e);
      });

    return {
      listDashboards: (query, limit = 100) =>
        get<
          Array<{
            uid: string;
            title: string;
            url: string;
            folderTitle?: string;
            tags: string[];
          }>
        >(
          `/api/search?type=dash-db&limit=${limit}${query ? `&query=${encodeURIComponent(query)}` : ""}`,
        ).pipe(
          Effect.map((items) =>
            items.map(
              (d) =>
                new Dashboard({
                  uid: d.uid,
                  title: d.title,
                  url: d.url,
                  folderTitle: d.folderTitle,
                  tags: d.tags ?? [],
                }),
            ),
          ),
        ),

      getDashboard: (uid) =>
        mapNotFound(
          "dashboard",
          uid,
          get<{
            dashboard: Record<string, unknown>;
            meta: { folderTitle?: string; version?: number };
          }>(`/api/dashboards/uid/${uid}`).pipe(
            Effect.map(
              ({ dashboard, meta }) =>
                new DashboardDetail({
                  uid: String(dashboard.uid ?? uid),
                  title: String(dashboard.title ?? ""),
                  json: JSON.stringify(dashboard),
                  version: meta.version ?? 0,
                  folderTitle: meta.folderTitle,
                }),
            ),
          ),
        ),

      createDashboard: (dashboardJson, folderUid, message) =>
        post<{ uid: string; version: number; url: string }>("/api/dashboards/db", {
          dashboard: JSON.parse(dashboardJson),
          folderUid,
          message,
          overwrite: false,
        }).pipe(
          Effect.flatMap((res) =>
            get<{ dashboard: Record<string, unknown>; meta: { version: number } }>(
              `/api/dashboards/uid/${res.uid}`,
            ).pipe(
              Effect.map(
                ({ dashboard, meta }) =>
                  new DashboardDetail({
                    uid: res.uid,
                    title: String(dashboard.title ?? ""),
                    json: JSON.stringify(dashboard),
                    version: meta.version,
                  }),
              ),
            ),
          ),
        ),

      updateDashboard: (uid, dashboardJson, message) =>
        mapNotFound(
          "dashboard",
          uid,
          get<{ dashboard: Record<string, unknown>; meta: { version: number } }>(
            `/api/dashboards/uid/${uid}`,
          ).pipe(
            Effect.flatMap(({ dashboard: _dashboard, meta }) => {
              const updated = { ...JSON.parse(dashboardJson), uid, version: meta.version };
              return post<{ uid: string }>("/api/dashboards/db", {
                dashboard: updated,
                message,
                overwrite: true,
              });
            }),
            Effect.flatMap((res) =>
              get<{ dashboard: Record<string, unknown>; meta: { version: number } }>(
                `/api/dashboards/uid/${res.uid}`,
              ).pipe(
                Effect.map(
                  ({ dashboard, meta }) =>
                    new DashboardDetail({
                      uid: res.uid,
                      title: String(dashboard.title ?? ""),
                      json: JSON.stringify(dashboard),
                      version: meta.version,
                    }),
                ),
              ),
            ),
          ),
        ),

      deleteDashboard: (uid) => mapNotFound("dashboard", uid, del(`/api/dashboards/uid/${uid}`)),

      listDatasources: () =>
        get<
          Array<{
            id: number;
            uid: string;
            name: string;
            type: string;
            url: string;
            isDefault: boolean;
          }>
        >("/api/datasources").pipe(
          Effect.map((items) =>
            items.map(
              (d) =>
                new Datasource({
                  id: d.id,
                  uid: d.uid,
                  name: d.name,
                  type: d.type,
                  url: d.url ?? "",
                  isDefault: d.isDefault ?? false,
                }),
            ),
          ),
        ),

      getDatasource: (uid) =>
        mapNotFound(
          "datasource",
          uid,
          get<{
            id: number;
            uid: string;
            name: string;
            type: string;
            url: string;
            isDefault: boolean;
          }>(`/api/datasources/uid/${uid}`).pipe(
            Effect.map(
              (d) =>
                new Datasource({
                  id: d.id,
                  uid: d.uid,
                  name: d.name,
                  type: d.type,
                  url: d.url ?? "",
                  isDefault: d.isDefault ?? false,
                }),
            ),
          ),
        ),

      createDatasource: (name, type, url, isDefault = false) =>
        post<{
          datasource: {
            id: number;
            uid: string;
            name: string;
            type: string;
            url: string;
            isDefault: boolean;
          };
        }>("/api/datasources", { name, type, url, access: "proxy", isDefault }).pipe(
          Effect.map(
            ({ datasource: d }) =>
              new Datasource({
                id: d.id,
                uid: d.uid,
                name: d.name,
                type: d.type,
                url: d.url ?? "",
                isDefault: d.isDefault ?? false,
              }),
          ),
        ),

      deleteDatasource: (uid) => mapNotFound("datasource", uid, del(`/api/datasources/uid/${uid}`)),

      listAlertRules: () =>
        get<
          Array<{
            uid: string;
            title: string;
            condition: string;
            folderUID: string;
            ruleGroup: string;
            noDataState: string;
            execErrState: string;
          }>
        >("/api/v1/provisioning/alert-rules").pipe(
          Effect.map((items) =>
            items.map(
              (r) =>
                new AlertRule({
                  uid: r.uid,
                  title: r.title,
                  condition: r.condition,
                  folderUID: r.folderUID,
                  ruleGroup: r.ruleGroup,
                  noDataState: r.noDataState,
                  execErrState: r.execErrState,
                }),
            ),
          ),
        ),

      getAlertRule: (uid) =>
        mapNotFound(
          "alert-rule",
          uid,
          get<{
            uid: string;
            title: string;
            condition: string;
            folderUID: string;
            ruleGroup: string;
            noDataState: string;
            execErrState: string;
          }>(`/api/v1/provisioning/alert-rules/${uid}`).pipe(
            Effect.map(
              (r) =>
                new AlertRule({
                  uid: r.uid,
                  title: r.title,
                  condition: r.condition,
                  folderUID: r.folderUID,
                  ruleGroup: r.ruleGroup,
                  noDataState: r.noDataState,
                  execErrState: r.execErrState,
                }),
            ),
          ),
        ),

      listAlertInstances: () =>
        get<
          Array<{
            labels: Record<string, string>;
            status: { state: string };
            activeAt?: string;
          }>
        >("/api/alertmanager/grafana/api/v2/alerts").pipe(
          Effect.map((items) =>
            items.map(
              (a) =>
                new AlertInstance({
                  labels: a.labels,
                  state: a.status?.state ?? "unknown",
                  activeAt: a.activeAt,
                }),
            ),
          ),
        ),

      listFolders: () =>
        get<Array<{ uid: string; title: string; url: string }>>("/api/folders").pipe(
          Effect.map((items) =>
            items.map((f) => new Folder({ uid: f.uid, title: f.title, url: f.url })),
          ),
        ),

      createFolder: (title, uid) =>
        post<{ uid: string; title: string; url: string }>("/api/folders", {
          title,
          ...(uid !== undefined ? { uid } : {}),
        }).pipe(Effect.map((f) => new Folder({ uid: f.uid, title: f.title, url: f.url }))),

      deleteFolder: (uid) => mapNotFound("folder", uid, del(`/api/folders/${uid}`)),

      listAnnotations: (dashboardUID, limit = 100) => {
        const params = new URLSearchParams({ limit: String(limit) });
        if (dashboardUID !== undefined) params.set("dashboardUID", dashboardUID);
        return get<
          Array<{
            id: number;
            dashboardUID?: string;
            time: number;
            timeEnd?: number;
            text: string;
            tags: string[];
          }>
        >(`/api/annotations?${params.toString()}`).pipe(
          Effect.map((items) =>
            items.map(
              (a) =>
                new Annotation({
                  id: a.id,
                  dashboardUID: a.dashboardUID,
                  time: a.time,
                  timeEnd: a.timeEnd,
                  text: a.text,
                  tags: a.tags ?? [],
                }),
            ),
          ),
        );
      },

      createAnnotation: (text, tags, dashboardUID, time, timeEnd) =>
        post<{ id: number }>("/api/annotations", {
          text,
          tags,
          ...(dashboardUID !== undefined ? { dashboardUID } : {}),
          ...(time !== undefined ? { time } : {}),
          ...(timeEnd !== undefined ? { timeEnd } : {}),
        }).pipe(
          Effect.map(
            ({ id }) =>
              new Annotation({
                id,
                dashboardUID,
                time: time ?? Date.now(),
                timeEnd,
                text,
                tags,
              }),
          ),
        ),

      healthCheck: () =>
        get<{ commit: string; database: string; version: string }>("/api/health").pipe(
          Effect.map(
            (h) =>
              new HealthStatus({
                commit: h.commit,
                database: h.database,
                version: h.version,
              }),
          ),
        ),
    };
  }),
);
