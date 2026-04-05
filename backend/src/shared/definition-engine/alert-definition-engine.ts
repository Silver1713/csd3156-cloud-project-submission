import type {
  AlertDefinitionEvaluationRequest,
  AlertDefinitionEvaluationResult,
} from "./types.js";
import type { AlertConditionNode } from "./ast/alert-definition.ast.js";

function resolveValue(
  node: AlertConditionNode extends infer _T
    ? { kind: "number"; value: number } | { kind: "metric"; source: "base" | "definition"; key: string }
    : never,
  values: Record<string, number>,
): number {
  if (node.kind === "number") {
    return node.value;
  }

  const value = values[node.key];

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Metric "${node.key}" is not available for alert evaluation`);
  }

  return value;
}

function evaluateNode(
  node: AlertConditionNode,
  values: Record<string, number>,
): boolean {
  if (node.kind === "logical") {
    const evaluated = node.conditions.map((condition) => evaluateNode(condition, values));
    return node.operator === "and"
      ? evaluated.every(Boolean)
      : evaluated.some(Boolean);
  }

  const left = resolveValue(node.left, values);
  const right = resolveValue(node.right, values);

  switch (node.operator) {
    case "gt":
      return left > right;
    case "gte":
      return left >= right;
    case "lt":
      return left < right;
    case "lte":
      return left <= right;
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
  }
}

export function evaluateAlertDefinition(
  request: AlertDefinitionEvaluationRequest,
): AlertDefinitionEvaluationResult {
  try {
    const triggered = evaluateNode(
      request.condition as AlertConditionNode,
      {
        ...request.baseMetrics,
        ...(request.customMetrics ?? {}),
      },
    );

    return {
      status: "ready",
      triggered,
    };
  } catch (error) {
    return {
      status: "ready",
      triggered: null,
      reason: error instanceof Error ? error.message : "Alert definition evaluation failed",
    };
  }
}
