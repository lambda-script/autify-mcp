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

function callTool(server: McpServer, name: string, args: unknown): Promise<{ isError?: boolean; content: { text: string }[] }> {
  const tool = (server as unknown as { _registeredTools: Record<string, { handler: (a: unknown, extra: unknown) => Promise<{ isError?: boolean; content: { text: string }[] }> }> })._registeredTools[name]!;
  return tool.handler(args, {});
}
function names(server: McpServer): string[] {
  return Object.keys((server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools);
}

describe("execute tools", () => {
  it("registers both execute tools", () => {
    const server = new McpServer({ name: "t", version: "0" });
    const ctx = createServerContext({ config, logger: createLogger("error", () => {}), client: { POST: vi.fn() } as unknown as AutifyClient });
    registerExecuteTools(server, ctx);
    expect(names(server).sort()).toEqual(["autify_execute_scenarios", "autify_execute_schedule"]);
  });

  it("execute_scenarios posts the body", async () => {
    const post = vi.fn(async () => ({ data: { id: 5 }, error: undefined, response: new Response("", { status: 200 }) }));
    const server = new McpServer({ name: "t", version: "0" });
    const ctx = createServerContext({ config, logger: createLogger("error", () => {}), client: { POST: post } as unknown as AutifyClient });
    registerExecuteTools(server, ctx);
    const res = await callTool(server, "autify_execute_scenarios", {
      project_id: 1, capabilities: [{ os_type: "linux", browser_type: "chrome" }], scenarios: [{ id: 1 }],
    });
    expect(res.isError).toBeUndefined();
    expect(post).toHaveBeenCalledWith("/projects/{project_id}/execute_scenarios", expect.objectContaining({ params: { path: { project_id: 1 } } }));
  });

  it("execute_schedule posts to the schedule path", async () => {
    const post = vi.fn(async () => ({ data: { id: 9 }, error: undefined, response: new Response("", { status: 200 }) }));
    const server = new McpServer({ name: "t", version: "0" });
    const ctx = createServerContext({ config, logger: createLogger("error", () => {}), client: { POST: post } as unknown as AutifyClient });
    registerExecuteTools(server, ctx);
    const res = await callTool(server, "autify_execute_schedule", { schedule_id: 42 });
    expect(res.isError).toBeUndefined();
    expect(post).toHaveBeenCalledWith("/schedules/{schedule_id}", expect.objectContaining({ params: { path: { schedule_id: 42 } } }));
  });
});
