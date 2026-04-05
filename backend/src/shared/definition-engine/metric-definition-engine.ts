import type {
  MetricDefinitionEvaluationRequest,
  MetricDefinitionEvaluationResult,
} from "./types.js";
import type { MetricDefinitionNode } from "./ast/metric-definition.ast.js";

function evaluateNode(
  node: MetricDefinitionNode,
  values: Record<string, number>,
): number {
  if (node.kind === "number") {
    return node.value;
  }

  if (node.kind === "metric") {
    const value = values[node.key];

    if (typeof value !== "number" || Number.isNaN(value)) {
      throw new Error(`Metric "${node.key}" is not available for evaluation`);
    }

    return value;
  }

  const left = evaluateNode(node.left, values);
  const right = evaluateNode(node.right, values);

  switch (node.kind) {
    case "add":
      return left + right;
    case "sub":
      return left - right;
    case "mul":
      return left * right;
    case "div":
      if (right === 0) {
        throw new Error("Metric definition evaluated to division by zero");
      }

      return left / right;
  }
}

export function evaluateMetricDefinition(
  request: MetricDefinitionEvaluationRequest,
): MetricDefinitionEvaluationResult {
  try {
    const value = evaluateNode(
      request.definition as MetricDefinitionNode,
      {
        ...request.baseMetrics,
        ...(request.customMetrics ?? {}),
      },
    );

    return {
      status: "ready",
      value,
    };
  } catch (error) {
    return {
      status: "ready",
      value: null,
      reason: error instanceof Error ? error.message : "Metric definition evaluation failed",
    };
  }
}
