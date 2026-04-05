export type DefinitionEngineStatus = "stub" | "ready";

export type DefinitionEvaluationScope = {
  orgId: string;
  productId?: string;
  categoryId?: string;
};

export type DefinitionMetricValues = Record<string, number>;

export type MetricDefinitionEvaluationRequest = {
  definition: unknown;
  scope: DefinitionEvaluationScope;
  baseMetrics: DefinitionMetricValues;
  customMetrics?: DefinitionMetricValues;
};

export type MetricDefinitionEvaluationResult = {
  status: DefinitionEngineStatus;
  value: number | null;
  reason?: string;
};

export type AlertDefinitionEvaluationRequest = {
  condition: unknown;
  scope: DefinitionEvaluationScope;
  baseMetrics: DefinitionMetricValues;
  customMetrics?: DefinitionMetricValues;
};

export type AlertDefinitionEvaluationResult = {
  status: DefinitionEngineStatus;
  triggered: boolean | null;
  reason?: string;
};
