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

function callTool(server: McpServer, name: string, args: unknown): Promise<{ isError?: boolean; content: { text: string }[] }> {
  const tool = (server as unknown as { _registeredTools: Record<string, { handler: (a: unknown, extra: unknown) => Promise<{ isError?: boolean; content: { text: string }[] }> }> })._registeredTools[name]!;
  return tool.handler(args, {});
}

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
    const res = await callTool(server, "autify_wait_for_result", { result_id: 9, pollIntervalSec: 0, timeoutSec: 60 });
    expect(res.isError).toBeUndefined();
    expect(get).toHaveBeenCalledTimes(3);
    expect(JSON.parse(res.content[0]!.text).status).toBe("passed");
  });

  it("returns a timeout error when no terminal status before deadline", async () => {
    const get = vi.fn(async () => ({ data: { status: "running" }, error: undefined, response: new Response("", { status: 200 }) }));
    const server = new McpServer({ name: "t", version: "0" });
    const ctx = createServerContext({ config, logger: createLogger("error", () => {}), client: { GET: get } as unknown as AutifyClient });
    registerWaitTool(server, ctx);
    const res = await callTool(server, "autify_wait_for_result", { result_id: 9, pollIntervalSec: 0, timeoutSec: 0 });
    expect(res.isError).toBe(true);
    expect(JSON.parse(res.content[0]!.text).code).toBe("timeout");
  });
});
