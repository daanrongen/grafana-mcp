# grafana-mcp

MCP server for [Grafana](https://grafana.com/) — manage dashboards, datasources, alert rules, folders, and annotations over stdio.

## Installation

```bash
bunx @daanrongen/grafana-mcp
```

## Tools (17 total)

| Domain          | Tools                                                                                        | Coverage                                       |
| --------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Dashboards**  | `list_dashboards`, `get_dashboard`, `create_dashboard`, `update_dashboard`, `delete_dashboard` | Full dashboard lifecycle                     |
| **Datasources** | `list_datasources`, `get_datasource`, `create_datasource`, `delete_datasource`               | Datasource management                          |
| **Alerts**      | `list_alert_rules`, `get_alert_rule`, `list_alert_instances`                                 | Alert rules and firing Alertmanager instances  |
| **Folders**     | `list_folders`, `create_folder`, `delete_folder`                                             | Folder organisation                            |
| **Annotations** | `list_annotations`, `create_annotation`                                                      | Dashboard and global annotations               |
| **Health**      | `health_check`                                                                               | Grafana instance status                        |

## Configuration

| Variable          | Required | Description                                     |
| ----------------- | -------- | ----------------------------------------------- |
| `GRAFANA_URL`     | Yes      | Grafana base URL (e.g. `http://localhost:3000`) |
| `GRAFANA_API_KEY` | Yes      | Grafana service account token or API key        |

## Setup

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "grafana": {
      "type": "stdio",
      "command": "bunx",
      "args": ["@daanrongen/grafana-mcp"],
      "env": {
        "GRAFANA_URL": "http://localhost:3000",
        "GRAFANA_API_KEY": "your-service-account-token"
      }
    }
  }
}
```

### Claude Code CLI

```bash
claude mcp add grafana \
  -e GRAFANA_URL=http://localhost:3000 \
  -e GRAFANA_API_KEY=your-service-account-token \
  -- bunx @daanrongen/grafana-mcp
```

## Development

```bash
bun install
bun run dev        # run with --watch
bun test           # run test suite
bun run typecheck  # type-check with tsc
bun run lint       # biome lint
bun run format     # biome format
bun run build      # bundle to dist/main.js
```

## Inspecting locally

Use the MCP Inspector to browse and call tools interactively against a real Grafana instance:

```bash
GRAFANA_URL=http://localhost:3000 \
GRAFANA_API_KEY=your-service-account-token \
bun run inspect
```

This opens the MCP Inspector UI in the browser, pointed at the locally built server.

## Architecture

```
src/
├── config.ts                   # Effect Config — GRAFANA_URL, GRAFANA_API_KEY
├── main.ts                     # Entry point — ManagedRuntime + StdioServerTransport
├── domain/
│   ├── GrafanaClient.ts        # Context.Tag service interface (port)
│   ├── errors.ts               # GrafanaError, NotFoundError
│   ├── models.ts               # Schema.Class models (Dashboard, Datasource, AlertRule, …)
│   ├── dashboards.test.ts      # Domain tests using GrafanaClientTest
│   ├── datasources.test.ts     # Domain tests using GrafanaClientTest
│   └── health.test.ts          # Domain tests using GrafanaClientTest
├── infra/
│   ├── GrafanaClientLive.ts    # Layer using fetch against the Grafana HTTP API
│   └── GrafanaClientTest.ts    # In-memory Ref-based test adapter
└── mcp/
    ├── server.ts               # McpServer wired to ManagedRuntime
    ├── utils.ts                # formatSuccess, formatError
    └── tools/                  # dashboards.ts, datasources.ts, alerts.ts, folders.ts, annotations.ts, health.ts
```

## License

MIT
