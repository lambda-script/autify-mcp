import { describe, it, expect } from "vitest";
import { resolveConfig } from "../../src/core/config.js";
import { AutifyMcpError } from "../../src/core/types.js";

describe("resolveConfig", () => {
  it("throws when token is missing", () => {
    expect(() => resolveConfig({ env: {} })).toThrow(AutifyMcpError);
  });

  it("resolves defaults from env", () => {
    const c = resolveConfig({ env: { AUTIFY_API_TOKEN: "tok" } });
    expect(c.apiToken).toBe("tok");
    expect(c.baseUrl).toBe("https://app.autify.com/api/v1/");
    expect(c.readonly).toBe(false);
    expect(c.defaultProjectId).toBeUndefined();
  });

  it("reads project id, readonly, base url, log file", () => {
    const c = resolveConfig({
      env: {
        AUTIFY_API_TOKEN: "tok",
        AUTIFY_PROJECT_ID: "42",
        AUTIFY_READONLY: "true",
        AUTIFY_BASE_URL: "https://example.test/api/v1/",
        AUTIFY_LOG_FILE: "/tmp/a.log",
      },
    });
    expect(c.defaultProjectId).toBe(42);
    expect(c.readonly).toBe(true);
    expect(c.baseUrl).toBe("https://example.test/api/v1/");
    expect(c.logFile).toBe("/tmp/a.log");
  });

  it("rejects a non-numeric project id", () => {
    expect(() =>
      resolveConfig({ env: { AUTIFY_API_TOKEN: "tok", AUTIFY_PROJECT_ID: "abc" } }),
    ).toThrow(AutifyMcpError);
  });
});
