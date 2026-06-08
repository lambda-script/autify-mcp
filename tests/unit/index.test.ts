import { describe, it, expect } from "vitest";
import { parseArgs } from "../../src/index.js";

describe("parseArgs", () => {
  it("parses help and version", () => {
    expect(parseArgs(["--help"]).help).toBe(true);
    expect(parseArgs(["-v"]).version).toBe(true);
  });

  it("parses --log-level", () => {
    expect(parseArgs(["--log-level", "debug"]).cli.logLevel).toBe("debug");
  });

  it("throws on unknown args", () => {
    expect(() => parseArgs(["--nope"])).toThrow();
  });
});
