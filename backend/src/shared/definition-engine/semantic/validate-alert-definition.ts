import type { AlertConditionNode } from "../ast/alert-definition.ast.js";
import type { DefinitionSemanticIssue } from "./types.js";

type CustomMetricDefinitionReference = {
  key: string;
  scope: "organization" | "product" | "category";
  isActive: boolean;
};

function collectAlertDefinitionIssues(
  node: AlertConditionNode,
  alertScope: "organization" | "product" | "category",
  availableMetricsByKey: Map<string, CustomMetricDefinitionReference>,
  path = "condition",
): DefinitionSemanticIssue[] {
  if (node.kind === "comparison") {
    const issues: DefinitionSemanticIssue[] = [];

    for (const [sideKey, sideValue] of [
      ["left", node.left],
      ["right", node.right],
    ] as const) {
      if (sideValue.kind !== "metric" || sideValue.source !== "definition") {
        continue;
      }

      const referencedMetric = availableMetricsByKey.get(sideValue.key);

      if (!referencedMetric) {
        issues.push({
          path: `${path}.${sideKey}.key`,
          message: `Referenced custom metric "${sideValue.key}" does not exist in this organization`,
        });
        continue;
      }

      if (!referencedMetric.isActive) {
        issues.push({
          path: `${path}.${sideKey}.key`,
          message: `Referenced custom metric "${sideValue.key}" is inactive`,
        });
      }

      if (referencedMetric.scope !== alertScope) {
        issues.push({
          path: `${path}.${sideKey}.key`,
          message: `Referenced custom metric "${sideValue.key}" has scope "${referencedMetric.scope}" and cannot be used in a "${alertScope}" alert`,
        });
      }
    }

    return issues;
  }

  return node.conditions.flatMap((condition, index) =>
    collectAlertDefinitionIssues(
      condition,
      alertScope,
      availableMetricsByKey,
      `${path}.conditions[${index}]`,
    ),
  );
}

export function validateAlertDefinitionSemantics(input: {
  condition: AlertConditionNode;
  scope: "organization" | "product" | "category";
  availableCustomMetrics: CustomMetricDefinitionReference[];
}): DefinitionSemanticIssue[] {
  const availableMetricsByKey = new Map(
    input.availableCustomMetrics.map((entry) => [entry.key, entry]),
  );

  return collectAlertDefinitionIssues(
    input.condition,
    input.scope,
    availableMetricsByKey,
  );
}
