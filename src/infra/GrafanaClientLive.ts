import { Effect, Layer, Redacted, Schema } from "effect";
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

// ---------------------------------------------------------------------------
// Response schemas — these describe the raw JSON shapes returned by Grafana.
// They are intentionally separate from the domain models so each layer owns
// its own concerns (raw API shape vs. domain representation).
// ---------------------------------------------------------------------------

const SearchItemSchema = Schema.Struct({
  uid: Schema.String,
  title: Schema.String,
  url: Schema.String,
  folderTitle: Schema.optional(Schema.String),
  tags: Schema.Array(Schema.String),
});

const DashboardEnvelopeSchema = Schema.Struct({
  dashboard: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  meta: Schema.Struct({
    folderTitle: Schema.optional(Schema.String),
    version: Schema.optional(Schema.Number),
  }),
});

const CreateDashboardResponseSchema = Schema.Struct({
  uid: Schema.String,
  version: Schema.Number,
  url: Schema.String,
});

const UpdateDashboardResponseSchema = Schema.Struct({
  uid: Schema.String,
});

const DatasourceSchema = Schema.Struct({
  id: Schema.Number,
  uid: Schema.String,
  name: Schema.String,
  type: Schema.String,
  url: Schema.String,
  isDefault: Schema.Boolean,
});

const CreateDatasourceResponseSchema = Schema.Struct({
  datasource: DatasourceSchema,
});

const AlertRuleSchema = Schema.Struct({
  uid: Schema.String,
  title: Schema.String,
  condition: Schema.String,
  folderUID: Schema.String,
  ruleGroup: Schema.String,
  noDataState: Schema.String,
  execErrState: Schema.String,
});

const AlertInstanceSchema = Schema.Struct({
  labels: Schema.Record({ key: Schema.String, value: Schema.String }),
  status: Schema.Struct({ state: Schema.String }),
  activeAt: Schema.optional(Schema.String),
});

const FolderSchema = Schema.Struct({
  uid: Schema.String,
  title: Schema.String,
  url: Schema.String,
});

const AnnotationSchema = Schema.Struct({
  id: Schema.Number,
  dashboardUID: Schema.optional(Schema.String),
  time: Schema.Number,
  timeEnd: Schema.optional(Schema.Number),
  text: Schema.String,
  tags: Schema.Array(Schema.String),
});

const CreateAnnotationResponseSchema = Schema.Struct({
  id: Schema.Number,
});

const HealthStatusSchema = Schema.Struct({
  commit: Schema.String,
  database: Schema.String,
  version: Schema.String,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Internal sentinel thrown inside fetch helpers when the server returns a
 * non-OK status. Carrying the numeric status code lets `mapNotFound` check
 * `status === 404` directly instead of sniffing the error message string.
 */
class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const wrapFetch = (
  label: string,
  fn: () => Promise<unknown>,
): Effect.Effect<unknown, GrafanaError> =>
  Effect.tryPromise({
    try: fn,
    catch: (e) =>
      e instanceof HttpError
        ? new GrafanaError({ message: `${label} failed: HTTP ${e.status} ${e.message}`, cause: e })
        : new GrafanaError({ message: `${label} failed`, cause: e }),
  });

/**
 * Decode an unknown value against a schema, wrapping any parse failure as a
 * GrafanaError so it stays in the typed error channel.
 */
const decode =
  <A, I>(schema: Schema.Schema<A, I>) =>
  (raw: unknown): Effect.Effect<A, GrafanaError> =>
    Schema.decodeUnknown(schema)(raw).pipe(
      Effect.mapError(
        (e) =>
          new GrafanaError({
            message: `Response validation failed: ${e.message}`,
            cause: e,
          }),
      ),
    );

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

    const get = (path: string): Effect.Effect<unknown, GrafanaError> =>
      wrapFetch(`GET ${path}`, async () => {
        const res = await fetch(`${baseUrl}${path}`, { headers });
        if (!res.ok) {
          const text = await res.text();
          throw new HttpError(res.status, text);
        }
        return res.json();
      });

    const post = (path: string, body: unknown): Effect.Effect<unknown, GrafanaError> =>
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
        return res.json();
      });

    const del = (path: string): Effect.Effect<void, GrafanaError> =>
      wrapFetch(`DELETE ${path}`, async () => {
        const res = await fetch(`${baseUrl}${path}`, { method: "DELETE", headers });
        if (!res.ok) {
          const text = await res.text();
          throw new HttpError(res.status, text);
        }
      }) as Effect.Effect<void, GrafanaError>;

    const mapNotFound = <A>(
      resource: string,
      id: string,
      effect: Effect.Effect<A, GrafanaError>,
    ): Effect.Effect<A, GrafanaError | NotFoundError> =>
      Effect.catchAll(effect, (e): Effect.Effect<never, GrafanaError | NotFoundError> => {
        if (e.cause instanceof HttpError && e.cause.status === 404) {
          return Effect.fail(new NotFoundError({ resource, id }));
        }
        return Effect.fail(e);
      });

    return {
      listDashboards: (query, limit = 100) =>
        get(
          `/api/search?type=dash-db&limit=${limit}${query ? `&query=${encodeURIComponent(query)}` : ""}`,
        ).pipe(
          Effect.flatMap(decode(Schema.Array(SearchItemSchema))),
          Effect.map((items) =>
            items.map(
              (d) =>
                new Dashboard({
                  uid: d.uid,
                  title: d.title,
                  url: d.url,
                  folderTitle: d.folderTitle,
                  tags: [...(d.tags ?? [])],
                }),
            ),
          ),
        ),

      getDashboard: (uid) =>
        mapNotFound(
          "dashboard",
          uid,
          get(`/api/dashboards/uid/${uid}`).pipe(
            Effect.flatMap(decode(DashboardEnvelopeSchema)),
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
        post("/api/dashboards/db", {
          dashboard: JSON.parse(dashboardJson),
          folderUid,
          message,
          overwrite: false,
        }).pipe(
          Effect.flatMap(decode(CreateDashboardResponseSchema)),
          Effect.flatMap((res) =>
            get(`/api/dashboards/uid/${res.uid}`).pipe(
              Effect.flatMap(decode(DashboardEnvelopeSchema)),
              Effect.map(
                ({ dashboard, meta }) =>
                  new DashboardDetail({
                    uid: res.uid,
                    title: String(dashboard.title ?? ""),
                    json: JSON.stringify(dashboard),
                    version: meta.version ?? 0,
                  }),
              ),
            ),
          ),
        ),

      updateDashboard: (uid, dashboardJson, message) =>
        mapNotFound(
          "dashboard",
          uid,
          get(`/api/dashboards/uid/${uid}`).pipe(
            Effect.flatMap(decode(DashboardEnvelopeSchema)),
            Effect.flatMap(({ dashboard: _dashboard, meta }) => {
              const updated = { ...JSON.parse(dashboardJson), uid, version: meta.version };
              return post("/api/dashboards/db", {
                dashboard: updated,
                message,
                overwrite: true,
              });
            }),
            Effect.flatMap(decode(UpdateDashboardResponseSchema)),
            Effect.flatMap((res) =>
              get(`/api/dashboards/uid/${res.uid}`).pipe(
                Effect.flatMap(decode(DashboardEnvelopeSchema)),
                Effect.map(
                  ({ dashboard, meta }) =>
                    new DashboardDetail({
                      uid: res.uid,
                      title: String(dashboard.title ?? ""),
                      json: JSON.stringify(dashboard),
                      version: meta.version ?? 0,
                    }),
                ),
              ),
            ),
          ),
        ),

      deleteDashboard: (uid) => mapNotFound("dashboard", uid, del(`/api/dashboards/uid/${uid}`)),

      listDatasources: () =>
        get("/api/datasources").pipe(
          Effect.flatMap(decode(Schema.Array(DatasourceSchema))),
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
          get(`/api/datasources/uid/${uid}`).pipe(
            Effect.flatMap(decode(DatasourceSchema)),
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
        post("/api/datasources", { name, type, url, access: "proxy", isDefault }).pipe(
          Effect.flatMap(decode(CreateDatasourceResponseSchema)),
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
        get("/api/v1/provisioning/alert-rules").pipe(
          Effect.flatMap(decode(Schema.Array(AlertRuleSchema))),
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
          get(`/api/v1/provisioning/alert-rules/${uid}`).pipe(
            Effect.flatMap(decode(AlertRuleSchema)),
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
        get("/api/alertmanager/grafana/api/v2/alerts").pipe(
          Effect.flatMap(decode(Schema.Array(AlertInstanceSchema))),
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
        get("/api/folders").pipe(
          Effect.flatMap(decode(Schema.Array(FolderSchema))),
          Effect.map((items) =>
            items.map((f) => new Folder({ uid: f.uid, title: f.title, url: f.url })),
          ),
        ),

      createFolder: (title, uid) =>
        post("/api/folders", {
          title,
          ...(uid !== undefined ? { uid } : {}),
        }).pipe(
          Effect.flatMap(decode(FolderSchema)),
          Effect.map((f) => new Folder({ uid: f.uid, title: f.title, url: f.url })),
        ),

      deleteFolder: (uid) => mapNotFound("folder", uid, del(`/api/folders/${uid}`)),

      listAnnotations: (dashboardUID, limit = 100) => {
        const params = new URLSearchParams({ limit: String(limit) });
        if (dashboardUID !== undefined) params.set("dashboardUID", dashboardUID);
        return get(`/api/annotations?${params.toString()}`).pipe(
          Effect.flatMap(decode(Schema.Array(AnnotationSchema))),
          Effect.map((items) =>
            items.map(
              (a) =>
                new Annotation({
                  id: a.id,
                  dashboardUID: a.dashboardUID,
                  time: a.time,
                  timeEnd: a.timeEnd,
                  text: a.text,
                  tags: [...(a.tags ?? [])],
                }),
            ),
          ),
        );
      },

      createAnnotation: (text, tags, dashboardUID, time, timeEnd) =>
        post("/api/annotations", {
          text,
          tags,
          ...(dashboardUID !== undefined ? { dashboardUID } : {}),
          ...(time !== undefined ? { time } : {}),
          ...(timeEnd !== undefined ? { timeEnd } : {}),
        }).pipe(
          Effect.flatMap(decode(CreateAnnotationResponseSchema)),
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
        get("/api/health").pipe(
          Effect.flatMap(decode(HealthStatusSchema)),
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
