import { describe, it, expect, vi } from "vitest";
import { createServer, SERVER_NAME } from "../../src/mcp/server.js";
import { createServerContext } from "../../src/mcp/context.js";
import { createLogger } from "../../src/utils/logger.js";
import type { ResolvedConfig } from "../../src/core/types.js";
import type { AutifyClient } from "../../src/core/client.js";

const config: ResolvedConfig = { apiToken: "tok", baseUrl: "https://app.autify.com/api/v1/", defaultProjectId: 1, readonly: false, logLevel: "error" };

describe("createServer", () => {
  it("builds a server with tools and resources registered", () => {
    const ctx = createServerContext({ config, logger: createLogger("error", () => {}), client: { GET: vi.fn(), POST: vi.fn(), PUT: vi.fn(), DELETE: vi.fn() } as unknown as AutifyClient });
    const server = createServer(ctx);
    const tools = Object.keys((server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools);
    expect(SERVER_NAME).toBe("autify-mcp");
    expect(tools.length).toBe(23);
  });
});
