# Autify for Web MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@lambda-script/autify-mcp`, an MCP (stdio) server that exposes all 22 Autify for Web public REST endpoints plus a `wait_for_result` convenience tool, fully type-safe against Autify's OpenAPI spec.

**Architecture:** Thin MCP tool/resource layer over a typed core. `openapi-typescript` generates types from a vendored spec; `openapi-fetch` gives a compile-time type-safe client. MCP tool inputs use hand-written zod schemas, each guarded against the generated operation types at compile time. Mirrors the sibling `reg-suit-mcp` repo's layering and conventions.

**Tech Stack:** TypeScript (ESM, Node 20+), `@modelcontextprotocol/sdk`, `openapi-fetch`, `zod`, `openapi-typescript` (dev), tsup, vitest, eslint (typescript-eslint), release-please.

---

## Conventions (from sibling repos `reg-suit-mcp` / `mercury`)

- ESM only (`"type": "module"`), import paths end in `.js`.
- `tsconfig`: `strict`, `noUncheckedIndexedAccess`, `moduleResolution: bundler`, target ES2022.
- eslint: `no-console: error` (all diagnostics go through the logger to stderr), unused vars allowed with `_` prefix.
- vitest: 80% coverage threshold on lines/functions/branches/statements; `src/index.ts` and `*.d.ts` excluded from coverage.
- Errors never cross the MCP boundary as raw throws — they are mapped to a structured `{ code, message, hint?, meta? }` payload with `isError: true`.
- Immutability: all interfaces `readonly`; never mutate inputs.
- Logger writes JSON lines to stderr (stdout reserved for JSON-RPC) and redacts secret-looking keys.

## File Structure

```
autify-mcp/
├── openapi/swagger.yml              # vendored Autify for Web spec (source of truth)
├── openapi-ts.config.ts             # openapi-typescript config
├── package.json / tsconfig.json / tsup.config.ts / vitest.config.ts / eslint.config.js
├── src/
│   ├── index.ts                     # CLI entry: parse args, resolve config, connect stdio
│   ├── generated/autify.d.ts        # openapi-typescript output (COMMITTED, types only)
│   ├── core/
│   │   ├── types.ts                 # AutifyMcpError, Logger, LogLevel, config types
│   │   ├── errors.ts                # getErrorMessage, toAutifyMcpError, mapHttpError
│   │   ├── config.ts                # env resolution + validation (fail fast)
│   │   └── client.ts               # openapi-fetch client + retry/timeout fetch
│   ├── mcp/
│   │   ├── server.ts                # McpServer assembly
│   │   ├── context.ts               # ServerContext (config, logger, client)
│   │   ├── tool-helpers.ts          # jsonResult / errorResult / guard
│   │   ├── schemas.ts               # hand-written zod input schemas + type guards
│   │   ├── tools.ts                 # registerTools aggregator + readonly gating
│   │   ├── tools-read.ts            # 10 read tools
│   │   ├── tools-execute.ts         # 2 execute tools
│   │   ├── tools-mutate.ts          # 10 mutation tools
│   │   ├── tools-wait.ts            # wait_for_result polling tool
│   │   └── resources.ts             # project_info + capabilities resources
│   └── utils/logger.ts              # stderr/file JSON logger with redaction
└── tests/unit/*.test.ts
```

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `eslint.config.js`, `.npmignore`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "@lambda-script/autify-mcp",
  "version": "0.1.0",
  "description": "MCP server exposing the Autify for Web public API to AI agents (scenarios, results, test execution, and test-plan configuration).",
  "type": "module",
  "bin": { "autify-mcp": "dist/index.js" },
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } },
  "files": ["dist", "openapi"],
  "scripts": {
    "generate": "openapi-typescript openapi/swagger.yml -o src/generated/autify.d.ts",
    "prebuild": "npm run generate",
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  },
  "keywords": ["mcp", "model-context-protocol", "autify", "e2e", "testing", "claude", "anthropic"],
  "author": "lambda-script",
  "license": "MIT",
  "repository": { "type": "git", "url": "git+https://github.com/lambda-script/autify-mcp.git" },
  "homepage": "https://github.com/lambda-script/autify-mcp#readme",
  "bugs": { "url": "https://github.com/lambda-script/autify-mcp/issues" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "openapi-fetch": "^0.17.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@eslint/js": "^9.17.0",
    "@types/node": "^22.10.0",
    "@vitest/coverage-v8": "^2.1.8",
    "eslint": "^9.17.0",
    "openapi-typescript": "^7.13.0",
    "tsup": "^8.3.5",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2",
    "typescript-eslint": "^8.18.0",
    "vitest": "^2.1.8"
  },
  "engines": { "node": ">=20.0.0" }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Write `tsup.config.ts`**

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "node20",
  banner: { js: "#!/usr/bin/env node" },
});
```

- [ ] **Step 4: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/**/*.d.ts", "src/generated/**"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
```

- [ ] **Step 5: Write `eslint.config.js`**

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": "error",
    },
  },
  { ignores: ["dist/", "node_modules/", "tests/", "src/generated/", "*.config.*"] },
);
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, lockfile written, no peer errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsup.config.ts vitest.config.ts eslint.config.js
git commit -m "chore: scaffold project tooling"
```

---

## Task 2: Vendor the OpenAPI spec and generate types

**Files:**
- Create: `openapi/swagger.yml`, `openapi-ts.config.ts`
- Create (generated): `src/generated/autify.d.ts`

- [ ] **Step 1: Vendor the spec**

Run: `mkdir -p openapi && curl -fsSL https://raw.githubusercontent.com/autifyhq/autify-api/main/swagger.yml -o openapi/swagger.yml`
Expected: `openapi/swagger.yml` exists; `grep -c "operationId" openapi/swagger.yml` returns 22.

- [ ] **Step 2: Write `openapi-ts.config.ts`** (documents the generation; the `generate` script calls the CLI directly)

```ts
// openapi-typescript is driven by the `generate` npm script:
//   openapi-typescript openapi/swagger.yml -o src/generated/autify.d.ts
// This file documents the intent and pins options if we later switch to the JS API.
export default {
  input: "openapi/swagger.yml",
  output: "src/generated/autify.d.ts",
};
```

- [ ] **Step 3: Generate types**

Run: `npm run generate`
Expected: `src/generated/autify.d.ts` created, exporting `paths`, `components`, `operations`.

- [ ] **Step 4: Verify the generated types compile and expose operations**

Run: `npx tsc --noEmit src/generated/autify.d.ts`
Expected: no errors. Confirm `grep -c "executeScenarios" src/generated/autify.d.ts` ≥ 1.

- [ ] **Step 5: Commit (generated output is committed)**

```bash
git add openapi/swagger.yml openapi-ts.config.ts src/generated/autify.d.ts
git commit -m "feat: vendor Autify Web OpenAPI spec and generate types"
```

---

## Task 3: Core types and error class

**Files:**
- Create: `src/core/types.ts`
- Test: `tests/unit/types.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/types.test.ts
import { describe, it, expect } from "vitest";
import { AutifyMcpError } from "../../src/core/types.js";

describe("AutifyMcpError", () => {
  it("carries code, hint, and meta", () => {
    const err = new AutifyMcpError("boom", {
      code: "not_found",
      hint: "check id",
      meta: { id: 1 },
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("AutifyMcpError");
    expect(err.code).toBe("not_found");
    expect(err.hint).toBe("check id");
    expect(err.meta).toEqual({ id: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/types.test.ts`
Expected: FAIL — cannot find module `src/core/types.js`.

- [ ] **Step 3: Write `src/core/types.ts`**

```ts
/** Stable, machine-branchable error codes surfaced to MCP clients. */
export type AutifyMcpErrorCode =
  | "unauthorized"
  | "not_found"
  | "invalid_input"
  | "rate_limited"
  | "upstream"
  | "timeout"
  | "internal";

export interface AutifyMcpErrorDetails {
  readonly code: AutifyMcpErrorCode;
  readonly hint?: string;
  readonly meta?: Readonly<Record<string, unknown>>;
}

/** The only error type allowed to describe a failed tool/resource call. */
export class AutifyMcpError extends Error {
  readonly code: AutifyMcpErrorCode;
  readonly hint?: string;
  readonly meta?: Readonly<Record<string, unknown>>;

  constructor(message: string, details: AutifyMcpErrorDetails) {
    super(message);
    this.name = "AutifyMcpError";
    this.code = details.code;
    this.hint = details.hint;
    this.meta = details.meta;
  }
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

/** Fully resolved runtime configuration. */
export interface ResolvedConfig {
  readonly apiToken: string;
  readonly baseUrl: string;
  readonly defaultProjectId?: number;
  readonly readonly: boolean;
  readonly logLevel: LogLevel;
  readonly logFile?: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/types.ts tests/unit/types.test.ts
git commit -m "feat: add core types and AutifyMcpError"
```

---

## Task 4: Logger

**Files:**
- Create: `src/utils/logger.ts`
- Test: `tests/unit/logger.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/logger.test.ts
import { describe, it, expect } from "vitest";
import { createLogger, resolveLogLevel, redact } from "../../src/utils/logger.js";

describe("logger", () => {
  it("resolves levels with a default of info", () => {
    expect(resolveLogLevel("debug")).toBe("debug");
    expect(resolveLogLevel("NOPE")).toBe("info");
    expect(resolveLogLevel(undefined)).toBe("info");
  });

  it("redacts secret-looking keys", () => {
    const out = redact({ apiToken: "supersecretvalue", name: "ok" }) as Record<string, unknown>;
    expect(out["name"]).toBe("ok");
    expect(out["apiToken"]).not.toBe("supersecretvalue");
  });

  it("writes JSON lines at or above threshold to the sink", () => {
    const lines: string[] = [];
    const log = createLogger("warn", (l) => lines.push(l));
    log.debug("skip");
    log.warn("kept", { a: 1 });
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.level).toBe("warn");
    expect(parsed.message).toBe("kept");
    expect(parsed.a).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/logger.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/utils/logger.ts`**

```ts
/**
 * Structured logger writing JSON lines to STDERR (stdout is reserved for the
 * JSON-RPC stream). Secret-looking keys are redacted before serialisation.
 */
import { appendFileSync } from "node:fs";

import type { LogLevel, Logger } from "../core/types.js";

const LEVEL_ORDER: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const VALID_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];
const SECRET_KEY_PATTERN = /key|secret|token|password|credential|authorization/i;

export function resolveLogLevel(raw?: string): LogLevel {
  if (raw === undefined) return "info";
  const lower = raw.toLowerCase();
  return (VALID_LEVELS as readonly string[]).includes(lower)
    ? (lower as LogLevel)
    : "info";
}

function maskString(value: string): string {
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}…***`;
}

export function redact(value: unknown): unknown {
  return redactInternal(value, false, new WeakSet<object>());
}

function redactInternal(
  value: unknown,
  parentKeyIsSecret: boolean,
  seen: WeakSet<object>,
): unknown {
  if (typeof value === "string") {
    return parentKeyIsSecret ? maskString(value) : value;
  }
  if (parentKeyIsSecret) {
    if (value === null || value === undefined) return value;
    if (typeof value !== "object") return "***";
  }
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => redactInternal(item, parentKeyIsSecret, seen));
  }
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    out[key] = redactInternal(child, SECRET_KEY_PATTERN.test(key), seen);
  }
  return out;
}

interface LoggerOptions {
  readonly level: LogLevel;
  readonly fields: Readonly<Record<string, unknown>>;
  readonly write: (line: string) => void;
}

function makeLogger(opts: LoggerOptions): Logger {
  const threshold = LEVEL_ORDER[opts.level];
  function emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < threshold) return;
    const merged = { ...opts.fields, ...(meta ?? {}) };
    const safe = redact(merged) as Record<string, unknown>;
    const line = { level, time: new Date().toISOString(), message, ...safe };
    opts.write(`${JSON.stringify(line)}\n`);
  }
  return {
    debug: (m, meta) => emit("debug", m, meta),
    info: (m, meta) => emit("info", m, meta),
    warn: (m, meta) => emit("warn", m, meta),
    error: (m, meta) => emit("error", m, meta),
    child: (fields) =>
      makeLogger({ level: opts.level, fields: { ...opts.fields, ...fields }, write: opts.write }),
  };
}

/** Default sink: a log file if provided, else stderr. Injectable for tests. */
export function createLogger(
  level?: LogLevel,
  write?: (line: string) => void,
  logFile?: string,
): Logger {
  const resolved = level ?? resolveLogLevel(process.env["LOG_LEVEL"]);
  const sink =
    write ??
    (logFile !== undefined
      ? (line: string) => appendFileSync(logFile, line)
      : (line: string) => {
          process.stderr.write(line);
        });
  return makeLogger({ level: resolved, fields: {}, write: sink });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/logger.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/logger.ts tests/unit/logger.test.ts
git commit -m "feat: add stderr/file JSON logger with redaction"
```

---

## Task 5: Errors and HTTP mapping

**Files:**
- Create: `src/core/errors.ts`
- Test: `tests/unit/errors.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/errors.test.ts
import { describe, it, expect } from "vitest";
import { AutifyMcpError } from "../../src/core/types.js";
import { getErrorMessage, toAutifyMcpError, mapHttpError } from "../../src/core/errors.js";

describe("errors", () => {
  it("getErrorMessage extracts from Error/string/object", () => {
    expect(getErrorMessage(new Error("e"))).toBe("e");
    expect(getErrorMessage("s")).toBe("s");
    expect(getErrorMessage({ message: "m" })).toBe("m");
    expect(getErrorMessage(null)).toBe("Unknown error");
  });

  it("toAutifyMcpError passes AutifyMcpError through and wraps others as internal", () => {
    const e = new AutifyMcpError("x", { code: "not_found" });
    expect(toAutifyMcpError(e)).toBe(e);
    const w = toAutifyMcpError("oops");
    expect(w.code).toBe("internal");
    expect(w.message).toBe("oops");
  });

  it("mapHttpError maps status codes to stable codes", () => {
    expect(mapHttpError(401, undefined).code).toBe("unauthorized");
    expect(mapHttpError(404, undefined).code).toBe("not_found");
    expect(mapHttpError(422, { message: "bad" }).code).toBe("invalid_input");
    expect(mapHttpError(429, undefined).code).toBe("rate_limited");
    expect(mapHttpError(500, undefined).code).toBe("upstream");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/errors.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/core/errors.ts`**

```ts
import { AutifyMcpError } from "./types.js";
import type { AutifyMcpErrorCode, AutifyMcpErrorDetails } from "./types.js";

export function isAutifyMcpError(value: unknown): value is AutifyMcpError {
  return value instanceof AutifyMcpError;
}

export function getErrorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "Unknown error";
  if (typeof value === "object") {
    const m = (value as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return String(value);
}

export function toAutifyMcpError(
  value: unknown,
  details?: Partial<AutifyMcpErrorDetails>,
): AutifyMcpError {
  if (isAutifyMcpError(value)) return value;
  return new AutifyMcpError(getErrorMessage(value), {
    code: details?.code ?? "internal",
    hint: details?.hint,
    meta: details?.meta,
  });
}

/** Map an HTTP status + optional parsed error body to a stable AutifyMcpError. */
export function mapHttpError(status: number, body: unknown): AutifyMcpError {
  const message = getErrorMessage(body) || `Autify API returned HTTP ${status}`;
  const base: { code: AutifyMcpErrorCode; hint?: string } =
    status === 401 || status === 403
      ? { code: "unauthorized", hint: "Check AUTIFY_API_TOKEN is valid and authorized." }
      : status === 404
        ? { code: "not_found", hint: "Check the project/scenario/result id." }
        : status === 422
          ? { code: "invalid_input", hint: "Check the request parameters." }
          : status === 429
            ? { code: "rate_limited", hint: "Slow down; honor Retry-After." }
            : { code: "upstream", hint: "Autify API error. Retry later." };
  return new AutifyMcpError(message, { code: base.code, hint: base.hint, meta: { httpStatus: status } });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/errors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/errors.ts tests/unit/errors.test.ts
git commit -m "feat: add error helpers and HTTP status mapping"
```

---

## Task 6: Config resolution

**Files:**
- Create: `src/core/config.ts`
- Test: `tests/unit/config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/config.test.ts
import { describe, it, expect } from "vitest";
import { resolveConfig } from "../../src/core/config.js";
import { AutifyMcpError } from "../../src/core/types.js";

describe("resolveConfig", () => {
  it("throws when token is missing", () => {
    expect(() => resolveConfig({ env: {} })).toThrow(AutifyMcpError);
  });

  it("resolves defaults from env", () => {
    const c = resolveConfig({ env: { AUTIFY_API_TOKEN: "tok" } });
    expect(c.apiToken).toBe("tok");
    expect(c.baseUrl).toBe("https://app.autify.com/api/v1/");
    expect(c.readonly).toBe(false);
    expect(c.defaultProjectId).toBeUndefined();
  });

  it("reads project id, readonly, base url, log file", () => {
    const c = resolveConfig({
      env: {
        AUTIFY_API_TOKEN: "tok",
        AUTIFY_PROJECT_ID: "42",
        AUTIFY_READONLY: "true",
        AUTIFY_BASE_URL: "https://example.test/api/v1/",
        AUTIFY_LOG_FILE: "/tmp/a.log",
      },
    });
    expect(c.defaultProjectId).toBe(42);
    expect(c.readonly).toBe(true);
    expect(c.baseUrl).toBe("https://example.test/api/v1/");
    expect(c.logFile).toBe("/tmp/a.log");
  });

  it("rejects a non-numeric project id", () => {
    expect(() =>
      resolveConfig({ env: { AUTIFY_API_TOKEN: "tok", AUTIFY_PROJECT_ID: "abc" } }),
    ).toThrow(AutifyMcpError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/config.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/core/config.ts`**

```ts
import { AutifyMcpError } from "./types.js";
import type { ResolvedConfig } from "./types.js";
import { resolveLogLevel } from "../utils/logger.js";

const DEFAULT_BASE_URL = "https://app.autify.com/api/v1/";

export interface ResolveConfigOptions {
  readonly env?: NodeJS.ProcessEnv;
}

function parseProjectId(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new AutifyMcpError(`AUTIFY_PROJECT_ID must be a positive integer, got "${raw}".`, {
      code: "invalid_input",
    });
  }
  return n;
}

export function resolveConfig(opts: ResolveConfigOptions = {}): ResolvedConfig {
  const env = opts.env ?? process.env;
  const apiToken = env["AUTIFY_API_TOKEN"]?.trim();
  if (apiToken === undefined || apiToken === "") {
    throw new AutifyMcpError("AUTIFY_API_TOKEN is required.", {
      code: "unauthorized",
      hint: "Set AUTIFY_API_TOKEN to your Autify personal access token.",
    });
  }
  const defaultProjectId = parseProjectId(env["AUTIFY_PROJECT_ID"]);
  const baseUrl = env["AUTIFY_BASE_URL"]?.trim() || DEFAULT_BASE_URL;
  const readonly = env["AUTIFY_READONLY"]?.toLowerCase() === "true";
  const logFile = env["AUTIFY_LOG_FILE"]?.trim() || undefined;
  return {
    apiToken,
    baseUrl,
    ...(defaultProjectId !== undefined ? { defaultProjectId } : {}),
    readonly,
    logLevel: resolveLogLevel(env["LOG_LEVEL"]),
    ...(logFile !== undefined ? { logFile } : {}),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/config.ts tests/unit/config.test.ts
git commit -m "feat: add env config resolution with fail-fast validation"
```

---

## Task 7: Typed client with retry/timeout

**Files:**
- Create: `src/core/client.ts`
- Test: `tests/unit/client.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/client.test.ts
import { describe, it, expect, vi } from "vitest";
import { createRetryingFetch, createAutifyClient } from "../../src/core/client.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("createRetryingFetch", () => {
  it("retries on 429 then succeeds", async () => {
    const calls = [jsonResponse(429, { message: "slow" }), jsonResponse(200, { ok: true })];
    const inner = vi.fn(async () => calls.shift()!);
    const fetchFn = createRetryingFetch({ fetch: inner, retries: 2, baseDelayMs: 0 });
    const res = await fetchFn("https://x/api", {});
    expect(res.status).toBe(200);
    expect(inner).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 404", async () => {
    const inner = vi.fn(async () => jsonResponse(404, { message: "nope" }));
    const fetchFn = createRetryingFetch({ fetch: inner, retries: 3, baseDelayMs: 0 });
    const res = await fetchFn("https://x/api", {});
    expect(res.status).toBe(404);
    expect(inner).toHaveBeenCalledTimes(1);
  });
});

describe("createAutifyClient", () => {
  it("sends the bearer token and base url", async () => {
    const inner = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok");
      return jsonResponse(200, { id: 1 });
    });
    const client = createAutifyClient({
      apiToken: "tok",
      baseUrl: "https://app.autify.com/api/v1/",
      fetch: inner as unknown as typeof fetch,
    });
    const { data } = await client.GET("/projects/{project_id}/project_info", {
      params: { path: { project_id: 1 } },
    });
    expect(data).toEqual({ id: 1 });
    expect(inner).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/client.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/core/client.ts`**

```ts
import createClient from "openapi-fetch";
import type { Client } from "openapi-fetch";

import type { paths } from "../generated/autify.js";

export type AutifyClient = Client<paths>;

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export interface RetryingFetchOptions {
  readonly fetch?: typeof fetch;
  readonly retries?: number;
  readonly baseDelayMs?: number;
  readonly timeoutMs?: number;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Wrap fetch with exponential backoff on retryable statuses + a request timeout. */
export function createRetryingFetch(opts: RetryingFetchOptions = {}): typeof fetch {
  const innerFetch = opts.fetch ?? fetch;
  const retries = opts.retries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 300;
  const timeoutMs = opts.timeoutMs ?? 30_000;

  const wrapped = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    let lastResponse: Response | undefined;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await innerFetch(input, { ...init, signal: controller.signal });
        if (!RETRYABLE_STATUS.has(res.status) || attempt === retries) return res;
        lastResponse = res;
      } finally {
        clearTimeout(timer);
      }
      await sleep(baseDelayMs * 2 ** attempt);
    }
    return lastResponse as Response;
  };
  return wrapped as typeof fetch;
}

export interface CreateAutifyClientOptions {
  readonly apiToken: string;
  readonly baseUrl: string;
  readonly fetch?: typeof fetch;
  readonly retries?: number;
  readonly baseDelayMs?: number;
  readonly timeoutMs?: number;
}

export function createAutifyClient(opts: CreateAutifyClientOptions): AutifyClient {
  const fetchFn = createRetryingFetch({
    ...(opts.fetch !== undefined ? { fetch: opts.fetch } : {}),
    ...(opts.retries !== undefined ? { retries: opts.retries } : {}),
    ...(opts.baseDelayMs !== undefined ? { baseDelayMs: opts.baseDelayMs } : {}),
    ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
  });
  return createClient<paths>({
    baseUrl: opts.baseUrl,
    fetch: fetchFn,
    headers: { Authorization: `Bearer ${opts.apiToken}` },
  });
}
```

> Note: `import type { paths } from "../generated/autify.js"` resolves to the committed `src/generated/autify.d.ts` under bundler resolution. If openapi-typescript's output type is named differently, alias it here.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/client.ts tests/unit/client.test.ts
git commit -m "feat: add typed openapi-fetch client with retry and timeout"
```

---

## Task 8: Tool helpers (result rendering + guard)

**Files:**
- Create: `src/mcp/tool-helpers.ts`
- Test: `tests/unit/tool-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/tool-helpers.test.ts
import { describe, it, expect } from "vitest";
import { AutifyMcpError } from "../../src/core/types.js";
import { jsonResult, errorResult, guard } from "../../src/mcp/tool-helpers.js";
import { createLogger } from "../../src/utils/logger.js";

const logger = createLogger("error", () => {});

describe("tool-helpers", () => {
  it("jsonResult renders pretty JSON text", () => {
    const r = jsonResult({ a: 1 });
    expect(r.content[0]).toMatchObject({ type: "text" });
    expect(JSON.parse((r.content[0] as { text: string }).text)).toEqual({ a: 1 });
  });

  it("errorResult sets isError and a structured payload", () => {
    const r = errorResult(new AutifyMcpError("boom", { code: "not_found", hint: "h" }));
    expect(r.isError).toBe(true);
    const payload = JSON.parse((r.content[0] as { text: string }).text);
    expect(payload).toMatchObject({ code: "not_found", message: "boom", hint: "h" });
  });

  it("guard converts a thrown value into an error result", async () => {
    const r = await guard(logger, "t", async () => {
      throw new AutifyMcpError("nope", { code: "invalid_input" });
    });
    expect(r.isError).toBe(true);
  });

  it("guard returns the handler result on success", async () => {
    const r = await guard(logger, "t", async () => jsonResult({ ok: true }));
    expect(r.isError).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/tool-helpers.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/mcp/tool-helpers.ts`**

```ts
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import type { AutifyMcpError, Logger } from "../core/types.js";
import { toAutifyMcpError } from "../core/errors.js";

export function jsonResult(value: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

export function errorResult(error: AutifyMcpError): CallToolResult {
  const payload = {
    code: error.code,
    message: error.message,
    ...(error.hint !== undefined ? { hint: error.hint } : {}),
    ...(error.meta !== undefined ? { meta: error.meta } : {}),
  };
  return { isError: true, content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

/** Run a tool handler; map any thrown value to a structured error result. */
export function guard(
  logger: Logger,
  toolName: string,
  handler: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  return handler().catch((error: unknown) => {
    const mapped = toAutifyMcpError(error);
    logger.warn("tool failed", { tool: toolName, code: mapped.code, message: mapped.message });
    return errorResult(mapped);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/tool-helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/tool-helpers.ts tests/unit/tool-helpers.test.ts
git commit -m "feat: add MCP tool result helpers and guard"
```

---

## Task 9: zod input schemas (with compile-time type guards)

**Files:**
- Create: `src/mcp/schemas.ts`
- Test: `tests/unit/schemas.test.ts`

All Autify path ids are integers. List queries: scenarios → `page`; results → `page`, `per_page`, `test_plan_id`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/schemas.test.ts
import { describe, it, expect } from "vitest";
import {
  projectIdSchema,
  executeScenariosBodySchema,
  urlReplacementBodySchema,
} from "../../src/mcp/schemas.js";

describe("schemas", () => {
  it("project id accepts positive ints, rejects others", () => {
    expect(projectIdSchema.safeParse(5).success).toBe(true);
    expect(projectIdSchema.safeParse(-1).success).toBe(false);
    expect(projectIdSchema.safeParse(1.5).success).toBe(false);
  });

  it("executeScenarios body requires capabilities and scenarios", () => {
    const ok = executeScenariosBodySchema.safeParse({
      capabilities: [{ os_type: "linux", browser_type: "chrome" }],
      scenarios: [{ id: 1 }],
    });
    expect(ok.success).toBe(true);
    expect(executeScenariosBodySchema.safeParse({}).success).toBe(false);
  });

  it("url replacement body requires both urls", () => {
    expect(
      urlReplacementBodySchema.safeParse({
        pattern_url: "https://a",
        replacement_url: "https://b",
      }).success,
    ).toBe(true);
    expect(urlReplacementBodySchema.safeParse({ pattern_url: "https://a" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/schemas.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/mcp/schemas.ts`**

```ts
import { z } from "zod";

import type { operations } from "../generated/autify.js";

/** Positive integer id (Autify path ids are integers). */
export const idSchema = z.number().int().positive();
export const projectIdSchema = idSchema.describe("Autify project id");

// --- execute_scenarios body --------------------------------------------------
const capabilitySchema = z
  .object({
    os_type: z.enum(["macos", "linux", "windows", "windows_server", "ios", "android"]).optional(),
    os_version: z.string().optional(),
    device: z.string().optional(),
    browser_type: z.enum(["chrome", "firefox", "safari", "edge", "edge_legacy", "ie"]).optional(),
    browser_version: z.string().optional(),
    timezone: z.enum(["JST", "UTC", "Asia/Tokyo", "Etc/UTC"]).optional(),
  })
  .strip();

export const executeScenariosBodySchema = z.object({
  name: z.string().optional().describe("Run name; defaults to an auto-generated name"),
  execution_type: z.enum(["parallel", "sequential"]).optional(),
  capabilities: z.array(capabilitySchema).min(1).describe("Target OS/browser/device matrix"),
  scenarios: z.array(z.object({ id: idSchema })).min(1).describe("Scenarios to run, by id"),
  url_replacements: z
    .array(z.object({ pattern_url: z.string(), replacement_url: z.string() }))
    .optional(),
});

// --- execute_schedule body ---------------------------------------------------
export const executeScheduleBodySchema = z.object({
  autify_connect: z
    .object({ name: z.string().nullable().describe("Access point name; null disables Autify Connect") })
    .optional(),
});

// --- scenario update ---------------------------------------------------------
export const updateScenarioBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  labels: z.array(z.string()).optional(),
});

// --- url replacement ---------------------------------------------------------
export const urlReplacementBodySchema = z.object({
  pattern_url: z.string().describe("URL pattern to match, e.g. https://example.com"),
  replacement_url: z.string().describe("Replacement URL, e.g. https://example.net"),
});
export const urlReplacementUpdateBodySchema = urlReplacementBodySchema.partial();

// --- test plan variable ------------------------------------------------------
export const testPlanVariableBodySchema = z.object({
  key: z.string().describe("Variable name"),
  default_value: z.string().describe("Default value"),
});

// --- access point ------------------------------------------------------------
export const accessPointBodySchema = z.object({
  name: z.string().describe("Access point name"),
});

// ---------------------------------------------------------------------------
// Compile-time guards: zod inferred types must be assignable to the generated
// operation request bodies. These never run; they fail `tsc` if zod drifts
// from the spec. Update the schema (or regenerate types) when one breaks.
// ---------------------------------------------------------------------------
type Json<T extends keyof operations> =
  operations[T] extends { requestBody?: { content: { "application/json": infer B } } } ? B : never;

const _executeScenarios: Json<"executeScenarios"> = {} as z.infer<typeof executeScenariosBodySchema>;
const _executeSchedule: Json<"executeSchedule"> = {} as z.infer<typeof executeScheduleBodySchema>;
const _updateScenario: Json<"updateScenario"> = {} as z.infer<typeof updateScenarioBodySchema>;
const _createUrl: Json<"createUrlReplacement"> = {} as z.infer<typeof urlReplacementBodySchema>;
const _createVar: Json<"createTestPlanVariable"> = {} as z.infer<typeof testPlanVariableBodySchema>;
const _createAp: Json<"createAccessPoint"> = {} as z.infer<typeof accessPointBodySchema>;
void _executeScenarios;
void _executeSchedule;
void _updateScenario;
void _createUrl;
void _createVar;
void _createAp;
```

> If any `const _x: Json<...> = ...` line fails to compile, the zod schema diverged from the spec — reconcile it. (Some Autify bodies have all-optional fields; the guard still validates field/type names.)

- [ ] **Step 4: Run test to verify it passes + typecheck the guards**

Run: `npx vitest run tests/unit/schemas.test.ts && npx tsc --noEmit`
Expected: PASS and no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/schemas.ts tests/unit/schemas.test.ts
git commit -m "feat: add zod tool-input schemas guarded against generated types"
```

---

## Task 10: ServerContext

**Files:**
- Create: `src/mcp/context.ts`
- Test: `tests/unit/context.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/context.test.ts
import { describe, it, expect } from "vitest";
import { createServerContext, requireProjectId } from "../../src/mcp/context.js";
import { createLogger } from "../../src/utils/logger.js";
import { AutifyMcpError } from "../../src/core/types.js";
import type { ResolvedConfig } from "../../src/core/types.js";

const baseConfig: ResolvedConfig = {
  apiToken: "tok",
  baseUrl: "https://app.autify.com/api/v1/",
  readonly: false,
  logLevel: "error",
};

describe("context", () => {
  it("exposes config, logger, and a client", () => {
    const ctx = createServerContext({ config: baseConfig, logger: createLogger("error", () => {}) });
    expect(ctx.config.apiToken).toBe("tok");
    expect(ctx.client).toBeDefined();
  });

  it("requireProjectId prefers the argument then the config default", () => {
    const ctx = createServerContext({
      config: { ...baseConfig, defaultProjectId: 7 },
      logger: createLogger("error", () => {}),
    });
    expect(requireProjectId(ctx, 3)).toBe(3);
    expect(requireProjectId(ctx, undefined)).toBe(7);
  });

  it("requireProjectId throws when neither is set", () => {
    const ctx = createServerContext({ config: baseConfig, logger: createLogger("error", () => {}) });
    expect(() => requireProjectId(ctx, undefined)).toThrow(AutifyMcpError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/context.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/mcp/context.ts`**

```ts
import { AutifyMcpError } from "../core/types.js";
import type { Logger, ResolvedConfig } from "../core/types.js";
import { createAutifyClient } from "../core/client.js";
import type { AutifyClient } from "../core/client.js";

export interface ServerContext {
  readonly config: ResolvedConfig;
  readonly logger: Logger;
  readonly client: AutifyClient;
}

export interface CreateServerContextOptions {
  readonly config: ResolvedConfig;
  readonly logger: Logger;
  /** Inject a prebuilt client in tests. */
  readonly client?: AutifyClient;
}

export function createServerContext(opts: CreateServerContextOptions): ServerContext {
  const client =
    opts.client ??
    createAutifyClient({ apiToken: opts.config.apiToken, baseUrl: opts.config.baseUrl });
  return { config: opts.config, logger: opts.logger, client };
}

/** Resolve the project id from a tool arg, falling back to the configured default. */
export function requireProjectId(ctx: ServerContext, argProjectId: number | undefined): number {
  const id = argProjectId ?? ctx.config.defaultProjectId;
  if (id === undefined) {
    throw new AutifyMcpError("project_id is required (no AUTIFY_PROJECT_ID default set).", {
      code: "invalid_input",
      hint: "Pass project_id, or set AUTIFY_PROJECT_ID in the server env.",
    });
  }
  return id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/context.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/context.ts tests/unit/context.test.ts
git commit -m "feat: add ServerContext and project-id resolution"
```

---

## Task 11: Read tools (10)

**Files:**
- Create: `src/mcp/tools-read.ts`
- Test: `tests/unit/tools-read.test.ts`

Each tool is a thin call to `ctx.client.GET(...)`. A small local helper unwraps `{ data, error, response }` into either `data` or a thrown `AutifyMcpError`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/tools-read.test.ts
import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerReadTools } from "../../src/mcp/tools-read.js";
import { createServerContext } from "../../src/mcp/context.js";
import { createLogger } from "../../src/utils/logger.js";
import type { ResolvedConfig } from "../../src/core/types.js";
import type { AutifyClient } from "../../src/core/client.js";

const config: ResolvedConfig = {
  apiToken: "tok",
  baseUrl: "https://app.autify.com/api/v1/",
  defaultProjectId: 1,
  readonly: false,
  logLevel: "error",
};

function fakeClient(get: ReturnType<typeof vi.fn>): AutifyClient {
  return { GET: get } as unknown as AutifyClient;
}

function names(server: McpServer): string[] {
  // The SDK stores registered tools; assert via the public listTools handler.
  return Object.keys((server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools);
}

describe("read tools", () => {
  it("registers all 10 read tools", () => {
    const server = new McpServer({ name: "t", version: "0" });
    const ctx = createServerContext({
      config,
      logger: createLogger("error", () => {}),
      client: fakeClient(vi.fn()),
    });
    registerReadTools(server, ctx);
    const tools = names(server);
    expect(tools).toContain("autify_list_scenarios");
    expect(tools).toContain("autify_describe_result");
    expect(tools).toContain("autify_get_project_info");
    expect(tools.length).toBe(10);
  });

  it("list_scenarios returns data on success", async () => {
    const get = vi.fn(async () => ({ data: { scenarios: [] }, error: undefined, response: new Response("", { status: 200 }) }));
    const server = new McpServer({ name: "t", version: "0" });
    const ctx = createServerContext({ config, logger: createLogger("error", () => {}), client: fakeClient(get) });
    registerReadTools(server, ctx);
    const tool = (server as unknown as { _registeredTools: Record<string, { callback: (a: unknown) => Promise<{ isError?: boolean }> }> })._registeredTools["autify_list_scenarios"]!;
    const res = await tool.callback({ project_id: 1 });
    expect(res.isError).toBeUndefined();
    expect(get).toHaveBeenCalledWith("/projects/{project_id}/scenarios", { params: { path: { project_id: 1 }, query: {} } });
  });

  it("maps an API error response to an error result", async () => {
    const get = vi.fn(async () => ({ data: undefined, error: { message: "no" }, response: new Response("", { status: 404 }) }));
    const server = new McpServer({ name: "t", version: "0" });
    const ctx = createServerContext({ config, logger: createLogger("error", () => {}), client: fakeClient(get) });
    registerReadTools(server, ctx);
    const tool = (server as unknown as { _registeredTools: Record<string, { callback: (a: unknown) => Promise<{ isError?: boolean }> }> })._registeredTools["autify_describe_result"]!;
    const res = await tool.callback({ project_id: 1, result_id: 9 });
    expect(res.isError).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/tools-read.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/mcp/tools-read.ts`**

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { mapHttpError } from "../core/errors.js";
import { idSchema, projectIdSchema } from "./schemas.js";
import { guard, jsonResult } from "./tool-helpers.js";
import { requireProjectId } from "./context.js";
import type { ServerContext } from "./context.js";

const RO = { readOnlyHint: true } as const;

/** Throw a mapped error when an openapi-fetch result is not ok; else return data. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (!result.response.ok || result.error !== undefined) {
    throw mapHttpError(result.response.status, result.error);
  }
  return result.data as T;
}

export function registerReadTools(server: McpServer, ctx: ServerContext): void {
  const { client, logger } = ctx;

  server.registerTool(
    "autify_list_scenarios",
    {
      title: "List scenarios",
      description: "List test scenarios in a project.",
      annotations: RO,
      inputSchema: {
        project_id: projectIdSchema.optional(),
        page: z.number().int().positive().optional().describe("Page number"),
      },
    },
    (args) =>
      guard(logger, "autify_list_scenarios", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        const query = args.page !== undefined ? { page: args.page } : {};
        return jsonResult(
          unwrap(await client.GET("/projects/{project_id}/scenarios", { params: { path: { project_id }, query } })),
        );
      }),
  );

  server.registerTool(
    "autify_describe_scenario",
    {
      title: "Describe scenario",
      description: "Get a single test scenario by id.",
      annotations: RO,
      inputSchema: { project_id: projectIdSchema.optional(), scenario_id: idSchema },
    },
    (args) =>
      guard(logger, "autify_describe_scenario", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        return jsonResult(
          unwrap(
            await client.GET("/projects/{project_id}/scenarios/{scenario_id}", {
              params: { path: { project_id, scenario_id: args.scenario_id } },
            }),
          ),
        );
      }),
  );

  server.registerTool(
    "autify_list_results",
    {
      title: "List results",
      description: "List test results in a project.",
      annotations: RO,
      inputSchema: {
        project_id: projectIdSchema.optional(),
        page: z.number().int().positive().optional(),
        per_page: z.number().int().positive().optional(),
        test_plan_id: idSchema.optional(),
      },
    },
    (args) =>
      guard(logger, "autify_list_results", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        const query: Record<string, number> = {};
        if (args.page !== undefined) query["page"] = args.page;
        if (args.per_page !== undefined) query["per_page"] = args.per_page;
        if (args.test_plan_id !== undefined) query["test_plan_id"] = args.test_plan_id;
        return jsonResult(
          unwrap(await client.GET("/projects/{project_id}/results", { params: { path: { project_id }, query } })),
        );
      }),
  );

  server.registerTool(
    "autify_describe_result",
    {
      title: "Describe result",
      description: "Get a single test result by id.",
      annotations: RO,
      inputSchema: { project_id: projectIdSchema.optional(), result_id: idSchema },
    },
    (args) =>
      guard(logger, "autify_describe_result", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        return jsonResult(
          unwrap(
            await client.GET("/projects/{project_id}/results/{result_id}", {
              params: { path: { project_id, result_id: args.result_id } },
            }),
          ),
        );
      }),
  );

  server.registerTool(
    "autify_list_capabilities",
    {
      title: "List capabilities",
      description: "List available OS/browser/device capabilities for a project.",
      annotations: RO,
      inputSchema: { project_id: projectIdSchema.optional() },
    },
    (args) =>
      guard(logger, "autify_list_capabilities", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        return jsonResult(
          unwrap(await client.GET("/projects/{project_id}/capabilities", { params: { path: { project_id } } })),
        );
      }),
  );

  server.registerTool(
    "autify_list_access_points",
    {
      title: "List access points",
      description: "List Autify Connect access points for a project.",
      annotations: RO,
      inputSchema: { project_id: projectIdSchema.optional() },
    },
    (args) =>
      guard(logger, "autify_list_access_points", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        return jsonResult(
          unwrap(
            await client.GET("/projects/{project_id}/autify_connect/access_points", {
              params: { path: { project_id } },
            }),
          ),
        );
      }),
  );

  server.registerTool(
    "autify_list_url_replacements",
    {
      title: "List URL replacements",
      description: "List URL replacements for a test plan.",
      annotations: RO,
      inputSchema: { test_plan_id: idSchema },
    },
    (args) =>
      guard(logger, "autify_list_url_replacements", async () =>
        jsonResult(
          unwrap(
            await client.GET("/test_plans/{test_plan_id}/url_replacements", {
              params: { path: { test_plan_id: args.test_plan_id } },
            }),
          ),
        ),
      ),
  );

  server.registerTool(
    "autify_list_test_plan_variables",
    {
      title: "List test plan variables",
      description: "List variables for a test plan.",
      annotations: RO,
      inputSchema: { test_plan_id: idSchema },
    },
    (args) =>
      guard(logger, "autify_list_test_plan_variables", async () =>
        jsonResult(
          unwrap(
            await client.GET("/test_plans/{test_plan_id}/test_plan_variables", {
              params: { path: { test_plan_id: args.test_plan_id } },
            }),
          ),
        ),
      ),
  );

  server.registerTool(
    "autify_get_credit_usage",
    {
      title: "Get credit usage",
      description: "Get credit usage for a project.",
      annotations: RO,
      inputSchema: { project_id: projectIdSchema.optional() },
    },
    (args) =>
      guard(logger, "autify_get_credit_usage", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        return jsonResult(
          unwrap(await client.GET("/projects/{project_id}/credits", { params: { path: { project_id } } })),
        );
      }),
  );

  server.registerTool(
    "autify_get_project_info",
    {
      title: "Get project info",
      description: "Get information about a project.",
      annotations: RO,
      inputSchema: { project_id: projectIdSchema.optional() },
    },
    (args) =>
      guard(logger, "autify_get_project_info", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        return jsonResult(
          unwrap(await client.GET("/projects/{project_id}/project_info", { params: { path: { project_id } } })),
        );
      }),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/tools-read.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/tools-read.ts tests/unit/tools-read.test.ts
git commit -m "feat: add 10 read tools"
```

---

## Task 12: Execute tools (2)

**Files:**
- Create: `src/mcp/tools-execute.ts`
- Test: `tests/unit/tools-execute.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/tools-execute.test.ts
import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerExecuteTools } from "../../src/mcp/tools-execute.js";
import { createServerContext } from "../../src/mcp/context.js";
import { createLogger } from "../../src/utils/logger.js";
import type { ResolvedConfig } from "../../src/core/types.js";
import type { AutifyClient } from "../../src/core/client.js";

const config: ResolvedConfig = {
  apiToken: "tok", baseUrl: "https://app.autify.com/api/v1/", defaultProjectId: 1, readonly: false, logLevel: "error",
};
const reg = (s: McpServer) => (s as unknown as { _registeredTools: Record<string, { callback: (a: unknown) => Promise<{ isError?: boolean }> }> })._registeredTools;

describe("execute tools", () => {
  it("registers both execute tools (not read-only)", () => {
    const server = new McpServer({ name: "t", version: "0" });
    const ctx = createServerContext({ config, logger: createLogger("error", () => {}), client: { POST: vi.fn() } as unknown as AutifyClient });
    registerExecuteTools(server, ctx);
    expect(Object.keys(reg(server)).sort()).toEqual(["autify_execute_schedule", "autify_execute_scenarios"]);
  });

  it("execute_scenarios posts the body", async () => {
    const post = vi.fn(async () => ({ data: { id: 5 }, error: undefined, response: new Response("", { status: 200 }) }));
    const server = new McpServer({ name: "t", version: "0" });
    const ctx = createServerContext({ config, logger: createLogger("error", () => {}), client: { POST: post } as unknown as AutifyClient });
    registerExecuteTools(server, ctx);
    const res = await reg(server)["autify_execute_scenarios"]!.callback({
      project_id: 1, capabilities: [{ os_type: "linux", browser_type: "chrome" }], scenarios: [{ id: 1 }],
    });
    expect(res.isError).toBeUndefined();
    expect(post).toHaveBeenCalledWith("/projects/{project_id}/execute_scenarios", expect.objectContaining({ params: { path: { project_id: 1 } } }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/tools-execute.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/mcp/tools-execute.ts`**

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { idSchema, projectIdSchema, executeScenariosBodySchema, executeScheduleBodySchema } from "./schemas.js";
import { guard, jsonResult } from "./tool-helpers.js";
import { unwrap } from "./tools-read.js";
import { requireProjectId } from "./context.js";
import type { ServerContext } from "./context.js";

export function registerExecuteTools(server: McpServer, ctx: ServerContext): void {
  const { client, logger } = ctx;

  server.registerTool(
    "autify_execute_scenarios",
    {
      title: "Execute scenarios",
      description:
        "Run one or more scenarios on the given capabilities. BILLABLE: consumes test credits. Returns the test result id.",
      annotations: { readOnlyHint: false, destructiveHint: false },
      inputSchema: {
        project_id: projectIdSchema.optional(),
        name: executeScenariosBodySchema.shape.name,
        execution_type: executeScenariosBodySchema.shape.execution_type,
        capabilities: executeScenariosBodySchema.shape.capabilities,
        scenarios: executeScenariosBodySchema.shape.scenarios,
        url_replacements: executeScenariosBodySchema.shape.url_replacements,
      },
    },
    (args) =>
      guard(logger, "autify_execute_scenarios", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        const body = executeScenariosBodySchema.parse(args);
        return jsonResult(
          unwrap(
            await client.POST("/projects/{project_id}/execute_scenarios", {
              params: { path: { project_id } },
              body,
            }),
          ),
        );
      }),
  );

  server.registerTool(
    "autify_execute_schedule",
    {
      title: "Execute schedule (run test plan)",
      description:
        "Run a test plan via its schedule id. BILLABLE: consumes test credits. Returns the test plan result id.",
      annotations: { readOnlyHint: false, destructiveHint: false },
      inputSchema: {
        schedule_id: idSchema.describe("The schedule (test plan) id to run"),
        autify_connect: executeScheduleBodySchema.shape.autify_connect,
      },
    },
    (args) =>
      guard(logger, "autify_execute_schedule", async () => {
        const body = executeScheduleBodySchema.parse(args);
        return jsonResult(
          unwrap(
            await client.POST("/schedules/{schedule_id}", {
              params: { path: { schedule_id: args.schedule_id } },
              body,
            }),
          ),
        );
      }),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/tools-execute.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/tools-execute.ts tests/unit/tools-execute.test.ts
git commit -m "feat: add execute_scenarios and execute_schedule tools"
```

---

## Task 13: Mutation tools (10)

**Files:**
- Create: `src/mcp/tools-mutate.ts`
- Test: `tests/unit/tools-mutate.test.ts`

DELETE tools carry `destructiveHint: true`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/tools-mutate.test.ts
import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMutateTools } from "../../src/mcp/tools-mutate.js";
import { createServerContext } from "../../src/mcp/context.js";
import { createLogger } from "../../src/utils/logger.js";
import type { ResolvedConfig } from "../../src/core/types.js";
import type { AutifyClient } from "../../src/core/client.js";

const config: ResolvedConfig = {
  apiToken: "tok", baseUrl: "https://app.autify.com/api/v1/", defaultProjectId: 1, readonly: false, logLevel: "error",
};
const reg = (s: McpServer) => (s as unknown as { _registeredTools: Record<string, { callback: (a: unknown) => Promise<{ isError?: boolean }> }> })._registeredTools;

function client() {
  const ok = async () => ({ data: { ok: true }, error: undefined, response: new Response("", { status: 200 }) });
  return { PUT: vi.fn(ok), POST: vi.fn(ok), DELETE: vi.fn(ok) } as unknown as AutifyClient;
}

describe("mutation tools", () => {
  it("registers all 10 mutation tools", () => {
    const server = new McpServer({ name: "t", version: "0" });
    const ctx = createServerContext({ config, logger: createLogger("error", () => {}), client: client() });
    registerMutateTools(server, ctx);
    const names = Object.keys(reg(server));
    expect(names.length).toBe(10);
    expect(names).toContain("autify_delete_access_point");
    expect(names).toContain("autify_create_test_plan_variable");
  });

  it("delete_url_replacement calls DELETE", async () => {
    const c = client();
    const server = new McpServer({ name: "t", version: "0" });
    const ctx = createServerContext({ config, logger: createLogger("error", () => {}), client: c });
    registerMutateTools(server, ctx);
    const res = await reg(server)["autify_delete_url_replacement"]!.callback({ test_plan_id: 1, url_replacement_id: 2 });
    expect(res.isError).toBeUndefined();
    expect((c as unknown as { DELETE: ReturnType<typeof vi.fn> }).DELETE).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/tools-mutate.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/mcp/tools-mutate.ts`**

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  idSchema,
  projectIdSchema,
  updateScenarioBodySchema,
  urlReplacementBodySchema,
  urlReplacementUpdateBodySchema,
  testPlanVariableBodySchema,
  accessPointBodySchema,
} from "./schemas.js";
import { guard, jsonResult } from "./tool-helpers.js";
import { unwrap } from "./tools-read.js";
import { requireProjectId } from "./context.js";
import type { ServerContext } from "./context.js";

const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true } as const;
const MUTATING = { readOnlyHint: false, destructiveHint: false } as const;

export function registerMutateTools(server: McpServer, ctx: ServerContext): void {
  const { client, logger } = ctx;

  // --- scenarios -------------------------------------------------------------
  server.registerTool(
    "autify_update_scenario",
    {
      title: "Update scenario",
      description: "Update a scenario's name, description, or labels.",
      annotations: MUTATING,
      inputSchema: {
        project_id: projectIdSchema.optional(),
        scenario_id: idSchema,
        name: updateScenarioBodySchema.shape.name,
        description: updateScenarioBodySchema.shape.description,
        labels: updateScenarioBodySchema.shape.labels,
      },
    },
    (args) =>
      guard(logger, "autify_update_scenario", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        const body = updateScenarioBodySchema.parse(args);
        return jsonResult(
          unwrap(
            await client.PUT("/projects/{project_id}/scenarios/{scenario_id}", {
              params: { path: { project_id, scenario_id: args.scenario_id } },
              body,
            }),
          ),
        );
      }),
  );

  server.registerTool(
    "autify_duplicate_scenario",
    {
      title: "Duplicate scenario",
      description: "Duplicate a scenario.",
      annotations: MUTATING,
      inputSchema: { project_id: projectIdSchema.optional(), scenario_id: idSchema },
    },
    (args) =>
      guard(logger, "autify_duplicate_scenario", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        return jsonResult(
          unwrap(
            await client.POST("/projects/{project_id}/scenarios/{scenario_id}/duplications", {
              params: { path: { project_id, scenario_id: args.scenario_id } },
            }),
          ),
        );
      }),
  );

  // --- access points ---------------------------------------------------------
  server.registerTool(
    "autify_create_access_point",
    {
      title: "Create access point",
      description: "Create an Autify Connect access point.",
      annotations: MUTATING,
      inputSchema: { project_id: projectIdSchema.optional(), name: accessPointBodySchema.shape.name },
    },
    (args) =>
      guard(logger, "autify_create_access_point", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        return jsonResult(
          unwrap(
            await client.POST("/projects/{project_id}/autify_connect/access_points", {
              params: { path: { project_id } },
              body: { name: args.name },
            }),
          ),
        );
      }),
  );

  server.registerTool(
    "autify_delete_access_point",
    {
      title: "Delete access point",
      description: "Delete an Autify Connect access point by name. Destructive.",
      annotations: DESTRUCTIVE,
      inputSchema: { project_id: projectIdSchema.optional(), name: accessPointBodySchema.shape.name },
    },
    (args) =>
      guard(logger, "autify_delete_access_point", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        return jsonResult(
          unwrap(
            await client.DELETE("/projects/{project_id}/autify_connect/access_points", {
              params: { path: { project_id } },
              body: { name: args.name },
            }),
          ),
        );
      }),
  );

  // --- url replacements ------------------------------------------------------
  server.registerTool(
    "autify_create_url_replacement",
    {
      title: "Create URL replacement",
      description: "Create a URL replacement for a test plan.",
      annotations: MUTATING,
      inputSchema: {
        test_plan_id: idSchema,
        pattern_url: urlReplacementBodySchema.shape.pattern_url,
        replacement_url: urlReplacementBodySchema.shape.replacement_url,
      },
    },
    (args) =>
      guard(logger, "autify_create_url_replacement", async () =>
        jsonResult(
          unwrap(
            await client.POST("/test_plans/{test_plan_id}/url_replacements", {
              params: { path: { test_plan_id: args.test_plan_id } },
              body: { pattern_url: args.pattern_url, replacement_url: args.replacement_url },
            }),
          ),
        ),
      ),
  );

  server.registerTool(
    "autify_update_url_replacement",
    {
      title: "Update URL replacement",
      description: "Update a URL replacement.",
      annotations: MUTATING,
      inputSchema: {
        test_plan_id: idSchema,
        url_replacement_id: idSchema,
        pattern_url: urlReplacementUpdateBodySchema.shape.pattern_url,
        replacement_url: urlReplacementUpdateBodySchema.shape.replacement_url,
      },
    },
    (args) =>
      guard(logger, "autify_update_url_replacement", async () => {
        const body = urlReplacementUpdateBodySchema.parse(args);
        return jsonResult(
          unwrap(
            await client.PUT("/test_plans/{test_plan_id}/url_replacements/{url_replacement_id}", {
              params: { path: { test_plan_id: args.test_plan_id, url_replacement_id: args.url_replacement_id } },
              body,
            }),
          ),
        );
      }),
  );

  server.registerTool(
    "autify_delete_url_replacement",
    {
      title: "Delete URL replacement",
      description: "Delete a URL replacement. Destructive.",
      annotations: DESTRUCTIVE,
      inputSchema: { test_plan_id: idSchema, url_replacement_id: idSchema },
    },
    (args) =>
      guard(logger, "autify_delete_url_replacement", async () =>
        jsonResult(
          unwrap(
            await client.DELETE("/test_plans/{test_plan_id}/url_replacements/{url_replacement_id}", {
              params: { path: { test_plan_id: args.test_plan_id, url_replacement_id: args.url_replacement_id } },
            }),
          ),
        ),
      ),
  );

  // --- test plan variables ---------------------------------------------------
  server.registerTool(
    "autify_create_test_plan_variable",
    {
      title: "Create test plan variable",
      description: "Create a variable for a test plan.",
      annotations: MUTATING,
      inputSchema: {
        test_plan_id: idSchema,
        key: testPlanVariableBodySchema.shape.key,
        default_value: testPlanVariableBodySchema.shape.default_value,
      },
    },
    (args) =>
      guard(logger, "autify_create_test_plan_variable", async () =>
        jsonResult(
          unwrap(
            await client.POST("/test_plans/{test_plan_id}/test_plan_variables", {
              params: { path: { test_plan_id: args.test_plan_id } },
              body: { key: args.key, default_value: args.default_value },
            }),
          ),
        ),
      ),
  );

  server.registerTool(
    "autify_update_test_plan_variable",
    {
      title: "Update test plan variable",
      description: "Update a test plan variable.",
      annotations: MUTATING,
      inputSchema: {
        test_plan_id: idSchema,
        test_plan_variable_id: idSchema,
        key: testPlanVariableBodySchema.shape.key,
        default_value: testPlanVariableBodySchema.shape.default_value,
      },
    },
    (args) =>
      guard(logger, "autify_update_test_plan_variable", async () =>
        jsonResult(
          unwrap(
            await client.PUT("/test_plans/{test_plan_id}/test_plan_variables/{test_plan_variable_id}", {
              params: { path: { test_plan_id: args.test_plan_id, test_plan_variable_id: args.test_plan_variable_id } },
              body: { key: args.key, default_value: args.default_value },
            }),
          ),
        ),
      ),
  );

  server.registerTool(
    "autify_delete_test_plan_variable",
    {
      title: "Delete test plan variable",
      description: "Delete a test plan variable. Destructive.",
      annotations: DESTRUCTIVE,
      inputSchema: { test_plan_id: idSchema, test_plan_variable_id: idSchema },
    },
    (args) =>
      guard(logger, "autify_delete_test_plan_variable", async () =>
        jsonResult(
          unwrap(
            await client.DELETE("/test_plans/{test_plan_id}/test_plan_variables/{test_plan_variable_id}", {
              params: { path: { test_plan_id: args.test_plan_id, test_plan_variable_id: args.test_plan_variable_id } },
            }),
          ),
        ),
      ),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/tools-mutate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/tools-mutate.ts tests/unit/tools-mutate.test.ts
git commit -m "feat: add 10 configuration mutation tools"
```

---

## Task 14: wait_for_result polling tool

**Files:**
- Create: `src/mcp/tools-wait.ts`
- Test: `tests/unit/tools-wait.test.ts`

Terminal statuses: `passed`, `failed`, `skipped`, `internal_error`, `canceled`. In-progress: `queuing`, `waiting`, `running`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/tools-wait.test.ts
import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerWaitTool, isTerminalStatus } from "../../src/mcp/tools-wait.js";
import { createServerContext } from "../../src/mcp/context.js";
import { createLogger } from "../../src/utils/logger.js";
import type { ResolvedConfig } from "../../src/core/types.js";
import type { AutifyClient } from "../../src/core/client.js";

const config: ResolvedConfig = {
  apiToken: "tok", baseUrl: "https://app.autify.com/api/v1/", defaultProjectId: 1, readonly: false, logLevel: "error",
};
const reg = (s: McpServer) => (s as unknown as { _registeredTools: Record<string, { callback: (a: unknown) => Promise<{ isError?: boolean; content: { text: string }[] }> }> })._registeredTools;

describe("wait_for_result", () => {
  it("classifies terminal vs in-progress statuses", () => {
    expect(isTerminalStatus("passed")).toBe(true);
    expect(isTerminalStatus("failed")).toBe(true);
    expect(isTerminalStatus("running")).toBe(false);
    expect(isTerminalStatus("queuing")).toBe(false);
  });

  it("polls until a terminal status is reached", async () => {
    const statuses = ["running", "running", "passed"];
    const get = vi.fn(async () => ({
      data: { status: statuses.shift() }, error: undefined, response: new Response("", { status: 200 }),
    }));
    const server = new McpServer({ name: "t", version: "0" });
    const ctx = createServerContext({ config, logger: createLogger("error", () => {}), client: { GET: get } as unknown as AutifyClient });
    registerWaitTool(server, ctx);
    const res = await reg(server)["autify_wait_for_result"]!.callback({ result_id: 9, pollIntervalSec: 0, timeoutSec: 60 });
    expect(res.isError).toBeUndefined();
    expect(get).toHaveBeenCalledTimes(3);
    expect(JSON.parse(res.content[0]!.text).status).toBe("passed");
  });

  it("returns a timeout error when no terminal status before deadline", async () => {
    const get = vi.fn(async () => ({ data: { status: "running" }, error: undefined, response: new Response("", { status: 200 }) }));
    const server = new McpServer({ name: "t", version: "0" });
    const ctx = createServerContext({ config, logger: createLogger("error", () => {}), client: { GET: get } as unknown as AutifyClient });
    registerWaitTool(server, ctx);
    const res = await reg(server)["autify_wait_for_result"]!.callback({ result_id: 9, pollIntervalSec: 0, timeoutSec: 0 });
    expect(res.isError).toBe(true);
    expect(JSON.parse(res.content[0]!.text).code).toBe("timeout");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/tools-wait.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/mcp/tools-wait.ts`**

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AutifyMcpError } from "../core/types.js";
import { idSchema, projectIdSchema } from "./schemas.js";
import { guard, jsonResult } from "./tool-helpers.js";
import { unwrap } from "./tools-read.js";
import { requireProjectId } from "./context.js";
import type { ServerContext } from "./context.js";

const TERMINAL = new Set(["passed", "failed", "skipped", "internal_error", "canceled"]);
const MAX_TIMEOUT_SEC = 1800;
const MIN_POLL_SEC = 2;

export function isTerminalStatus(status: string | undefined): boolean {
  return status !== undefined && TERMINAL.has(status);
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function registerWaitTool(server: McpServer, ctx: ServerContext): void {
  const { client, logger } = ctx;

  server.registerTool(
    "autify_wait_for_result",
    {
      title: "Wait for test result",
      description:
        "Poll a test result until it reaches a terminal status (passed/failed/skipped/internal_error/canceled), then return it. Use after an execute tool to await pass/fail.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        project_id: projectIdSchema.optional(),
        result_id: idSchema,
        timeoutSec: z.number().int().nonnegative().max(MAX_TIMEOUT_SEC).optional().describe(`Max seconds to wait (cap ${MAX_TIMEOUT_SEC})`),
        pollIntervalSec: z.number().int().nonnegative().optional().describe(`Seconds between polls (min ${MIN_POLL_SEC} in production)`),
      },
    },
    (args) =>
      guard(logger, "autify_wait_for_result", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        const timeoutSec = args.timeoutSec ?? 600;
        // Allow 0 in tests; otherwise clamp to a sane minimum.
        const pollIntervalSec = args.pollIntervalSec === undefined ? MIN_POLL_SEC : args.pollIntervalSec;
        const deadline = Date.now() + timeoutSec * 1000;

        for (;;) {
          const data = unwrap(
            await client.GET("/projects/{project_id}/results/{result_id}", {
              params: { path: { project_id, result_id: args.result_id } },
            }),
          ) as { status?: string };
          if (isTerminalStatus(data.status)) return jsonResult(data);
          if (Date.now() >= deadline) {
            throw new AutifyMcpError(
              `Test result ${args.result_id} did not finish within ${timeoutSec}s (last status: ${data.status ?? "unknown"}).`,
              { code: "timeout", hint: "Increase timeoutSec or check the run in Autify.", meta: { result_id: args.result_id, lastStatus: data.status } },
            );
          }
          await sleep(pollIntervalSec * 1000);
        }
      }),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/tools-wait.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/tools-wait.ts tests/unit/tools-wait.test.ts
git commit -m "feat: add wait_for_result polling tool"
```

---

## Task 15: Tools aggregator with read-only gating

**Files:**
- Create: `src/mcp/tools.ts`
- Test: `tests/unit/tools.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/tools.test.ts
import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "../../src/mcp/tools.js";
import { createServerContext } from "../../src/mcp/context.js";
import { createLogger } from "../../src/utils/logger.js";
import type { ResolvedConfig } from "../../src/core/types.js";
import type { AutifyClient } from "../../src/core/client.js";

const names = (s: McpServer) => Object.keys((s as unknown as { _registeredTools: Record<string, unknown> })._registeredTools);
const baseConfig: ResolvedConfig = { apiToken: "tok", baseUrl: "https://app.autify.com/api/v1/", defaultProjectId: 1, readonly: false, logLevel: "error" };
const fakeClient = { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn(), DELETE: vi.fn() } as unknown as AutifyClient;

describe("registerTools", () => {
  it("registers all 23 tools when not read-only", () => {
    const server = new McpServer({ name: "t", version: "0" });
    registerTools(server, createServerContext({ config: baseConfig, logger: createLogger("error", () => {}), client: fakeClient }));
    expect(names(server).length).toBe(23);
  });

  it("registers only the 11 read/wait tools in read-only mode", () => {
    const server = new McpServer({ name: "t", version: "0" });
    registerTools(server, createServerContext({ config: { ...baseConfig, readonly: true }, logger: createLogger("error", () => {}), client: fakeClient }));
    const tools = names(server);
    expect(tools.length).toBe(11);
    expect(tools).toContain("autify_wait_for_result");
    expect(tools).not.toContain("autify_execute_scenarios");
    expect(tools).not.toContain("autify_delete_access_point");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/tools.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/mcp/tools.ts`**

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ServerContext } from "./context.js";
import { registerReadTools } from "./tools-read.js";
import { registerExecuteTools } from "./tools-execute.js";
import { registerMutateTools } from "./tools-mutate.js";
import { registerWaitTool } from "./tools-wait.js";

/**
 * Register tools. Read and wait tools are always registered. Execute and
 * mutation tools are registered only when not in read-only mode, so a
 * misconfigured agent cannot trigger billable or destructive operations.
 */
export function registerTools(server: McpServer, ctx: ServerContext): void {
  registerReadTools(server, ctx);
  registerWaitTool(server, ctx);
  if (!ctx.config.readonly) {
    registerExecuteTools(server, ctx);
    registerMutateTools(server, ctx);
  } else {
    ctx.logger.info("read-only mode: execute and mutation tools disabled");
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/tools.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/tools.ts tests/unit/tools.test.ts
git commit -m "feat: aggregate tools with read-only gating"
```

---

## Task 16: Resources (project_info, capabilities)

**Files:**
- Create: `src/mcp/resources.ts`
- Test: `tests/unit/resources.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/resources.test.ts
import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerResources } from "../../src/mcp/resources.js";
import { createServerContext } from "../../src/mcp/context.js";
import { createLogger } from "../../src/utils/logger.js";
import type { ResolvedConfig } from "../../src/core/types.js";
import type { AutifyClient } from "../../src/core/client.js";

const config: ResolvedConfig = { apiToken: "tok", baseUrl: "https://app.autify.com/api/v1/", defaultProjectId: 1, readonly: false, logLevel: "error" };
const resources = (s: McpServer) => (s as unknown as { _registeredResources: Record<string, { readCallback: (u: URL) => Promise<{ contents: { text: string }[] }> }> })._registeredResources;

describe("resources", () => {
  it("registers project_info and capabilities resources", () => {
    const server = new McpServer({ name: "t", version: "0" });
    registerResources(server, createServerContext({ config, logger: createLogger("error", () => {}), client: { GET: vi.fn() } as unknown as AutifyClient }));
    const uris = Object.keys(resources(server));
    expect(uris).toContain("autify://project_info");
    expect(uris).toContain("autify://capabilities");
  });

  it("project_info resource returns JSON contents", async () => {
    const get = vi.fn(async () => ({ data: { name: "proj" }, error: undefined, response: new Response("", { status: 200 }) }));
    const server = new McpServer({ name: "t", version: "0" });
    registerResources(server, createServerContext({ config, logger: createLogger("error", () => {}), client: { GET: get } as unknown as AutifyClient }));
    const r = resources(server)["autify://project_info"]!;
    const out = await r.readCallback(new URL("autify://project_info"));
    expect(JSON.parse(out.contents[0]!.text)).toEqual({ name: "proj" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/resources.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write `src/mcp/resources.ts`**

```ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";

import { toAutifyMcpError } from "../core/errors.js";
import { unwrap } from "./tools-read.js";
import { requireProjectId } from "./context.js";
import type { ServerContext } from "./context.js";

function jsonContents(uri: string, value: unknown): ReadResourceResult {
  return { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(value, null, 2) }] };
}

export function registerResources(server: McpServer, ctx: ServerContext): void {
  const { client, logger } = ctx;

  server.registerResource(
    "project_info",
    "autify://project_info",
    { title: "Autify project info", description: "Information about the configured project.", mimeType: "application/json" },
    async (uri) => {
      try {
        const project_id = requireProjectId(ctx, undefined);
        const data = unwrap(await client.GET("/projects/{project_id}/project_info", { params: { path: { project_id } } }));
        return jsonContents(uri.href, data);
      } catch (error) {
        const mapped = toAutifyMcpError(error);
        logger.warn("resource failed", { uri: uri.href, code: mapped.code });
        throw mapped;
      }
    },
  );

  server.registerResource(
    "capabilities",
    "autify://capabilities",
    { title: "Autify capabilities", description: "Available OS/browser/device capabilities for the configured project.", mimeType: "application/json" },
    async (uri) => {
      try {
        const project_id = requireProjectId(ctx, undefined);
        const data = unwrap(await client.GET("/projects/{project_id}/capabilities", { params: { path: { project_id } } }));
        return jsonContents(uri.href, data);
      } catch (error) {
        const mapped = toAutifyMcpError(error);
        logger.warn("resource failed", { uri: uri.href, code: mapped.code });
        throw mapped;
      }
    },
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/resources.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/resources.ts tests/unit/resources.test.ts
git commit -m "feat: add project_info and capabilities resources"
```

---

## Task 17: Server assembly and CLI entry

**Files:**
- Create: `src/mcp/server.ts`, `src/index.ts`
- Test: `tests/unit/server.test.ts`, `tests/unit/index.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/server.test.ts
import { describe, it, expect, vi } from "vitest";
import { createServer, SERVER_NAME } from "../../src/mcp/server.js";
import { createServerContext } from "../../src/mcp/context.js";
import { createLogger } from "../../src/utils/logger.js";
import type { ResolvedConfig } from "../../src/core/types.js";
import type { AutifyClient } from "../../src/core/client.js";

const config: ResolvedConfig = { apiToken: "tok", baseUrl: "https://app.autify.com/api/v1/", defaultProjectId: 1, readonly: false, logLevel: "error" };

describe("createServer", () => {
  it("builds a server with tools and resources registered", () => {
    const ctx = createServerContext({ config, logger: createLogger("error", () => {}), client: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn(), DELETE: vi.fn() } as unknown as AutifyClient });
    const server = createServer(ctx);
    const tools = Object.keys((server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools);
    expect(SERVER_NAME).toBe("autify-mcp");
    expect(tools.length).toBe(23);
  });
});
```

```ts
// tests/unit/index.test.ts
import { describe, it, expect } from "vitest";
import { parseArgs } from "../../src/index.js";

describe("parseArgs", () => {
  it("parses help and version", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
    expect(parseArgs(["-v"]).version).toBe(true);
  });

  it("parses --log-level", () => {
    expect(parseArgs(["--log-level", "debug"]).cli.logLevel).toBe("debug");
  });

  it("throws on unknown args", () => {
    expect(() => parseArgs(["--nope"])).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/server.test.ts tests/unit/index.test.ts`
Expected: FAIL — cannot find modules.

- [ ] **Step 3: Write `src/mcp/server.ts`**

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ServerContext } from "./context.js";
import { registerTools } from "./tools.js";
import { registerResources } from "./resources.js";

export const SERVER_NAME = "autify-mcp";
export const SERVER_VERSION = "0.1.0";

export function createServer(ctx: ServerContext): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerTools(server, ctx);
  registerResources(server, ctx);
  return server;
}
```

- [ ] **Step 4: Write `src/index.ts`**

```ts
/**
 * autify-mcp CLI entry point. Parses minimal flags, resolves config from env,
 * builds the server, and connects it over stdio. Diagnostics go to stderr.
 */
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { resolveConfig } from "./core/config.js";
import { getErrorMessage } from "./core/errors.js";
import { createLogger, resolveLogLevel } from "./utils/logger.js";
import type { LogLevel } from "./core/types.js";
import { createServerContext } from "./mcp/context.js";
import { createServer, SERVER_NAME, SERVER_VERSION } from "./mcp/server.js";

const HELP = `${SERVER_NAME} v${SERVER_VERSION}

MCP server exposing the Autify for Web public API.

Usage:
  autify-mcp [options]

Options:
  --log-level <level>   debug | info | warn | error (default: info)
  -h, --help            Show this help
  -v, --version         Show version

Configuration (environment variables):
  AUTIFY_API_TOKEN   (required) Autify personal access token
  AUTIFY_PROJECT_ID  (optional) default project id
  AUTIFY_BASE_URL    (optional) override API base URL
  AUTIFY_READONLY    (optional) "true" disables execute/mutation tools
  AUTIFY_LOG_FILE    (optional) write logs to a file instead of stderr
`;

interface ParsedArgs {
  readonly help: boolean;
  readonly version: boolean;
  readonly cli: { readonly logLevel?: LogLevel };
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  let help = false;
  let version = false;
  let logLevel: LogLevel | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        help = true;
        break;
      case "-v":
      case "--version":
        version = true;
        break;
      case "--log-level": {
        const value = argv[(i += 1)];
        if (value === undefined) throw new Error("Missing value for --log-level");
        logLevel = resolveLogLevel(value);
        break;
      }
      default:
        throw new Error(`Unknown argument: ${String(arg)}`);
    }
  }
  return { help, version, cli: logLevel !== undefined ? { logLevel } : {} };
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const parsed = parseArgs(argv);
  if (parsed.help) {
    process.stderr.write(HELP);
    return;
  }
  if (parsed.version) {
    process.stderr.write(`${SERVER_VERSION}\n`);
    return;
  }
  const config = resolveConfig();
  const level = parsed.cli.logLevel ?? config.logLevel;
  const logger = createLogger(level, undefined, config.logFile);
  const ctx = createServerContext({ config, logger });
  const server = createServer(ctx);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("autify-mcp started", { readonly: config.readonly, hasDefaultProject: config.defaultProjectId !== undefined });
}

function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  try {
    return fileURLToPath(import.meta.url) === realpathSync(entry);
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main().catch((error: unknown) => {
    process.stderr.write(`${SERVER_NAME} failed to start: ${getErrorMessage(error)}\n`);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/server.test.ts tests/unit/index.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/mcp/server.ts src/index.ts tests/unit/server.test.ts tests/unit/index.test.ts
git commit -m "feat: add server assembly and stdio CLI entry"
```

---

## Task 18: Full verification (build, lint, typecheck, coverage)

**Files:** none (verification only)

- [ ] **Step 1: Typecheck (includes the schema compile-time guards)**

Run: `npm run typecheck`
Expected: no errors. If a `Json<...>` guard line fails, reconcile the zod schema in `src/mcp/schemas.ts` with the spec.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors (no stray `console.*`).

- [ ] **Step 3: Build (runs `generate` via prebuild)**

Run: `npm run build`
Expected: `dist/index.js` emitted with the `#!/usr/bin/env node` banner.

- [ ] **Step 4: Coverage**

Run: `npm run test:coverage`
Expected: all tests pass; coverage ≥ 80% lines/functions/branches/statements.

- [ ] **Step 5: stdio smoke check**

Run:
```bash
AUTIFY_API_TOKEN=dummy node -e "import('./dist/index.js').then(m => m.main([])).then(() => process.exit(0))" &
sleep 1; kill %1 2>/dev/null || true
```
Expected: process starts and logs `autify-mcp started` to stderr without crashing.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "test: verify build, lint, typecheck, and coverage"
```

---

## Task 19: Docs, license, release config

**Files:**
- Create: `README.md`, `README.ja.md`, `LICENSE`, `release-please-config.json`, `.release-please-manifest.json`

- [ ] **Step 1: Write `LICENSE`** — MIT, copyright "lambda-script", year 2026.

- [ ] **Step 2: Write `release-please-config.json`**

```json
{
  "packages": { ".": { "release-type": "node", "package-name": "@lambda-script/autify-mcp" } },
  "$schema": "https://raw.githubusercontent.com/googleapis/release-please/main/schemas/config.json"
}
```

- [ ] **Step 3: Write `.release-please-manifest.json`**

```json
{ ".": "0.1.0" }
```

- [ ] **Step 4: Write `README.md`** (English) covering:
  - What it is (MCP server for Autify for Web).
  - Install/run: `npx @lambda-script/autify-mcp`.
  - `.mcp.json` example:
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
  - Env var table: `AUTIFY_API_TOKEN`, `AUTIFY_PROJECT_ID`, `AUTIFY_BASE_URL`, `AUTIFY_READONLY`, `AUTIFY_LOG_FILE`.
  - Tool list (23) grouped read / execute (billable) / mutation (destructive marked) / wait.
  - `AUTIFY_READONLY=true` note for safe deployments.
  - Spec-update workflow (`npm run generate`).

- [ ] **Step 5: Write `README.ja.md`** — Japanese translation of `README.md`.

- [ ] **Step 6: Commit**

```bash
git add README.md README.ja.md LICENSE release-please-config.json .release-please-manifest.json
git commit -m "docs: add README (en/ja), license, and release config"
```

---

## Self-Review (completed during planning)

**Spec coverage:**
- §1 purpose / stdio / Bearer / package → Tasks 1, 7, 17.
- §2 full 22 + 1 scope → Tasks 11 (10 read), 12 (2 execute), 13 (10 mutate), 14 (wait). 10+2+10+1 = 23 tools. ✓
- §3.1 type-safety (openapi-typescript + openapi-fetch + zod guards) → Tasks 2, 7, 9.
- §3.2 tooling choice → Task 1 deps (`openapi-typescript`, `openapi-fetch`).
- §3.3 immutability → readonly types throughout (Tasks 3+).
- §4 tool catalog + annotations → Tasks 11–14 (RO / destructive / billable annotations applied).
- §5 config/auth/safety incl. `AUTIFY_READONLY` gating → Tasks 6, 15.
- §6 error handling/normalization → Tasks 5, 8.
- §7 testing 80% + readonly registration diff + wait transitions → every task's tests; Tasks 14, 15.
- §8 build/distribution/spec-update + generated committed → Tasks 1, 2, 18, 19.
- §9 out of scope respected (Web only, stdio only, hand-written zod). ✓

**Placeholder scan:** No TBD/TODO; all code shown in full. README body content (Task 19) is enumerated rather than verbatim — acceptable for prose docs.

**Type consistency:** `AutifyMcpError`, `ResolvedConfig`, `ServerContext`, `unwrap`, `requireProjectId`, `guard(logger, name, handler)`, `jsonResult`, `errorResult`, schema names (`projectIdSchema`, `idSchema`, `executeScenariosBodySchema`, etc.) used consistently across tasks. `unwrap` defined in Task 11 and reused in 12/13/14/16. Tool count (23) consistent in Tasks 15 and 17.
