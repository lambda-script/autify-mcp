import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  idSchema,
  projectIdSchema,
  updateScenarioBodySchema,
  urlReplacementBodySchema,
  urlReplacementUpdateBodySchema,
  testPlanVariableBodySchema,
  accessPointBodySchema,
} from "./schemas.js";
import { guard, jsonResult } from "./tool-helpers.js";
import { unwrap } from "./tools-read.js";
import { requireProjectId } from "./context.js";
import type { ServerContext } from "./context.js";

const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true } as const;
const MUTATING = { readOnlyHint: false, destructiveHint: false } as const;

export function registerMutateTools(server: McpServer, ctx: ServerContext): void {
  const { client, logger } = ctx;

  // --- scenarios -------------------------------------------------------------
  server.registerTool(
    "autify_update_scenario",
    {
      title: "Update scenario",
      description: "Update a scenario's name, description, or labels.",
      annotations: MUTATING,
      inputSchema: {
        project_id: projectIdSchema.optional(),
        scenario_id: idSchema,
        name: updateScenarioBodySchema.shape.name,
        description: updateScenarioBodySchema.shape.description,
        labels: updateScenarioBodySchema.shape.labels,
      },
    },
    (args) =>
      guard(logger, "autify_update_scenario", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        const body = updateScenarioBodySchema.parse(args);
        return jsonResult(
          unwrap(
            await client.PUT("/projects/{project_id}/scenarios/{scenario_id}", {
              params: { path: { project_id, scenario_id: args.scenario_id } },
              body,
            }),
          ),
        );
      }),
  );

  server.registerTool(
    "autify_duplicate_scenario",
    {
      title: "Duplicate scenario",
      description: "Duplicate a scenario.",
      annotations: MUTATING,
      inputSchema: { project_id: projectIdSchema.optional(), scenario_id: idSchema },
    },
    (args) =>
      guard(logger, "autify_duplicate_scenario", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        return jsonResult(
          unwrap(
            await client.POST("/projects/{project_id}/scenarios/{scenario_id}/duplications", {
              params: { path: { project_id, scenario_id: args.scenario_id } },
            }),
          ),
        );
      }),
  );

  // --- access points ---------------------------------------------------------
  server.registerTool(
    "autify_create_access_point",
    {
      title: "Create access point",
      description: "Create an Autify Connect access point.",
      annotations: MUTATING,
      inputSchema: { project_id: projectIdSchema.optional(), name: accessPointBodySchema.shape.name },
    },
    (args) =>
      guard(logger, "autify_create_access_point", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        return jsonResult(
          unwrap(
            await client.POST("/projects/{project_id}/autify_connect/access_points", {
              params: { path: { project_id } },
              body: { name: args.name },
            }),
          ),
        );
      }),
  );

  server.registerTool(
    "autify_delete_access_point",
    {
      title: "Delete access point",
      description: "Delete an Autify Connect access point by name. Destructive.",
      annotations: DESTRUCTIVE,
      inputSchema: { project_id: projectIdSchema.optional(), name: accessPointBodySchema.shape.name },
    },
    (args) =>
      guard(logger, "autify_delete_access_point", async () => {
        const project_id = requireProjectId(ctx, args.project_id);
        return jsonResult(
          unwrap(
            await client.DELETE("/projects/{project_id}/autify_connect/access_points", {
              params: { path: { project_id } },
              body: { name: args.name },
            }),
          ),
        );
      }),
  );

  // --- url replacements ------------------------------------------------------
  server.registerTool(
    "autify_create_url_replacement",
    {
      title: "Create URL replacement",
      description: "Create a URL replacement for a test plan.",
      annotations: MUTATING,
      inputSchema: {
        test_plan_id: idSchema,
        pattern_url: urlReplacementBodySchema.shape.pattern_url,
        replacement_url: urlReplacementBodySchema.shape.replacement_url,
      },
    },
    (args) =>
      guard(logger, "autify_create_url_replacement", async () =>
        jsonResult(
          unwrap(
            await client.POST("/test_plans/{test_plan_id}/url_replacements", {
              params: { path: { test_plan_id: args.test_plan_id } },
              body: { pattern_url: args.pattern_url, replacement_url: args.replacement_url },
            }),
          ),
        ),
      ),
  );

  server.registerTool(
    "autify_update_url_replacement",
    {
      title: "Update URL replacement",
      description: "Update a URL replacement.",
      annotations: MUTATING,
      inputSchema: {
        test_plan_id: idSchema,
        url_replacement_id: idSchema,
        pattern_url: urlReplacementUpdateBodySchema.shape.pattern_url,
        replacement_url: urlReplacementUpdateBodySchema.shape.replacement_url,
      },
    },
    (args) =>
      guard(logger, "autify_update_url_replacement", async () => {
        const body = urlReplacementUpdateBodySchema.parse(args);
        return jsonResult(
          unwrap(
            await client.PUT("/test_plans/{test_plan_id}/url_replacements/{url_replacement_id}", {
              params: { path: { test_plan_id: args.test_plan_id, url_replacement_id: args.url_replacement_id } },
              body,
            }),
          ),
        );
      }),
  );

  server.registerTool(
    "autify_delete_url_replacement",
    {
      title: "Delete URL replacement",
      description: "Delete a URL replacement. Destructive.",
      annotations: DESTRUCTIVE,
      inputSchema: { test_plan_id: idSchema, url_replacement_id: idSchema },
    },
    (args) =>
      guard(logger, "autify_delete_url_replacement", async () =>
        jsonResult(
          unwrap(
            await client.DELETE("/test_plans/{test_plan_id}/url_replacements/{url_replacement_id}", {
              params: { path: { test_plan_id: args.test_plan_id, url_replacement_id: args.url_replacement_id } },
            }),
          ),
        ),
      ),
  );

  // --- test plan variables ---------------------------------------------------
  server.registerTool(
    "autify_create_test_plan_variable",
    {
      title: "Create test plan variable",
      description: "Create a variable for a test plan.",
      annotations: MUTATING,
      inputSchema: {
        test_plan_id: idSchema,
        key: testPlanVariableBodySchema.shape.key,
        default_value: testPlanVariableBodySchema.shape.default_value,
      },
    },
    (args) =>
      guard(logger, "autify_create_test_plan_variable", async () =>
        jsonResult(
          unwrap(
            await client.POST("/test_plans/{test_plan_id}/test_plan_variables", {
              params: { path: { test_plan_id: args.test_plan_id } },
              body: { key: args.key, default_value: args.default_value },
            }),
          ),
        ),
      ),
  );

  server.registerTool(
    "autify_update_test_plan_variable",
    {
      title: "Update test plan variable",
      description: "Update a test plan variable.",
      annotations: MUTATING,
      inputSchema: {
        test_plan_id: idSchema,
        test_plan_variable_id: idSchema,
        key: testPlanVariableBodySchema.shape.key,
        default_value: testPlanVariableBodySchema.shape.default_value,
      },
    },
    (args) =>
      guard(logger, "autify_update_test_plan_variable", async () =>
        jsonResult(
          unwrap(
            await client.PUT("/test_plans/{test_plan_id}/test_plan_variables/{test_plan_variable_id}", {
              params: { path: { test_plan_id: args.test_plan_id, test_plan_variable_id: args.test_plan_variable_id } },
              body: { key: args.key, default_value: args.default_value },
            }),
          ),
        ),
      ),
  );

  server.registerTool(
    "autify_delete_test_plan_variable",
    {
      title: "Delete test plan variable",
      description: "Delete a test plan variable. Destructive.",
      annotations: DESTRUCTIVE,
      inputSchema: { test_plan_id: idSchema, test_plan_variable_id: idSchema },
    },
    (args) =>
      guard(logger, "autify_delete_test_plan_variable", async () =>
        jsonResult(
          unwrap(
            await client.DELETE("/test_plans/{test_plan_id}/test_plan_variables/{test_plan_variable_id}", {
              params: { path: { test_plan_id: args.test_plan_id, test_plan_variable_id: args.test_plan_variable_id } },
            }),
          ),
        ),
      ),
  );
}
