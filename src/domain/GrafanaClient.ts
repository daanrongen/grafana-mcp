import { Context, type Effect } from "effect";
import type { GrafanaError, NotFoundError } from "./errors.ts";
import type {
  AlertInstance,
  AlertRule,
  Annotation,
  Dashboard,
  DashboardDetail,
  Datasource,
  Folder,
  HealthStatus,
} from "./models.ts";

export interface GrafanaClientService {
  // Dashboards
  readonly listDashboards: (
    query?: string,
    limit?: number,
  ) => Effect.Effect<Dashboard[], GrafanaError>;
  readonly getDashboard: (
    uid: string,
  ) => Effect.Effect<DashboardDetail, GrafanaError | NotFoundError>;
  readonly createDashboard: (
    dashboardJson: string,
    folderUid?: string,
    message?: string,
  ) => Effect.Effect<DashboardDetail, GrafanaError>;
  readonly updateDashboard: (
    uid: string,
    dashboardJson: string,
    message?: string,
  ) => Effect.Effect<DashboardDetail, GrafanaError | NotFoundError>;
  readonly deleteDashboard: (uid: string) => Effect.Effect<void, GrafanaError | NotFoundError>;

  // Datasources
  readonly listDatasources: () => Effect.Effect<Datasource[], GrafanaError>;
  readonly getDatasource: (uid: string) => Effect.Effect<Datasource, GrafanaError | NotFoundError>;
  readonly createDatasource: (
    name: string,
    type: string,
    url: string,
    isDefault?: boolean,
  ) => Effect.Effect<Datasource, GrafanaError>;
  readonly deleteDatasource: (uid: string) => Effect.Effect<void, GrafanaError | NotFoundError>;

  // Alert rules
  readonly listAlertRules: () => Effect.Effect<AlertRule[], GrafanaError>;
  readonly getAlertRule: (uid: string) => Effect.Effect<AlertRule, GrafanaError | NotFoundError>;
  readonly listAlertInstances: () => Effect.Effect<AlertInstance[], GrafanaError>;

  // Folders
  readonly listFolders: () => Effect.Effect<Folder[], GrafanaError>;
  readonly createFolder: (title: string, uid?: string) => Effect.Effect<Folder, GrafanaError>;
  readonly deleteFolder: (uid: string) => Effect.Effect<void, GrafanaError | NotFoundError>;

  // Annotations
  readonly listAnnotations: (
    dashboardUID?: string,
    limit?: number,
  ) => Effect.Effect<Annotation[], GrafanaError>;
  readonly createAnnotation: (
    text: string,
    tags: string[],
    dashboardUID?: string,
    time?: number,
    timeEnd?: number,
  ) => Effect.Effect<Annotation, GrafanaError>;

  // Health
  readonly healthCheck: () => Effect.Effect<HealthStatus, GrafanaError>;
}

export class GrafanaClient extends Context.Tag("GrafanaClient")<
  GrafanaClient,
  GrafanaClientService
>() {}
