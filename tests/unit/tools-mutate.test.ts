import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMutateTools } from "../../src/mcp/tools-mutate.js";
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

function client() {
  const ok = async () => ({ data: { ok: true }, error: undefined, response: new Response("", { status: 200 }) });
  return { PUT: vi.fn(ok), POST: vi.fn(ok), DELETE: vi.fn(ok) } as unknown as AutifyClient;
}

describe("mutation tools", () => {
  it("registers all 10 mutation tools", () => {
    const server = new McpServer({ name: "t", version: "0" });
    const ctx = createServerContext({ config, logger: createLogger("error", () => {}), client: client() });
    registerMutateTools(server, ctx);
    const n = names(server);
    expect(n.length).toBe(10);
    expect(n).toContain("autify_delete_access_point");
    expect(n).toContain("autify_create_test_plan_variable");
  });

  it("delete_url_replacement calls DELETE", async () => {
    const c = client();
    const server = new McpServer({ name: "t", version: "0" });
    const ctx = createServerContext({ config, logger: createLogger("error", () => {}), client: c });
    registerMutateTools(server, ctx);
    const res = await callTool(server, "autify_delete_url_replacement", { test_plan_id: 1, url_replacement_id: 2 });
    expect(res.isError).toBeUndefined();
    expect((c as unknown as { DELETE: ReturnType<typeof vi.fn> }).DELETE).toHaveBeenCalled();
  });

  it("update_scenario calls PUT with the parsed body", async () => {
    const c = client();
    const server = new McpServer({ name: "t", version: "0" });
    const ctx = createServerContext({ config, logger: createLogger("error", () => {}), client: c });
    registerMutateTools(server, ctx);
    const res = await callTool(server, "autify_update_scenario", { project_id: 1, scenario_id: 3, name: "n" });
    expect(res.isError).toBeUndefined();
    expect((c as unknown as { PUT: ReturnType<typeof vi.fn> }).PUT).toHaveBeenCalledWith(
      "/projects/{project_id}/scenarios/{scenario_id}",
      expect.objectContaining({ params: { path: { project_id: 1, scenario_id: 3 } } }),
    );
  });

  it("delete_access_point sends the project path and the name body (DELETE-with-body)", async () => {
    const c = client();
    const server = new McpServer({ name: "t", version: "0" });
    const ctx = createServerContext({ config, logger: createLogger("error", () => {}), client: c });
    registerMutateTools(server, ctx);
    const res = await callTool(server, "autify_delete_access_point", { project_id: 4, name: "ap-1" });
    expect(res.isError).toBeUndefined();
    expect((c as unknown as { DELETE: ReturnType<typeof vi.fn> }).DELETE).toHaveBeenCalledWith(
      "/projects/{project_id}/autify_connect/access_points",
      expect.objectContaining({ params: { path: { project_id: 4 } }, body: { name: "ap-1" } }),
    );
  });

  it("create_test_plan_variable POSTs key and default_value to the test plan path", async () => {
    const c = client();
    const server = new McpServer({ name: "t", version: "0" });
    const ctx = createServerContext({ config, logger: createLogger("error", () => {}), client: c });
    registerMutateTools(server, ctx);
    await callTool(server, "autify_create_test_plan_variable", { test_plan_id: 9, key: "K", default_value: "V" });
    expect((c as unknown as { POST: ReturnType<typeof vi.fn> }).POST).toHaveBeenCalledWith(
      "/test_plans/{test_plan_id}/test_plan_variables",
      expect.objectContaining({ params: { path: { test_plan_id: 9 } }, body: { key: "K", default_value: "V" } }),
    );
  });
});
