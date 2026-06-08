# @lambda-script/autify-mcp

An MCP server that exposes the Autify for Web public API to AI agents.

## Overview

`@lambda-script/autify-mcp` is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that gives MCP clients such as Claude Code and Claude Desktop direct access to the [Autify for Web](https://autify.com/) API. AI agents can read test scenarios and results, execute test plans, and manage test configuration — all through the standard MCP tool and resource interface.

## Install & Run

No installation required. Run the server on demand with:

```sh
npx @lambda-script/autify-mcp
```

**Requirement:** Node.js >=20.3.0.

## Configuration

Add the server to your `.mcp.json` (or `claude_desktop_config.json` for Claude Desktop):

```json
{
  "mcpServers": {
    "autify": {
      "command": "npx",
      "args": ["@lambda-script/autify-mcp"],
      "env": { "AUTIFY_API_TOKEN": "your-token", "AUTIFY_PROJECT_ID": "123" }
    }
  }
}
```

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `AUTIFY_API_TOKEN` | **Yes** | Bearer token for the Autify API. The server exits immediately if this is absent. |
| `AUTIFY_PROJECT_ID` | No | Default project ID used when a tool's `project_id` argument is not supplied. |
| `AUTIFY_BASE_URL` | No | Override the API base URL. Defaults to `https://app.autify.com/api/v1/`. |
| `AUTIFY_READONLY` | No | Set to `"true"` to enable read-only mode (see below). |
| `AUTIFY_LOG_FILE` | No | Path to a log file. When unset, log output goes to stderr. |

## Tools

### Read (10 tools)

These tools are safe, idempotent, and never consume test credits.

| Tool | Description |
|---|---|
| `autify_list_scenarios` | List test scenarios in a project. |
| `autify_describe_scenario` | Get details for a single scenario. |
| `autify_list_results` | List test execution results in a project. |
| `autify_describe_result` | Get details for a single result. |
| `autify_list_capabilities` | List available browser/OS capability combinations. |
| `autify_list_access_points` | List access points configured in a project. |
| `autify_list_url_replacements` | List URL replacement rules for a test plan. |
| `autify_list_test_plan_variables` | List variables defined in a test plan. |
| `autify_get_credit_usage` | Get credit usage summary for a project. |
| `autify_get_project_info` | Get project metadata. |

### Execute — billable (2 tools)

These tools trigger test runs and **consume Autify test credits**. They are disabled in read-only mode.

| Tool | Description |
|---|---|
| `autify_execute_scenarios` | Run one or more test scenarios immediately. |
| `autify_execute_schedule` | Trigger a scheduled test plan execution. |

### Configuration Mutation (10 tools)

These tools create, update, or delete test configuration. Delete operations are **destructive** and irreversible. All are disabled in read-only mode.

| Tool | Description |
|---|---|
| `autify_update_scenario` | Update scenario metadata. |
| `autify_duplicate_scenario` | Duplicate an existing scenario. |
| `autify_create_access_point` | Create a new access point. |
| `autify_delete_access_point` | **Destructive.** Permanently delete an access point. |
| `autify_create_url_replacement` | Create a URL replacement rule. |
| `autify_update_url_replacement` | Update a URL replacement rule. |
| `autify_delete_url_replacement` | **Destructive.** Permanently delete a URL replacement rule. |
| `autify_create_test_plan_variable` | Create a variable in a test plan. |
| `autify_update_test_plan_variable` | Update a test plan variable. |
| `autify_delete_test_plan_variable` | **Destructive.** Permanently delete a test plan variable. |

### Convenience (1 tool)

| Tool | Description |
|---|---|
| `autify_wait_for_result` | Poll a result by ID until it reaches a terminal state (`passed`, `failed`, `skipped`, `internal_error`, or `canceled`). Accepts optional `project_id`, `timeoutSec` (max 1800), and `pollIntervalSec`. |

## Resources

The server exposes two read-only MCP resources. Both use the project configured via `AUTIFY_PROJECT_ID`.

| URI | Description |
|---|---|
| `autify://project_info` | Current project metadata. |
| `autify://capabilities` | Available browser and OS capability combinations. |

## Read-only Mode

Set `AUTIFY_READONLY=true` to start the server in read-only mode. In this mode only the 10 read tools and `autify_wait_for_result` are registered. The 2 execute tools and 10 mutation tools are not available.

This is recommended for deployments where you want to allow inspection of test data without any risk of triggering executions or modifying configuration.

## Development

Clone the repository and install dependencies:

```sh
git clone https://github.com/lambda-script/autify-mcp.git
cd autify-mcp
npm install
```

| Script | Purpose |
|---|---|
| `npm run generate` | Regenerate TypeScript types from `openapi/swagger.yml` via `openapi-typescript`. |
| `npm run build` | Compile and bundle the server to `dist/`. |
| `npm test` | Run the test suite once with Vitest. |
| `npm run test:coverage` | Run tests and generate a coverage report. |
| `npm run lint` | Lint `src/` with ESLint. |
| `npm run typecheck` | Run TypeScript type checking without emitting files. |

### Updating the OpenAPI Spec

1. Replace `openapi/swagger.yml` with the new spec.
2. Run `npm run generate` to regenerate `src/generated/autify.d.ts`.
3. Review the diff — new paths, changed request/response shapes, removed operations.
4. Reconcile any breaking changes in the tool implementations under `src/tools/`.

## License

MIT — see [LICENSE](./LICENSE).
