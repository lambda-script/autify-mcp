import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "../../src/mcp/tools.js";
import { createServerContext } from "../../src/mcp/context.js";
import { createLogger } from "../../src/utils/logger.js";
import type { ResolvedConfig } from "../../src/core/types.js";
import type { AutifyClient } from "../../src/core/client.js";

const names = (s: McpServer) => Object.keys((s as unknown as { _registeredTools: Record<string, unknown> })._registeredTools);
const baseConfig: ResolvedConfig = { apiToken: "tok", baseUrl: "https://app.autify.com/api/v1/", defaultProjectId: 1, readonly: false, logLevel: "error" };
const fakeClient = { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn(), DELETE: vi.fn() } as unknown as AutifyClient;

describe("registerTools", () => {
  it("registers all 23 tools when not read-only", () => {
    const server = new McpServer({ name: "t", version: "0" });
    registerTools(server, createServerContext({ config: baseConfig, logger: createLogger("error", () => {}), client: fakeClient }));
    expect(names(server).length).toBe(23);
  });

  it("registers only the 11 read/wait tools in read-only mode", () => {
    const server = new McpServer({ name: "t", version: "0" });
    registerTools(server, createServerContext({ config: { ...baseConfig, readonly: true }, logger: createLogger("error", () => {}), client: fakeClient }));
    const tools = names(server);
    expect(tools.length).toBe(11);
    expect(tools).toContain("autify_wait_for_result");
    expect(tools).not.toContain("autify_execute_scenarios");
    expect(tools).not.toContain("autify_delete_access_point");
  });
});
