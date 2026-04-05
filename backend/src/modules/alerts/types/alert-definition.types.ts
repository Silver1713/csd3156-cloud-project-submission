export type AlertDefinitionSeverity = "low" | "medium" | "high";

export type AlertDefinitionScope = "organization" | "product" | "category";

export type AlertDefinitionRow = {
  id: string;
  org_id: string;
  key: string;
  name: string;
  description: string | null;
  severity: AlertDefinitionSeverity;
  scope: AlertDefinitionScope;
  condition_json: unknown;
  is_active: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
};

export type AlertDefinition = {
  id: string;
  orgId: string;
  key: string;
  name: string;
  description: string | null;
  severity: AlertDefinitionSeverity;
  scope: AlertDefinitionScope;
  condition: unknown;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
