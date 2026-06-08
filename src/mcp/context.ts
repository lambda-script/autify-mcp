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
