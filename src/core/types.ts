/** Stable, machine-branchable error codes surfaced to MCP clients. */
export type AutifyMcpErrorCode =
  | "unauthorized"
  | "not_found"
  | "invalid_input"
  | "rate_limited"
  | "upstream"
  | "timeout"
  | "internal";

export interface AutifyMcpErrorDetails {
  readonly code: AutifyMcpErrorCode;
  readonly hint?: string;
  readonly meta?: Readonly<Record<string, unknown>>;
}

/** The only error type allowed to describe a failed tool/resource call. */
export class AutifyMcpError extends Error {
  readonly code: AutifyMcpErrorCode;
  readonly hint?: string;
  readonly meta?: Readonly<Record<string, unknown>>;

  constructor(message: string, details: AutifyMcpErrorDetails) {
    super(message);
    this.name = "AutifyMcpError";
    this.code = details.code;
    this.hint = details.hint;
    this.meta = details.meta;
  }
}

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

/** Fully resolved runtime configuration. */
export interface ResolvedConfig {
  readonly apiToken: string;
  readonly baseUrl: string;
  readonly defaultProjectId?: number;
  readonly readonly: boolean;
  readonly logLevel: LogLevel;
  readonly logFile?: string;
}
