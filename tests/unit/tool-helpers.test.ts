import { describe, it, expect } from "vitest";
import { AutifyMcpError } from "../../src/core/types.js";
import { jsonResult, errorResult, guard } from "../../src/mcp/tool-helpers.js";
import { createLogger } from "../../src/utils/logger.js";

const logger = createLogger("error", () => {});

describe("tool-helpers", () => {
  it("jsonResult renders pretty JSON text", () => {
    const r = jsonResult({ a: 1 });
    expect(r.content[0]).toMatchObject({ type: "text" });
    expect(JSON.parse((r.content[0] as { text: string }).text)).toEqual({ a: 1 });
  });

  it("errorResult sets isError and a structured payload", () => {
    const r = errorResult(new AutifyMcpError("boom", { code: "not_found", hint: "h" }));
    expect(r.isError).toBe(true);
    const payload = JSON.parse((r.content[0] as { text: string }).text);
    expect(payload).toMatchObject({ code: "not_found", message: "boom", hint: "h" });
  });

  it("guard converts a thrown value into an error result", async () => {
    const r = await guard(logger, "t", async () => {
      throw new AutifyMcpError("nope", { code: "invalid_input" });
    });
    expect(r.isError).toBe(true);
  });

  it("guard returns the handler result on success", async () => {
    const r = await guard(logger, "t", async () => jsonResult({ ok: true }));
    expect(r.isError).toBeUndefined();
  });
});
