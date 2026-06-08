import { describe, it, expect } from "vitest";
import { AutifyMcpError } from "../../src/core/types.js";

describe("AutifyMcpError", () => {
  it("carries code, hint, and meta", () => {
    const err = new AutifyMcpError("boom", {
      code: "not_found",
      hint: "check id",
      meta: { id: 1 },
    });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("AutifyMcpError");
    expect(err.code).toBe("not_found");
    expect(err.hint).toBe("check id");
    expect(err.meta).toEqual({ id: 1 });
  });
});
