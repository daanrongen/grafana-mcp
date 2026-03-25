import { Config } from "effect";

export const GrafanaConfig = Config.all({
  url: Config.string("GRAFANA_URL"),
  apiKey: Config.redacted("GRAFANA_API_KEY"),
});
