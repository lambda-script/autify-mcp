import { describe, it, expect, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerResources } from "../../src/mcp/resources.js";
import { createServerContext } from "../../src/mcp/context.js";
import { createLogger } from "../../src/utils/logger.js";
import type { ResolvedConfig } from "../../src/core/types.js";
import type { AutifyClient } from "../../src/core/client.js";

const config: ResolvedConfig = { apiToken: "tok", baseUrl: "https://app.autify.com/api/v1/", defaultProjectId: 1, readonly: false, logLevel: "error" };
const resources = (s: McpServer) => (s as unknown as { _registeredResources: Record<string, { readCallback: (u: URL, extra?: unknown) => Promise<{ contents: { text: string }[] }> }> })._registeredResources;

describe("resources", () => {
  it("registers project_info and capabilities resources", () => {
    const server = new McpServer({ name: "t", version: "0" });
    registerResources(server, createServerContext({ config, logger: createLogger("error", () => {}), client: { GET: vi.fn() } as unknown as AutifyClient }));
    const uris = Object.keys(resources(server));
    expect(uris).toContain("autify://project_info");
    expect(uris).toContain("autify://capabilities");
  });

  it("project_info resource returns JSON contents", async () => {
    const get = vi.fn(async () => ({ data: { name: "proj" }, error: undefined, response: new Response("", { status: 200 }) }));
    const server = new McpServer({ name: "t", version: "0" });
    registerResources(server, createServerContext({ config, logger: createLogger("error", () => {}), client: { GET: get } as unknown as AutifyClient }));
    const r = resources(server)["autify://project_info"]!;
    const out = await r.readCallback(new URL("autify://project_info"));
    expect(JSON.parse(out.contents[0]!.text)).toEqual({ name: "proj" });
  });
});
