import { describe, it, expect } from "vitest";
import {
  projectIdSchema,
  executeScenariosBodySchema,
  urlReplacementBodySchema,
} from "../../src/mcp/schemas.js";

describe("schemas", () => {
  it("project id accepts positive ints, rejects others", () => {
    expect(projectIdSchema.safeParse(5).success).toBe(true);
    expect(projectIdSchema.safeParse(-1).success).toBe(false);
    expect(projectIdSchema.safeParse(1.5).success).toBe(false);
  });

  it("executeScenarios body requires capabilities and scenarios", () => {
    const ok = executeScenariosBodySchema.safeParse({
      capabilities: [{ os_type: "linux", browser_type: "chrome" }],
      scenarios: [{ id: 1 }],
    });
    expect(ok.success).toBe(true);
    expect(executeScenariosBodySchema.safeParse({}).success).toBe(false);
  });

  it("url replacement body requires both urls", () => {
    expect(
      urlReplacementBodySchema.safeParse({
        pattern_url: "https://a",
        replacement_url: "https://b",
      }).success,
    ).toBe(true);
    expect(urlReplacementBodySchema.safeParse({ pattern_url: "https://a" }).success).toBe(false);
  });
});
