import { Schema } from "effect";

export class Dashboard extends Schema.Class<Dashboard>("Dashboard")({
  uid: Schema.String,
  title: Schema.String,
  url: Schema.String,
  folderTitle: Schema.optional(Schema.String),
  tags: Schema.Array(Schema.String),
  version: Schema.optional(Schema.Number),
}) {}

export class DashboardDetail extends Schema.Class<DashboardDetail>("DashboardDetail")({
  uid: Schema.String,
  title: Schema.String,
  json: Schema.String,
  version: Schema.Number,
  folderTitle: Schema.optional(Schema.String),
}) {}

export class Datasource extends Schema.Class<Datasource>("Datasource")({
  id: Schema.Number,
  uid: Schema.String,
  name: Schema.String,
  type: Schema.String,
  url: Schema.String,
  isDefault: Schema.Boolean,
}) {}

export class AlertRule extends Schema.Class<AlertRule>("AlertRule")({
  uid: Schema.String,
  title: Schema.String,
  condition: Schema.String,
  folderUID: Schema.String,
  ruleGroup: Schema.String,
  noDataState: Schema.String,
  execErrState: Schema.String,
}) {}

export class AlertInstance extends Schema.Class<AlertInstance>("AlertInstance")({
  labels: Schema.Record({ key: Schema.String, value: Schema.String }),
  state: Schema.String,
  activeAt: Schema.optional(Schema.String),
}) {}

export class Folder extends Schema.Class<Folder>("Folder")({
  uid: Schema.String,
  title: Schema.String,
  url: Schema.optional(Schema.String),
}) {}

export class Annotation extends Schema.Class<Annotation>("Annotation")({
  id: Schema.Number,
  dashboardUID: Schema.optional(Schema.String),
  time: Schema.Number,
  timeEnd: Schema.optional(Schema.Number),
  text: Schema.String,
  tags: Schema.Array(Schema.String),
}) {}

export class HealthStatus extends Schema.Class<HealthStatus>("HealthStatus")({
  commit: Schema.String,
  database: Schema.String,
  version: Schema.String,
}) {}
