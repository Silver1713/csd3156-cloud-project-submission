export type MetricDefinitionRow = {
  id: string;
  org_id: string;
  key: string;
  name: string;
  description: string | null;
  scope: "organization" | "product" | "category";
  format: "number" | "percent" | "currency" | "quantity";
  definition_json: unknown;
  is_active: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
};

export type MetricDefinition = {
  id: string;
  orgId: string;
  key: string;
  name: string;
  description: string | null;
  scope: "organization" | "product" | "category";
  format: "number" | "percent" | "currency" | "quantity";
  definition: unknown;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type BaseMetricCatalogEntry = {
  key: string;
  name: string;
  description: string;
  scope: "organization";
  format: "number" | "percent" | "currency" | "quantity";
};

