import { describe, it, expect } from "vitest";
import { createLogger, resolveLogLevel, redact } from "../../src/utils/logger.js";

describe("logger", () => {
  it("resolves levels with a default of info", () => {
    expect(resolveLogLevel("debug")).toBe("debug");
    expect(resolveLogLevel("NOPE")).toBe("info");
    expect(resolveLogLevel(undefined)).toBe("info");
  });

  it("redacts secret-looking keys", () => {
    const out = redact({ apiToken: "supersecretvalue", name: "ok" }) as Record<string, unknown>;
    expect(out["name"]).toBe("ok");
    expect(out["apiToken"]).not.toBe("supersecretvalue");
  });

  it("writes JSON lines at or above threshold to the sink", () => {
    const lines: string[] = [];
    const log = createLogger("warn", (l) => lines.push(l));
    log.debug("skip");
    log.warn("kept", { a: 1 });
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.level).toBe("warn");
    expect(parsed.message).toBe("kept");
    expect(parsed.a).toBe(1);
  });
});
