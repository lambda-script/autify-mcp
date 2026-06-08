import { describe, it, expect } from "vitest";
import { createServerContext, requireProjectId } from "../../src/mcp/context.js";
import { createLogger } from "../../src/utils/logger.js";
import { AutifyMcpError } from "../../src/core/types.js";
import type { ResolvedConfig } from "../../src/core/types.js";

const baseConfig: ResolvedConfig = {
  apiToken: "tok",
  baseUrl: "https://app.autify.com/api/v1/",
  readonly: false,
  logLevel: "error",
};

describe("context", () => {
  it("exposes config, logger, and a client", () => {
    const ctx = createServerContext({ config: baseConfig, logger: createLogger("error", () => {}) });
    expect(ctx.config.apiToken).toBe("tok");
    expect(ctx.client).toBeDefined();
  });

  it("requireProjectId prefers the argument then the config default", () => {
    const ctx = createServerContext({
      config: { ...baseConfig, defaultProjectId: 7 },
      logger: createLogger("error", () => {}),
    });
    expect(requireProjectId(ctx, 3)).toBe(3);
    expect(requireProjectId(ctx, undefined)).toBe(7);
  });

  it("requireProjectId throws when neither is set", () => {
    const ctx = createServerContext({ config: baseConfig, logger: createLogger("error", () => {}) });
    expect(() => requireProjectId(ctx, undefined)).toThrow(AutifyMcpError);
  });
});
