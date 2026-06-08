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
