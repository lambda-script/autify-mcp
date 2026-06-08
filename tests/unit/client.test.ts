import { describe, it, expect, vi } from "vitest";
import { createRetryingFetch, createAutifyClient } from "../../src/core/client.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("createRetryingFetch", () => {
  it("retries on 429 then succeeds", async () => {
    const calls = [jsonResponse(429, { message: "slow" }), jsonResponse(200, { ok: true })];
    const inner = vi.fn(async () => calls.shift()!);
    const fetchFn = createRetryingFetch({ fetch: inner, retries: 2, baseDelayMs: 0 });
    const res = await fetchFn("https://x/api", {});
    expect(res.status).toBe(200);
    expect(inner).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 404", async () => {
    const inner = vi.fn(async () => jsonResponse(404, { message: "nope" }));
    const fetchFn = createRetryingFetch({ fetch: inner, retries: 3, baseDelayMs: 0 });
    const res = await fetchFn("https://x/api", {});
    expect(res.status).toBe(404);
    expect(inner).toHaveBeenCalledTimes(1);
  });
});

describe("createAutifyClient", () => {
  it("bakes the bearer token into the request sent to the underlying fetch", async () => {
    // openapi-fetch builds a Request and calls the custom fetch with it; assert on
    // the Request that actually goes out, not on a fetch init object.
    const inner = vi.fn(async (input: string | URL | Request) => {
      const req = input as Request;
      expect(req.headers.get("Authorization")).toBe("Bearer tok");
      expect(req.url).toContain("/projects/1/project_info");
      return jsonResponse(200, { id: 1 });
    });
    const client = createAutifyClient({
      apiToken: "tok",
      baseUrl: "https://app.autify.com/api/v1/",
      fetch: inner as unknown as typeof fetch,
    });
    const { data } = await client.GET("/projects/{project_id}/project_info", {
      params: { path: { project_id: 1 } },
    });
    expect(data).toEqual({ id: 1 });
    expect(inner).toHaveBeenCalledOnce();
  });

  it("preserves Content-Type alongside Authorization on a POST body", async () => {
    // Regression guard: auth must not clobber the JSON Content-Type openapi-fetch
    // sets for request bodies, or the Autify API would reject the payload.
    const inner = vi.fn(async (input: string | URL | Request) => {
      const req = input as Request;
      expect(req.headers.get("Authorization")).toBe("Bearer tok");
      expect(req.headers.get("Content-Type")).toContain("application/json");
      return jsonResponse(200, { ok: true });
    });
    const client = createAutifyClient({
      apiToken: "tok",
      baseUrl: "https://app.autify.com/api/v1/",
      fetch: inner as unknown as typeof fetch,
    });
    await client.POST("/projects/{project_id}/autify_connect/access_points", {
      params: { path: { project_id: 1 } },
      body: { name: "x" },
    });
    expect(inner).toHaveBeenCalledOnce();
  });
});
