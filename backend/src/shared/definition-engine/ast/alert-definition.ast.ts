import { z } from "zod";

import { baseMetricKeySchema } from "./metric-definition.ast.js";

export const customMetricKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, {
    message: "custom metric key must be snake_case starting with a lowercase letter",
  });

export const alertDefinitionSeveritySchema = z.enum(["low", "medium", "high"]);
export const alertDefinitionScopeSchema = z.enum([
  "organization",
  "product",
  "category",
]);

export const alertValueNodeSchema: z.ZodType<
  | { kind: "number"; value: number }
  | { kind: "metric"; source: "base"; key: z.infer<typeof baseMetricKeySchema> }
  | { kind: "metric"; source: "definition"; key: string }
> = z.union([
  z.object({
    kind: z.literal("number"),
    value: z.number().finite(),
  }),
  z.object({
    kind: z.literal("metric"),
    source: z.literal("base"),
    key: baseMetricKeySchema,
  }),
  z.object({
    kind: z.literal("metric"),
    source: z.literal("definition"),
    key: customMetricKeySchema,
  }),
]);

export type AlertConditionNode =
  | {
      kind: "comparison";
      operator: "gt" | "gte" | "lt" | "lte" | "eq" | "neq";
      left: z.infer<typeof alertValueNodeSchema>;
      right: z.infer<typeof alertValueNodeSchema>;
    }
  | {
      kind: "logical";
      operator: "and" | "or";
      conditions: AlertConditionNode[];
    };

export const alertConditionNodeSchema: z.ZodType<AlertConditionNode> = z.lazy(() =>
  z.union([
    z.object({
      kind: z.literal("comparison"),
      operator: z.enum(["gt", "gte", "lt", "lte", "eq", "neq"]),
      left: alertValueNodeSchema,
      right: alertValueNodeSchema,
    }),
    z.object({
      kind: z.literal("logical"),
      operator: z.enum(["and", "or"]),
      conditions: z.array(alertConditionNodeSchema).min(2).max(10),
    }),
  ]),
);

export function countAlertConditionNodes(node: AlertConditionNode): number {
  if (node.kind === "comparison") {
    return 1;
  }

  return 1 + node.conditions.reduce((sum, entry) => sum + countAlertConditionNodes(entry), 0);
}
