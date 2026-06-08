import { describe, it, expect } from "vitest";
import { AutifyMcpError } from "../../src/core/types.js";
import { getErrorMessage, toAutifyMcpError, mapHttpError } from "../../src/core/errors.js";

describe("errors", () => {
  it("getErrorMessage extracts from Error/string/object", () => {
    expect(getErrorMessage(new Error("e"))).toBe("e");
    expect(getErrorMessage("s")).toBe("s");
    expect(getErrorMessage({ message: "m" })).toBe("m");
    expect(getErrorMessage(null)).toBe("Unknown error");
  });

  it("toAutifyMcpError passes AutifyMcpError through and wraps others as internal", () => {
    const e = new AutifyMcpError("x", { code: "not_found" });
    expect(toAutifyMcpError(e)).toBe(e);
    const w = toAutifyMcpError("oops");
    expect(w.code).toBe("internal");
    expect(w.message).toBe("oops");
  });

  it("mapHttpError maps status codes to stable codes", () => {
    expect(mapHttpError(401, undefined).code).toBe("unauthorized");
    expect(mapHttpError(404, undefined).code).toBe("not_found");
    expect(mapHttpError(422, { message: "bad" }).code).toBe("invalid_input");
    expect(mapHttpError(429, undefined).code).toBe("rate_limited");
    expect(mapHttpError(500, undefined).code).toBe("upstream");
  });
});
