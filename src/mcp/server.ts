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
