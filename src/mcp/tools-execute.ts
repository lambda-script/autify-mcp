import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { idSchema, projectIdSchema, executeScenariosBodySchema, executeScheduleBodySchema } from "./schemas.js";
import { guard, jsonResult } from "./tool-helpers.js";
import { unwrap } from "./tools-read.js";
import { requireProjectId } from "./context.js";
import type { ServerContext } from "./context.js";

export function registerExecuteTools(server: McpServer, ctx: ServerContext): void {
  const { client, logger } = ctx;

  server.registerTool(
    "autify_execute_scenarios",
    {
      title: "Execute scenarios",
      description:
        "Run one or more scenarios on the given capabilities. BILLABLE: consumes test credits. Returns the test result id.",
      annotations: { readOnlyHint: false, destructiveHint: false },
      inputSchema: {
        project_id: projectIdSchema.optional(),
        name: executeScenariosBodySchema.shape.name,
        execution_type: executeScenariosBodySchema.shape.execution_type,
        capabilities: executeScenariosBodySchema.shape.capabilities,
        scenarios: executeScenariosBodySchema.shape.scenarios,
        url_replacements: executeScenariosBodySchema.shape.url_replacements,
      },
    },
    (args) =>
      guard(logger, "autify_execute_scenarios", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        const body = executeScenariosBodySchema.parse(args);
        return jsonResult(
          unwrap(
            await client.POST("/projects/{project_id}/execute_scenarios", {
              params: { path: { project_id } },
              body,
            }),
          ),
        );
      }),
  );

  server.registerTool(
    "autify_execute_schedule",
    {
      title: "Execute schedule (run test plan)",
      description:
        "Run a test plan via its schedule id. BILLABLE: consumes test credits. Returns the test plan result id.",
      annotations: { readOnlyHint: false, destructiveHint: false },
      inputSchema: {
        schedule_id: idSchema.describe("The schedule (test plan) id to run"),
        autify_connect: executeScheduleBodySchema.shape.autify_connect,
      },
    },
    (args) =>
      guard(logger, "autify_execute_schedule", async () => {
        const body = executeScheduleBodySchema.parse(args);
        return jsonResult(
          unwrap(
            await client.POST("/schedules/{schedule_id}", {
              params: { path: { schedule_id: args.schedule_id } },
              body,
            }),
          ),
        );
      }),
  );
}
