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
