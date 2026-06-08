import createClient from "openapi-fetch";
import type { Client } from "openapi-fetch";

import { AutifyMcpError } from "./types.js";
import type { paths } from "../generated/autify.js";

export type AutifyClient = Client<paths>;

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export interface RetryingFetchOptions {
  readonly fetch?: typeof fetch;
  readonly retries?: number;
  readonly baseDelayMs?: number;
  readonly timeoutMs?: number;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Combine our timeout signal with any caller-supplied signal (Node >=20.3). */
function combineSignals(
  own: AbortSignal,
  caller: AbortSignal | null | undefined,
): AbortSignal {
  return caller ? AbortSignal.any([own, caller]) : own;
}

/** Wrap fetch with exponential backoff on retryable statuses + a request timeout. */
export function createRetryingFetch(opts: RetryingFetchOptions = {}): typeof fetch {
  const innerFetch = opts.fetch ?? fetch;
  const retries = opts.retries ?? 2;
  const baseDelayMs = opts.baseDelayMs ?? 300;
  const timeoutMs = opts.timeoutMs ?? 30_000;

  const wrapped = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    let lastResponse: Response | undefined;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      try {
        const res = await innerFetch(input, {
          ...init,
          signal: combineSignals(controller.signal, init?.signal),
        });
        if (!RETRYABLE_STATUS.has(res.status)) return res;
        lastResponse = res;
      } catch (error: unknown) {
        // Our timeout fired — surface a stable, wrapped error instead of a raw
        // AbortError. A caller-initiated abort is rethrown unchanged.
        if (timedOut) {
          throw new AutifyMcpError(`Autify API request timed out after ${timeoutMs}ms.`, {
            code: "timeout",
            hint: "Increase the timeout or check Autify API availability.",
          });
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }
      if (attempt < retries) await sleep(baseDelayMs * 2 ** attempt);
    }
    // Reached only when every attempt returned a retryable status: return the last one.
    return lastResponse as Response;
  };
  return wrapped as typeof fetch;
}

export interface CreateAutifyClientOptions {
  readonly apiToken: string;
  readonly baseUrl: string;
  readonly fetch?: typeof fetch;
  readonly retries?: number;
  readonly baseDelayMs?: number;
  readonly timeoutMs?: number;
}

export function createAutifyClient(opts: CreateAutifyClientOptions): AutifyClient {
  const fetchFn = createRetryingFetch({
    ...(opts.fetch !== undefined ? { fetch: opts.fetch } : {}),
    ...(opts.retries !== undefined ? { retries: opts.retries } : {}),
    ...(opts.baseDelayMs !== undefined ? { baseDelayMs: opts.baseDelayMs } : {}),
    ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
  });

  // openapi-fetch v0.17 ClientOptions.fetch expects (input: Request) => Promise<Response>.
  // We cast our broader fetch wrapper to that narrower type accepted by the library.
  const clientFetch = fetchFn as unknown as (input: Request) => Promise<Response>;

  // Pass Authorization via ClientOptions.headers so openapi-fetch bakes it into
  // the Request it builds. This keeps the Content-Type (and any other) headers
  // openapi-fetch sets for POST/PUT bodies intact — injecting headers into the
  // init of a fetch(request, init) call would REPLACE the Request's header list.
  return createClient<paths>({
    baseUrl: opts.baseUrl,
    fetch: clientFetch,
    headers: { Authorization: `Bearer ${opts.apiToken}` },
  });
}
