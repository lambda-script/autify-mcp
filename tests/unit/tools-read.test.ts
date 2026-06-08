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

// The SDK (v1) stores registered tools in `_registeredTools[name]` with the
// handler under the `handler` property (not `callback`). The handler signature
// is `(args, extra)` where `extra` is a RequestHandlerExtra-like object.
// These helpers are adapted to match that internal shape.

type RegisteredTool = {
  handler: (args: unknown, extra: unknown) => Promise<{ isError?: boolean; content: { text: string }[] }>;
};

function names(server: McpServer): string[] {
  return Object.keys(
    (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools,
  );
}

function callTool(
  server: McpServer,
  name: string,
  args: unknown,
): Promise<{ isError?: boolean; content: { text: string }[] }> {
  const tools = (server as unknown as { _registeredTools: Record<string, RegisteredTool> })
    ._registeredTools;
  const tool = tools[name];
  if (!tool) throw new Error(`Tool "${name}" not registered`);
  // Pass a minimal extra stub (no taskStore, etc.) — sufficient for read tools.
  return tool.handler(args, {});
}

describe("read tools", () => {
  it("registers all 10 read tools", () => {
    const server = new McpServer({ name: "t", version: "0" });
    const ctx = createServerContext({ config, logger: createLogger("error", () => {}), client: fakeClient(vi.fn()) });
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
    const res = await callTool(server, "autify_list_scenarios", { project_id: 1 });
    expect(res.isError).toBeUndefined();
    expect(get).toHaveBeenCalledWith("/projects/{project_id}/scenarios", { params: { path: { project_id: 1 }, query: {} } });
  });

  it("maps an API error response to an error result", async () => {
    const get = vi.fn(async () => ({ data: undefined, error: { message: "no" }, response: new Response("", { status: 404 }) }));
    const server = new McpServer({ name: "t", version: "0" });
    const ctx = createServerContext({ config, logger: createLogger("error", () => {}), client: fakeClient(get) });
    registerReadTools(server, ctx);
    const res = await callTool(server, "autify_describe_result", { project_id: 1, result_id: 9 });
    expect(res.isError).toBe(true);
  });

  it("list_results assembles only the provided query params", async () => {
    const get = vi.fn(async () => ({ data: { results: [] }, error: undefined, response: new Response("", { status: 200 }) }));
    const server = new McpServer({ name: "t", version: "0" });
    const ctx = createServerContext({ config, logger: createLogger("error", () => {}), client: fakeClient(get) });
    registerReadTools(server, ctx);
    await callTool(server, "autify_list_results", { project_id: 2, page: 1, per_page: 50, test_plan_id: 7 });
    expect(get).toHaveBeenCalledWith("/projects/{project_id}/results", {
      params: { path: { project_id: 2 }, query: { page: 1, per_page: 50, test_plan_id: 7 } },
    });
  });

  it("falls back to the configured default project when project_id is omitted", async () => {
    const get = vi.fn(async () => ({ data: { name: "p" }, error: undefined, response: new Response("", { status: 200 }) }));
    const server = new McpServer({ name: "t", version: "0" });
    const ctx = createServerContext({ config, logger: createLogger("error", () => {}), client: fakeClient(get) });
    registerReadTools(server, ctx);
    await callTool(server, "autify_get_project_info", {});
    expect(get).toHaveBeenCalledWith("/projects/{project_id}/project_info", { params: { path: { project_id: 1 } } });
  });

  it("returns invalid_input when no project_id and no default are available", async () => {
    const noDefault = { ...config, defaultProjectId: undefined };
    const server = new McpServer({ name: "t", version: "0" });
    const ctx = createServerContext({ config: noDefault, logger: createLogger("error", () => {}), client: fakeClient(vi.fn()) });
    registerReadTools(server, ctx);
    const res = await callTool(server, "autify_list_scenarios", {});
    expect(res.isError).toBe(true);
    expect(JSON.parse(res.content[0]!.text).code).toBe("invalid_input");
  });
});
