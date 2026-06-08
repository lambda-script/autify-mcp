import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { mapHttpError } from "../core/errors.js";
import { idSchema, projectIdSchema } from "./schemas.js";
import { guard, jsonResult } from "./tool-helpers.js";
import { requireProjectId } from "./context.js";
import type { ServerContext } from "./context.js";

const RO = { readOnlyHint: true } as const;

/** Throw a mapped error when an openapi-fetch result is not ok; else return data. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (!result.response.ok || result.error !== undefined) {
    throw mapHttpError(result.response.status, result.error);
  }
  return result.data as T;
}

export function registerReadTools(server: McpServer, ctx: ServerContext): void {
  const { client, logger } = ctx;

  server.registerTool(
    "autify_list_scenarios",
    {
      title: "List scenarios",
      description: "List test scenarios in a project.",
      annotations: RO,
      inputSchema: {
        project_id: projectIdSchema.optional(),
        page: z.number().int().positive().optional().describe("Page number"),
      },
    },
    (args) =>
      guard(logger, "autify_list_scenarios", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        const query = args.page !== undefined ? { page: args.page } : {};
        return jsonResult(
          unwrap(await client.GET("/projects/{project_id}/scenarios", { params: { path: { project_id }, query } })),
        );
      }),
  );

  server.registerTool(
    "autify_describe_scenario",
    {
      title: "Describe scenario",
      description: "Get a single test scenario by id.",
      annotations: RO,
      inputSchema: { project_id: projectIdSchema.optional(), scenario_id: idSchema },
    },
    (args) =>
      guard(logger, "autify_describe_scenario", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        return jsonResult(
          unwrap(
            await client.GET("/projects/{project_id}/scenarios/{scenario_id}", {
              params: { path: { project_id, scenario_id: args.scenario_id } },
            }),
          ),
        );
      }),
  );

  server.registerTool(
    "autify_list_results",
    {
      title: "List results",
      description: "List test results in a project.",
      annotations: RO,
      inputSchema: {
        project_id: projectIdSchema.optional(),
        page: z.number().int().positive().optional(),
        per_page: z.number().int().positive().optional(),
        test_plan_id: idSchema.optional(),
      },
    },
    (args) =>
      guard(logger, "autify_list_results", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        const query: Record<string, number> = {};
        if (args.page !== undefined) query["page"] = args.page;
        if (args.per_page !== undefined) query["per_page"] = args.per_page;
        if (args.test_plan_id !== undefined) query["test_plan_id"] = args.test_plan_id;
        return jsonResult(
          unwrap(await client.GET("/projects/{project_id}/results", { params: { path: { project_id }, query } })),
        );
      }),
  );

  server.registerTool(
    "autify_describe_result",
    {
      title: "Describe result",
      description: "Get a single test result by id.",
      annotations: RO,
      inputSchema: { project_id: projectIdSchema.optional(), result_id: idSchema },
    },
    (args) =>
      guard(logger, "autify_describe_result", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        return jsonResult(
          unwrap(
            await client.GET("/projects/{project_id}/results/{result_id}", {
              params: { path: { project_id, result_id: args.result_id } },
            }),
          ),
        );
      }),
  );

  server.registerTool(
    "autify_list_capabilities",
    {
      title: "List capabilities",
      description: "List available OS/browser/device capabilities for a project.",
      annotations: RO,
      inputSchema: { project_id: projectIdSchema.optional() },
    },
    (args) =>
      guard(logger, "autify_list_capabilities", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        return jsonResult(
          unwrap(await client.GET("/projects/{project_id}/capabilities", { params: { path: { project_id } } })),
        );
      }),
  );

  server.registerTool(
    "autify_list_access_points",
    {
      title: "List access points",
      description: "List Autify Connect access points for a project.",
      annotations: RO,
      inputSchema: { project_id: projectIdSchema.optional() },
    },
    (args) =>
      guard(logger, "autify_list_access_points", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        return jsonResult(
          unwrap(
            await client.GET("/projects/{project_id}/autify_connect/access_points", {
              params: { path: { project_id } },
            }),
          ),
        );
      }),
  );

  server.registerTool(
    "autify_list_url_replacements",
    {
      title: "List URL replacements",
      description: "List URL replacements for a test plan.",
      annotations: RO,
      inputSchema: { test_plan_id: idSchema },
    },
    (args) =>
      guard(logger, "autify_list_url_replacements", async () =>
        jsonResult(
          unwrap(
            await client.GET("/test_plans/{test_plan_id}/url_replacements", {
              params: { path: { test_plan_id: args.test_plan_id } },
            }),
          ),
        ),
      ),
  );

  server.registerTool(
    "autify_list_test_plan_variables",
    {
      title: "List test plan variables",
      description: "List variables for a test plan.",
      annotations: RO,
      inputSchema: { test_plan_id: idSchema },
    },
    (args) =>
      guard(logger, "autify_list_test_plan_variables", async () =>
        jsonResult(
          unwrap(
            await client.GET("/test_plans/{test_plan_id}/test_plan_variables", {
              params: { path: { test_plan_id: args.test_plan_id } },
            }),
          ),
        ),
      ),
  );

  server.registerTool(
    "autify_get_credit_usage",
    {
      title: "Get credit usage",
      description: "Get credit usage for a project.",
      annotations: RO,
      inputSchema: { project_id: projectIdSchema.optional() },
    },
    (args) =>
      guard(logger, "autify_get_credit_usage", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        return jsonResult(
          unwrap(await client.GET("/projects/{project_id}/credits", { params: { path: { project_id } } })),
        );
      }),
  );

  server.registerTool(
    "autify_get_project_info",
    {
      title: "Get project info",
      description: "Get information about a project.",
      annotations: RO,
      inputSchema: { project_id: projectIdSchema.optional() },
    },
    (args) =>
      guard(logger, "autify_get_project_info", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        return jsonResult(
          unwrap(await client.GET("/projects/{project_id}/project_info", { params: { path: { project_id } } })),
        );
      }),
  );
}
