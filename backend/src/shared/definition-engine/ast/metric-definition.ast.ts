import { z } from "zod";

export const baseMetricKeySchema = z.enum([
  "totalSku",
  "totalQuantity",
  "totalValue",
  "criticalCount",
  "lowCount",
  "stockInQuantity",
  "stockOutQuantity",
  "transferInQuantity",
  "transferOutQuantity",
  "adjustmentIncreaseQuantity",
  "adjustmentDecreaseQuantity",
  "movementCount",
  "inboundQuantity",
  "outboundQuantity",
  "netQuantity",
]);

export const metricScopeSchema = z.enum(["organization", "product", "category"]);
export const metricFormatSchema = z.enum(["number", "percent", "currency", "quantity"]);

const metricNumberNodeSchema = z.object({
  kind: z.literal("number"),
  value: z.number().finite(),
});

const metricReferenceNodeSchema = z.object({
  kind: z.literal("metric"),
  key: baseMetricKeySchema,
});

export type MetricDefinitionNode =
  | z.infer<typeof metricNumberNodeSchema>
  | z.infer<typeof metricReferenceNodeSchema>
  | {
      kind: "add" | "sub" | "mul" | "div";
      left: MetricDefinitionNode;
      right: MetricDefinitionNode;
    };

export const metricDefinitionNodeSchema: z.ZodType<MetricDefinitionNode> = z.lazy(() =>
  z.union([
    metricNumberNodeSchema,
    metricReferenceNodeSchema,
    z.object({
      kind: z.literal("add"),
      left: metricDefinitionNodeSchema,
      right: metricDefinitionNodeSchema,
    }),
    z.object({
      kind: z.literal("sub"),
      left: metricDefinitionNodeSchema,
      right: metricDefinitionNodeSchema,
    }),
    z.object({
      kind: z.literal("mul"),
      left: metricDefinitionNodeSchema,
      right: metricDefinitionNodeSchema,
    }),
    z.object({
      kind: z.literal("div"),
      left: metricDefinitionNodeSchema,
      right: metricDefinitionNodeSchema,
    }),
  ]),
);

export function countMetricDefinitionNodes(node: MetricDefinitionNode): number {
  if (node.kind === "number" || node.kind === "metric") {
    return 1;
  }

  return 1 + countMetricDefinitionNodes(node.left) + countMetricDefinitionNodes(node.right);
}
