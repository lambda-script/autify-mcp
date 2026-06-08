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
