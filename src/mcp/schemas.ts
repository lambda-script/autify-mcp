import { z } from "zod";

import type { operations } from "../generated/autify.js";

/** Positive integer id (Autify path ids are integers). */
export const idSchema = z.number().int().positive();
export const projectIdSchema = idSchema.describe("Autify project id");

// --- execute_scenarios body --------------------------------------------------
const capabilitySchema = z
  .object({
    os_type: z.enum(["macos", "linux", "windows", "windows_server", "ios", "android"]).optional(),
    os_version: z.string().optional(),
    device: z.string().optional(),
    browser_type: z.enum(["chrome", "firefox", "safari", "edge", "edge_legacy", "ie"]).optional(),
    browser_version: z.string().optional(),
    timezone: z.enum(["JST", "UTC", "Asia/Tokyo", "Etc/UTC"]).optional(),
  })
  .strip();

// NOTE: execution_type is required in ExecuteScenariosRequest (no `?`),
// but has @default "parallel". We make it optional with a default so callers
// can omit it, and the inferred type still satisfies the generated type since
// z.infer includes the resolved value (string, not undefined).
export const executeScenariosBodySchema = z.object({
  name: z.string().optional().describe("Run name; defaults to an auto-generated name"),
  execution_type: z
    .enum(["parallel", "sequential"])
    .default("parallel")
    .describe("Execution mode; defaults to parallel"),
  capabilities: z.array(capabilitySchema).min(1).describe("Target OS/browser/device matrix"),
  scenarios: z.array(z.object({ id: idSchema })).min(1).describe("Scenarios to run, by id"),
  url_replacements: z
    .array(z.object({ pattern_url: z.string(), replacement_url: z.string() }))
    .optional(),
  autify_connect: z
    .object({ name: z.string().describe("Access point name for this run") })
    .optional(),
});

// --- execute_schedule body ---------------------------------------------------
export const executeScheduleBodySchema = z.object({
  autify_connect: z
    .object({
      name: z
        .string()
        .nullable()
        .describe("Access point name; null disables Autify Connect"),
    })
    .optional(),
});

// --- scenario update ---------------------------------------------------------
export const updateScenarioBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  labels: z.array(z.string()).optional(),
});

// --- url replacement ---------------------------------------------------------
export const urlReplacementBodySchema = z.object({
  pattern_url: z.string().describe("URL pattern to match, e.g. https://example.com"),
  replacement_url: z.string().describe("Replacement URL, e.g. https://example.net"),
});
export const urlReplacementUpdateBodySchema = urlReplacementBodySchema.partial();

// --- test plan variable ------------------------------------------------------
// NOTE: CreateTestPlanVariableRequest has key? and default_value? (both optional)
// in the generated spec, so we keep both optional here.
export const testPlanVariableBodySchema = z.object({
  key: z.string().optional().describe("Variable name"),
  default_value: z.string().optional().describe("Default value"),
});

// --- access point ------------------------------------------------------------
export const accessPointBodySchema = z.object({
  name: z.string().describe("Access point name"),
});

// ---------------------------------------------------------------------------
// Compile-time guards: zod inferred types must be assignable to the generated
// operation request bodies. These never run; they fail `tsc` if zod drifts
// from the spec. Update the schema (or regenerate types) when one breaks.
// ---------------------------------------------------------------------------
type Json<T extends keyof operations> =
  operations[T] extends { requestBody?: { content: { "application/json": infer B } } } ? B : never;

const _executeScenarios: Json<"executeScenarios"> = {} as z.infer<typeof executeScenariosBodySchema>;
const _executeSchedule: Json<"executeSchedule"> = {} as z.infer<typeof executeScheduleBodySchema>;
const _updateScenario: Json<"updateScenario"> = {} as z.infer<typeof updateScenarioBodySchema>;
const _createUrl: Json<"createUrlReplacement"> = {} as z.infer<typeof urlReplacementBodySchema>;
const _createVar: Json<"createTestPlanVariable"> = {} as z.infer<typeof testPlanVariableBodySchema>;
const _createAp: Json<"createAccessPoint"> = {} as z.infer<typeof accessPointBodySchema>;
void _executeScenarios;
void _executeSchedule;
void _updateScenario;
void _createUrl;
void _createVar;
void _createAp;
