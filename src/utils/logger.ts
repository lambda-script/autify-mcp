/**
 * Structured logger writing JSON lines to STDERR (stdout is reserved for the
 * JSON-RPC stream). Secret-looking keys are redacted before serialisation.
 */
import { appendFileSync } from "node:fs";

import type { LogLevel, Logger } from "../core/types.js";

const LEVEL_ORDER: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const VALID_LEVELS: readonly LogLevel[] = ["debug", "info", "warn", "error"];
const SECRET_KEY_PATTERN = /key|secret|token|password|credential|authorization/i;

export function resolveLogLevel(raw?: string): LogLevel {
  if (raw === undefined) return "info";
  const lower = raw.toLowerCase();
  return (VALID_LEVELS as readonly string[]).includes(lower)
    ? (lower as LogLevel)
    : "info";
}

function maskString(value: string): string {
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}…***`;
}

export function redact(value: unknown): unknown {
  return redactInternal(value, false, new WeakSet<object>());
}

function redactInternal(
  value: unknown,
  parentKeyIsSecret: boolean,
  seen: WeakSet<object>,
): unknown {
  if (typeof value === "string") {
    return parentKeyIsSecret ? maskString(value) : value;
  }
  if (parentKeyIsSecret) {
    if (value === null || value === undefined) return value;
    if (typeof value !== "object") return "***";
  }
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[Circular]";
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => redactInternal(item, parentKeyIsSecret, seen));
  }
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    // Once inside a secret-keyed value, keep redacting descendants even if their
    // own keys don't look secret (e.g. { authorization: { bearer: "..." } }).
    const childSecret = parentKeyIsSecret || SECRET_KEY_PATTERN.test(key);
    out[key] = redactInternal(child, childSecret, seen);
  }
  return out;
}

interface LoggerOptions {
  readonly level: LogLevel;
  readonly fields: Readonly<Record<string, unknown>>;
  readonly write: (line: string) => void;
}

function makeLogger(opts: LoggerOptions): Logger {
  const threshold = LEVEL_ORDER[opts.level];
  function emit(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < threshold) return;
    const merged = { ...opts.fields, ...(meta ?? {}) };
    const safe = redact(merged) as Record<string, unknown>;
    const line = { level, time: new Date().toISOString(), message, ...safe };
    opts.write(`${JSON.stringify(line)}\n`);
  }
  return {
    debug: (m, meta) => emit("debug", m, meta),
    info: (m, meta) => emit("info", m, meta),
    warn: (m, meta) => emit("warn", m, meta),
    error: (m, meta) => emit("error", m, meta),
    child: (fields) =>
      makeLogger({ level: opts.level, fields: { ...opts.fields, ...fields }, write: opts.write }),
  };
}

/** Default sink: a log file if provided, else stderr. Injectable for tests. */
export function createLogger(
  level?: LogLevel,
  write?: (line: string) => void,
  logFile?: string,
): Logger {
  const resolved = level ?? resolveLogLevel(process.env["LOG_LEVEL"]);
  const sink =
    write ??
    (logFile !== undefined
      ? (line: string) => appendFileSync(logFile, line)
      : (line: string) => {
          process.stderr.write(line);
        });
  return makeLogger({ level: resolved, fields: {}, write: sink });
}
