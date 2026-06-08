# Autify for Web MCP Server — Design

- **Date**: 2026-06-08
- **Package**: `@lambda-script/autify-mcp`
- **Status**: Approved design (pre-implementation)

## 1. Purpose

Provide a Model Context Protocol (MCP) server that exposes the **Autify for Web** public REST API to MCP clients (e.g. Claude Code). It lets an AI agent inspect test scenarios/results, trigger test runs, wait for completion, and manage test-plan configuration — all type-safely against Autify's published OpenAPI spec.

- Target API: **Autify for Web** only (not Mobile, not Nexus/Genesis).
- Base URL: `https://app.autify.com/api/v1/`
- Auth: HTTP Bearer token (`Authorization: Bearer <token>`).
- Distribution: OSS repository `autify-mcp`, published as `@lambda-script/autify-mcp`.
- Transport: stdio (consistent with the existing `reg-suit-mcp` / `mercury` servers).

## 2. Scope

Full coverage of all **22** Autify for Web endpoints (read, execute, and configuration-mutation), plus **1** convenience tool. Destructive and billable operations are surfaced but clearly annotated, and can be disabled via a read-only mode.

## 3. Architecture

Follows the established `reg-suit-mcp` layering: thin MCP layer over a typed core, with code generation as the source of truth for API types.

```
autify-mcp/
├── openapi/
│   └── swagger.yml             # Vendored Autify for Web OpenAPI spec (single source of truth)
├── openapi-ts.config.ts        # openapi-typescript generation config
├── src/
│   ├── index.ts                # shebang entry; load env -> start server over stdio
│   ├── generated/
│   │   └── autify.d.ts         # openapi-typescript output (types only, COMMITTED, zero-runtime)
│   ├── core/
│   │   ├── client.ts           # openapi-fetch createClient<paths>: baseUrl, Bearer, retry/timeout middleware
│   │   ├── config.ts           # env validation (fail fast)
│   │   └── errors.ts           # HTTP status -> normalized, user-facing error messages
│   ├── mcp/
│   │   ├── server.ts           # McpServer construction + tool/resource registration
│   │   ├── tools.ts            # 22 + 1 tool definitions (thin wrappers over the typed client)
│   │   ├── schemas.ts          # Hand-written zod input schemas, guarded against generated types
│   │   ├── resources.ts        # Read resources: project_info, capabilities
│   │   └── context.ts          # DI: passes client + config to tools
│   └── utils/
│       └── logger.ts           # stderr by default (stdout reserved for JSON-RPC); AUTIFY_LOG_FILE optional
├── tests/
│   └── unit/...                # vitest, 80% coverage threshold
├── package.json                # bin: { "autify-mcp": "dist/index.js" }
├── tsup.config.ts              # ESM, Node 20 target, shebang
├── vitest.config.ts
├── eslint.config.js
├── tsconfig.json
├── release-please-config.json
├── README.md / README.ja.md
└── LICENSE (MIT)
```

### 3.1 Type-safety strategy (key decision)

The Autify OpenAPI spec is the single source of truth.

- **API calls — compile-time fully type-safe.** `openapi/swagger.yml` is vendored and committed. `npm run generate` runs `openapi-typescript` to produce `src/generated/autify.d.ts` (types only, zero runtime). `core/client.ts` uses `openapi-fetch` `createClient<paths>()`, so every path, query param, request body, and response is type-checked. Updating the spec → regenerate → TypeScript errors surface any drift.
- **MCP tool inputs — hand-written zod.** The `@modelcontextprotocol/sdk` requires zod input schemas. We author them in `src/mcp/schemas.ts` so we control LLM-facing `.describe()` text (tool-input descriptions are a primary quality surface for agent ergonomics). Each schema is tied to the generated operation request type via a `satisfies` / `z.infer` cross-check, so zod drift from the spec is caught at compile time. This yields both full type safety and good description ergonomics with no second codegen tool.

### 3.2 Tooling choice rationale (maintainability-first)

Chosen: **`openapi-typescript` + `openapi-fetch` + hand-written zod.**
Rejected: `@hey-api/openapi-ts` (one-tool types+SDK+zod).

| Factor | hey-api/openapi-ts | openapi-typescript (+openapi-fetch) |
|---|---|---|
| Version | 0.98.x (pre-1.0) | 7.x / 0.17 (stable semver) |
| Age | ~2 years | ~6 years |
| Releases 2025–2026 | ~498 (very high churn) | ~16 / ~11 (low churn) |
| Maintainers | effectively solo (mrlubos) | drwpow + gzm0 (multiple) |
| Stars / weekly DL | 4.9k / 2.97M | 8.2k / 4.2M+4.85M |

Reasoning: the Autify Web API is small (22 endpoints) and stable, so hey-api's "generate everything" benefit is overkill, while its pre-1.0, ~40-releases/month churn imposes a recurring migration tax that is a poor fit for an OSS repo maintained in intermittent windows. openapi-typescript's maturity, stable semver, low churn, and broader maintainer base minimize long-term maintenance. The original "fully type-safe" goal is met entirely by openapi-fetch's compile-time checking plus the zod `satisfies` guard, so nothing is lost by not using hey-api.

### 3.3 Immutability

All interfaces use `readonly`. Wrapper functions return new objects via spread and never mutate inputs (per repo coding standards).

## 4. Tool Catalog (22 + 1)

Prefix: `autify_`. Annotations — RO = `readOnlyHint`, D = `destructiveHint`. Execute tools carry no `readOnlyHint` (billable, state-changing).

### Read (RO, 10)
- `autify_list_scenarios` — list scenarios in a project
- `autify_describe_scenario` — get one scenario
- `autify_list_results` — list test results
- `autify_describe_result` — get one test result
- `autify_list_capabilities` — list available OS/browser/device capabilities
- `autify_list_access_points` — list Autify Connect access points
- `autify_list_url_replacements` — list URL replacements for a test plan
- `autify_list_test_plan_variables` — list test plan variables
- `autify_get_credit_usage` — get credit usage for a project
- `autify_get_project_info` — get project info

### Execute (billable, state-changing, 2)
- `autify_execute_schedule` — run a test plan via a schedule (`schedule_id`; optional Autify Connect override)
- `autify_execute_scenarios` — run scenarios directly (`project_id`, required `capabilities` + `scenarios`, optional `name`/`execution_type`)

### Configuration mutation (10)
- `autify_update_scenario`
- `autify_duplicate_scenario`
- `autify_create_access_point`
- `autify_delete_access_point` (D)
- `autify_create_url_replacement`
- `autify_update_url_replacement`
- `autify_delete_url_replacement` (D)
- `autify_create_test_plan_variable`
- `autify_update_test_plan_variable`
- `autify_delete_test_plan_variable` (D)

### Convenience (RO, 1)
- `autify_wait_for_result` — poll `describeResult` for a `result_id` until it reaches a terminal status. Test result statuses: `queuing` / `waiting` / `running` (in-progress) → `passed` / `failed` / `skipped` / `internal_error` / `canceled` (terminal). Bounded by `timeoutSec` and `pollIntervalSec` (both with sane caps). This is the primary value-add: an agent can trigger a run (non-blocking, returns `result_id`), then await pass/fail in one flow. Execute tools stay non-blocking and separate.

## 5. Configuration, Auth, Safety

Configuration is via environment variables only (no dotenv; the caller sets them, e.g. `.mcp.json` `env`), consistent with `mercury`.

- `AUTIFY_API_TOKEN` (**required**) — Bearer token. Missing → fail fast at startup with a clear error.
- `AUTIFY_PROJECT_ID` (optional) — default project id; per-tool `project_id` overrides it. Lets single-project users omit it on every call.
- `AUTIFY_BASE_URL` (optional) — override base URL (default `https://app.autify.com/api/v1/`).
- `AUTIFY_READONLY` (optional) — when `true`, execute and mutation tools are **not registered** at all (only the read + wait tools), preventing accidental billable/destructive actions.
- `AUTIFY_LOG_FILE` (optional) — file logging when stderr is swallowed by the host.

Secrets are never written to logs.

## 6. Error Handling

- HTTP status → normalized, user-facing messages: 401 = invalid token, 404 = invalid id, 422 = invalid input, 429 = rate limited (honor `Retry-After`), 5xx = upstream error.
- Tool results return structured text with `isError` set on failure.
- `core/client.ts` middleware: exponential backoff retry on 429/5xx, request timeout.

## 7. Testing

- vitest, **80% coverage threshold** enforced (consistent with repo standards).
- Targets: `core/client.ts` (fetch-mocked happy/error paths, retry/timeout), each tool wrapper's input validation + success/error mapping, `autify_wait_for_result` polling-state transitions to terminal, read-only mode registration diff (mutation tools absent when `AUTIFY_READONLY=true`).
- The generated `src/generated/autify.d.ts` is not itself tested (it is types-only).
- Optional light e2e smoke (requires a real token), opt-in.

## 8. Build & Distribution

- `npm run generate` — run `openapi-typescript` from `openapi/swagger.yml`. Wired into `prebuild`. CI verifies the committed generated output has no diff vs the spec (drift detection).
- `npm run build` — tsup (ESM, Node 20, shebang).
- `bin: { "autify-mcp": "dist/index.js" }`.
- `package.json` `files` includes `openapi/` and generated output.
- release-please for versioning/releases; README in English + Japanese; MIT license.

### Spec update workflow
1. Replace `openapi/swagger.yml` with the latest Autify spec.
2. `npm run generate`.
3. Review type errors / generated diff; reconcile tool wrappers and zod schemas.
4. Commit.

## 9. Out of Scope (YAGNI)

- Autify for Mobile / Nexus / Genesis APIs.
- Streamable HTTP transport (stdio only for now).
- Auto-generated zod (hand-written instead).
- Hosting/proxy concerns beyond a local stdio server.
