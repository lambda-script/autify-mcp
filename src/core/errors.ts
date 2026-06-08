import { AutifyMcpError } from "./types.js";
import type { AutifyMcpErrorCode, AutifyMcpErrorDetails } from "./types.js";

export function isAutifyMcpError(value: unknown): value is AutifyMcpError {
  return value instanceof AutifyMcpError;
}

export function getErrorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "Unknown error";
  if (typeof value === "object") {
    const m = (value as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return String(value);
}

export function toAutifyMcpError(
  value: unknown,
  details?: Partial<AutifyMcpErrorDetails>,
): AutifyMcpError {
  if (isAutifyMcpError(value)) return value;
  return new AutifyMcpError(getErrorMessage(value), {
    code: details?.code ?? "internal",
    hint: details?.hint,
    meta: details?.meta,
  });
}

/** Map an HTTP status + optional parsed error body to a stable AutifyMcpError. */
export function mapHttpError(status: number, body: unknown): AutifyMcpError {
  const message = getErrorMessage(body) || `Autify API returned HTTP ${status}`;
  const base: { code: AutifyMcpErrorCode; hint?: string } =
    status === 401 || status === 403
      ? { code: "unauthorized", hint: "Check AUTIFY_API_TOKEN is valid and authorized." }
      : status === 404
        ? { code: "not_found", hint: "Check the project/scenario/result id." }
        : status === 422
          ? { code: "invalid_input", hint: "Check the request parameters." }
          : status === 429
            ? { code: "rate_limited", hint: "Slow down; honor Retry-After." }
            : { code: "upstream", hint: "Autify API error. Retry later." };
  return new AutifyMcpError(message, { code: base.code, hint: base.hint, meta: { httpStatus: status } });
}
