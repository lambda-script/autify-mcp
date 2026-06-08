import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { AutifyMcpError } from "../core/types.js";
import { idSchema, projectIdSchema } from "./schemas.js";
import { guard, jsonResult } from "./tool-helpers.js";
import { unwrap } from "./tools-read.js";
import { requireProjectId } from "./context.js";
import type { ServerContext } from "./context.js";

const TERMINAL = new Set(["passed", "failed", "skipped", "internal_error", "canceled"]);
const MAX_TIMEOUT_SEC = 1800;
const MIN_POLL_SEC = 2;

export function isTerminalStatus(status: string | undefined): boolean {
  return status !== undefined && TERMINAL.has(status);
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function registerWaitTool(server: McpServer, ctx: ServerContext): void {
  const { client, logger } = ctx;

  server.registerTool(
    "autify_wait_for_result",
    {
      title: "Wait for test result",
      description:
        "Poll a test result until it reaches a terminal status (passed/failed/skipped/internal_error/canceled), then return it. Use after an execute tool to await pass/fail.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        project_id: projectIdSchema.optional(),
        result_id: idSchema,
        timeoutSec: z.number().int().nonnegative().max(MAX_TIMEOUT_SEC).optional().describe(`Max seconds to wait (cap ${MAX_TIMEOUT_SEC})`),
        pollIntervalSec: z.number().int().nonnegative().optional().describe(`Seconds between polls (min ${MIN_POLL_SEC} in production)`),
      },
    },
    (args) =>
      guard(logger, "autify_wait_for_result", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        const timeoutSec = args.timeoutSec ?? 600;
        // Allow 0 in tests; otherwise clamp to a sane minimum.
        const pollIntervalSec = args.pollIntervalSec === undefined ? MIN_POLL_SEC : args.pollIntervalSec;
        const deadline = Date.now() + timeoutSec * 1000;

        for (;;) {
          const data = unwrap(
            await client.GET("/projects/{project_id}/results/{result_id}", {
              params: { path: { project_id, result_id: args.result_id } },
            }),
          ) as { status?: string };
          if (isTerminalStatus(data.status)) return jsonResult(data);
          if (Date.now() >= deadline) {
            throw new AutifyMcpError(
              `Test result ${args.result_id} did not finish within ${timeoutSec}s (last status: ${data.status ?? "unknown"}).`,
              { code: "timeout", hint: "Increase timeoutSec or check the run in Autify.", meta: { result_id: args.result_id, lastStatus: data.status } },
            );
          }
          await sleep(pollIntervalSec * 1000);
        }
      }),
  );
}
