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
