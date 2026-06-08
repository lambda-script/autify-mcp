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
