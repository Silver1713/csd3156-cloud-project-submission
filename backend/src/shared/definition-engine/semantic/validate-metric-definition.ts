import type { MetricDefinitionNode } from "../ast/metric-definition.ast.js";
import type { DefinitionSemanticIssue } from "./types.js";

function collectMetricDefinitionIssues(
  node: MetricDefinitionNode,
  path = "definition",
): DefinitionSemanticIssue[] {
  if (node.kind === "number" || node.kind === "metric") {
    return [];
  }

  const issues: DefinitionSemanticIssue[] = [];

  if (node.kind === "div" && node.right.kind === "number" && node.right.value === 0) {
    issues.push({
      path: `${path}.right`,
      message: "Division by a literal zero is not allowed",
    });
  }

  issues.push(...collectMetricDefinitionIssues(node.left, `${path}.left`), 
  ...collectMetricDefinitionIssues(node.right, `${path}.right`));

  return issues;
}

export function validateMetricDefinitionSemantics(
  definition: MetricDefinitionNode,
): DefinitionSemanticIssue[] {
  return collectMetricDefinitionIssues(definition);
}
