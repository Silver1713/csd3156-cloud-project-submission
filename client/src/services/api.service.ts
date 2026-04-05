/**
 * Shared browser-side API client for authenticated requests and typed response
 * parsing across the React application.
 */
import { getStoredAccessToken } from "./auth.service";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:3000";
const API_PREFIX = "/api";

export type StockMovement = {
  id: string;
  ownerId: string;
  actorId: string;
  productId: string;
  productName: string;
  sku: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorUsername: string | null;
  type:
    | "STOCK_IN"
    | "STOCK_OUT"
    | "TRANSFER_IN"
    | "TRANSFER_OUT"
    | "ADJUSTMENT_INCREASE"
    | "ADJUSTMENT_DECREASE";
  quantity: number;
  reason: string | null;
  createdAt: string;
};

type StockMovementsResponse = {
  movements: StockMovement[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
};

export type Product = {
  id: string;
  ownerId: string | null;
  productCategoryId: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  imageUrl: string | null;
  unitCost: number;
  createdAt: string;
  updatedAt: string;
};

export type InventorySummary = {
  productId: string;
  ownerId: string | null;
  productName: string;
  sku: string | null;
  unitCost: number;
  quantity: number;
  valuation: number;
  updatedAt: string;
};

export type Category = {
  id: string;
  orgId: string;
  name: string;
  parentId: string | null;
  createdAt: string;
};

export type OrganizationSummary = {
  id: string;
  name: string | null;
  joinKey: string | null;
  criticalStockThreshold: number;
  lowStockThreshold: number;
  capabilities: {
    canDeleteOrganization: boolean;
    canRegenerateJoinKey: boolean;
    canViewJoinKey: boolean;
  };
};

export type UserProfile = {
  id: string;
  orgId: string;
  profileUrl: string | null;
  name: string | null;
  email: string;
  username: string;
  authProvider: "backend" | "cognito";
  cognitoSub: string | null;
  roleId: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type DeleteMyAccountResponse = {
  deletedAccountId: string;
  deletedOrganizationId: string | null;
  organizationDeleted: boolean;
};

export type OrganizationMembershipTransfer = {
  removedAccountId: string;
  removedFromOrganizationId: string;
  selfRemoved: boolean;
  account: {
    id: string;
    orgId: string;
    profileUrl: string | null;
    name: string | null;
    username: string;
    email: string;
    authProvider: "backend" | "cognito";
    cognitoSub: string | null;
    roleId: string | null;
  };
  organization: OrganizationSummary;
};

export type OrganizationMember = {
  accountId: string;
  orgId: string;
  email: string;
  username: string;
  name: string | null;
  profileUrl: string | null;
  authProvider: "backend" | "cognito";
  cognitoSub: string | null;
  roleId: string | null;
  roleName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationRole = {
  id: string;
  orgId: string;
  name: string;
  level: number;
  createdAt: string;
  permissions: string[];
};

export type PermissionCatalogEntry = {
  id: number;
  key: string;
};

type ProductListResponse = {
  products: Product[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
};

type InventoryListResponse = {
  inventory: InventorySummary[];
};

type CategoryListResponse = {
  categories: Category[];
};

type CurrentOrganizationResponse = {
  organization: OrganizationSummary;
};

type OrganizationMembersResponse = {
  members: OrganizationMember[];
};

type OrganizationRolesResponse = {
  roles: OrganizationRole[];
};

type OrganizationPermissionsResponse = {
  permissions: PermissionCatalogEntry[];
  permissionMap: Record<string, number>;
};

export type InventoryOverviewMetrics = {
  totalSku: number;
  totalQuantity: number;
  totalValue: number;
  criticalCount: number;
  lowCount: number;
};

export type InventoryMovementTrendPoint = {
  bucket: string;
  inbound: number;
  outbound: number;
};

export type InventoryCategoryBreakdownEntry = {
  categoryId: string | null;
  categoryName: string;
  skuCount: number;
  totalQuantity: number;
  totalValue: number;
  share: number;
};

type InventoryOverviewMetricsResponse = {
  overview: InventoryOverviewMetrics;
};

type InventoryMovementTrendMetricsResponse = {
  days: number;
  trend: InventoryMovementTrendPoint[];
};

type InventoryCategoryBreakdownMetricsResponse = {
  categories: InventoryCategoryBreakdownEntry[];
};

export type BaseMetricCatalogEntry = {
  key: string;
  name: string;
  description: string;
  scope: "organization";
  format: "number" | "percent" | "currency" | "quantity";
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

export type MetricDefinitionNode =
  | { kind: "number"; value: number }
  | { kind: "metric"; key: BaseMetricCatalogEntry["key"] }
  | {
      kind: "add" | "sub" | "mul" | "div";
      left: MetricDefinitionNode;
      right: MetricDefinitionNode;
    };

export type AlertRecord = {
  id: string;
  ownerId: string;
  productId: string | null;
  productName: string | null;
  productSku: string | null;
  triggeredByMovementId: string | null;
  alertDefinitionId: string | null;
  type: "low_stock" | "critical_stock" | "custom";
  status: "active" | "acknowledged" | "resolved";
  thresholdQuantity: number | null;
  currentQuantity: number | null;
  message: string | null;
  acknowledgedBy: {
    id: string;
    name: string | null;
    username: string | null;
  } | null;
  acknowledgedAt: string | null;
  createdAt: string;
};

export type AlertDefinition = {
  id: string;
  orgId: string;
  key: string;
  name: string;
  description: string | null;
  severity: "low" | "medium" | "high";
  scope: "organization" | "product" | "category";
  condition: unknown;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type AlertConditionNode =
  | {
      kind: "comparison";
      operator: "gt" | "gte" | "lt" | "lte" | "eq" | "neq";
      left:
        | { kind: "number"; value: number }
        | {
            kind: "metric";
            source: "base" | "definition";
            key: string;
          };
      right:
        | { kind: "number"; value: number }
        | {
            kind: "metric";
            source: "base" | "definition";
            key: string;
          };
    }
  | {
      kind: "logical";
      operator: "and" | "or";
      conditions: AlertConditionNode[];
    };

type BaseMetricCatalogResponse = {
  metrics: BaseMetricCatalogEntry[];
};

type MetricDefinitionsResponse = {
  metrics: MetricDefinition[];
};

type MetricDefinitionResponse = {
  metric: MetricDefinition;
};

type MetricPreviewResponse = {
  preview: {
    status: "ready" | "stub";
    value: number | null;
    reason?: string;
  };
  baseMetrics: Record<string, number>;
};

type AlertDefinitionsResponse = {
  alertDefinitions: AlertDefinition[];
};

type AlertRecordsResponse = {
  alerts: AlertRecord[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
};

type AlertPreviewResponse = {
  preview: {
    status: "ready" | "stub";
    triggered: boolean | null;
    reason?: string;
  };
  baseMetrics: Record<string, number>;
  customMetrics: Record<string, number>;
};

export type InventoryMovementSummary = {
  movementCount: number;
  stockInQuantity: number;
  stockOutQuantity: number;
  transferInQuantity: number;
  transferOutQuantity: number;
  adjustmentIncreaseQuantity: number; 
  adjustmentDecreaseQuantity: number; 
  inboundQuantity: number;
  outboundQuantity: number;
  netQuantity: number;
};

type InventoryMovementSummaryResponse = {
  scope: {
    productId?: string;
    categoryId?: string;
    days: number;
  };
  summary: InventoryMovementSummary;
};


function applyJsonHeaders(headers: Headers, body: BodyInit | null | undefined): void {
  if (body !== null && body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const accessToken = getStoredAccessToken();

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  applyJsonHeaders(headers, init.body);

  return fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
    ...init,
    headers,
  });
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T | { message?: string };

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : "Request failed";

    throw new Error(message);
  }

  return payload as T;
}

export async function probeAuthenticatedBackend(): Promise<boolean> {
  const response = await apiFetch("/auth/accounts");
  return response.ok;
}

export async function listStockMovements(
  query: URLSearchParams | string = "limit=200&offset=0",
): Promise<StockMovementsResponse> {
  const queryString =
    typeof query === "string" ? query : query.toString();
  const response = await apiFetch(`/inventory/movements?${queryString}`);
  return parseJsonResponse<StockMovementsResponse>(response);
}

export async function listProducts(
  query: URLSearchParams | string = "limit=200&offset=0",
): Promise<ProductListResponse> {
  const queryString = typeof query === "string" ? query : query.toString();
  const response = await apiFetch(`/products?${queryString}`);
  return parseJsonResponse<ProductListResponse>(response);
}

export async function listInventory(): Promise<InventoryListResponse> {
  const response = await apiFetch("/inventory");
  return parseJsonResponse<InventoryListResponse>(response);
}

export async function listMovementTypes(): Promise<{ types: string[] }> {
  const response = await apiFetch("/inventory/movements/types");
  return parseJsonResponse<{ types: string[] }>(response);
}

export async function listCategories(): Promise<CategoryListResponse> {
  const response = await apiFetch("/categories");
  return parseJsonResponse<CategoryListResponse>(response);
}

/**
 * Returns the current organization summary and capability flags.
 */
export async function getMyOrganization(): Promise<CurrentOrganizationResponse> {
  const response = await apiFetch("/organizations/me");
  return parseJsonResponse<CurrentOrganizationResponse>(response);
}

export async function updateOrganization(
  organizationId: string,
  payload: {
    name?: string;
    criticalStockThreshold?: number;
    lowStockThreshold?: number;
  },
): Promise<CurrentOrganizationResponse> {
  const response = await apiFetch(`/organizations/${organizationId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<CurrentOrganizationResponse>(response);
}

export async function regenerateOrganizationJoinKey(): Promise<CurrentOrganizationResponse> {
  const response = await apiFetch("/organizations/me/join-key/regenerate", {
    method: "POST",
  });
  return parseJsonResponse<CurrentOrganizationResponse>(response);
}

export async function deleteOrganization(
  organizationId: string,
): Promise<CurrentOrganizationResponse> {
  const response = await apiFetch(`/organizations/${organizationId}`, {
    method: "DELETE",
  });
  return parseJsonResponse<CurrentOrganizationResponse>(response);
}

export async function listOrganizationMembers(): Promise<OrganizationMembersResponse> {
  const response = await apiFetch("/organizations/me/members");
  return parseJsonResponse<OrganizationMembersResponse>(response);
}

export async function listOrganizationRoles(): Promise<OrganizationRolesResponse> {
  const response = await apiFetch("/organizations/me/roles");
  return parseJsonResponse<OrganizationRolesResponse>(response);
}

export async function getOrganizationPermissions(): Promise<OrganizationPermissionsResponse> {
  const response = await apiFetch("/organizations/me/permissions");
  return parseJsonResponse<OrganizationPermissionsResponse>(response);
}

export async function createOrganizationRole(payload: {
  name: string;
  level: number;
  permissions: string[];
}): Promise<{ role: OrganizationRole }> {
  const response = await apiFetch("/organizations/me/roles", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<{ role: OrganizationRole }>(response);
}

export async function updateOrganizationMember(
  accountId: string,
  payload: {
    roleId: string | null;
  },
): Promise<{ member: OrganizationMember }> {
  const response = await apiFetch(`/organizations/me/members/${accountId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<{ member: OrganizationMember }>(response);
}

export async function removeOrganizationMember(
  accountId: string,
): Promise<OrganizationMembershipTransfer> {
  const response = await apiFetch(`/organizations/me/members/${accountId}`, {
    method: "DELETE",
  });
  return parseJsonResponse<OrganizationMembershipTransfer>(response);
}

export async function joinOrganization(
  joinKey: string,
): Promise<OrganizationMembershipTransfer> {
  const response = await apiFetch("/organizations/me/join", {
    method: "POST",
    body: JSON.stringify({ joinKey }),
  });
  return parseJsonResponse<OrganizationMembershipTransfer>(response);
}

export async function getInventoryOverviewMetrics(
  query: URLSearchParams | string = "",
): Promise<InventoryOverviewMetricsResponse> {
  const queryString = typeof query === "string" ? query : query.toString();
  const response = await apiFetch(
    `/metrics/inventory/overview${queryString ? `?${queryString}` : ""}`,
  );
  return parseJsonResponse<InventoryOverviewMetricsResponse>(response);
}

export async function getInventoryMovementTrendMetrics(
  query: URLSearchParams | string = "days=7",
): Promise<InventoryMovementTrendMetricsResponse> {
  const queryString = typeof query === "string" ? query : query.toString();
  const response = await apiFetch(`/metrics/inventory/movement-trend?${queryString}`);
  return parseJsonResponse<InventoryMovementTrendMetricsResponse>(response);
}
export async function getInventoryMovementSummary(
  query: URLSearchParams | string = "days=30",
): Promise<InventoryMovementSummaryResponse> {
  const queryString = typeof query === "string" ? query : query.toString();
  const response = await apiFetch(`/metrics/inventory/movement-summary?${queryString}`);
  return parseJsonResponse<InventoryMovementSummaryResponse>(response);
}

export type ProductMovementSummaryEntry = {
  productId: string;
  productName: string;
  sku: string | null;
  outboundQuantity: number;
  inboundQuantity: number;
  netQuantity: number;
  movementCount: number;
};

export async function getProductMovementLeaderboard(
  productIds: { id: string; name: string; sku: string | null }[],
  days: number,
): Promise<ProductMovementSummaryEntry[]> {
  const results = await Promise.allSettled(
    productIds.map(async ({ id, name, sku }) => {
      const data = await getInventoryMovementSummary(`productId=${id}&days=${days}`);
      return {
        productId: id,
        productName: name,
        sku,
        outboundQuantity: data.summary.outboundQuantity,
        inboundQuantity: data.summary.inboundQuantity,
        netQuantity: data.summary.netQuantity,
        movementCount: data.summary.movementCount,
      } satisfies ProductMovementSummaryEntry;
    }),
  );
  return results
    .filter((result): result is PromiseFulfilledResult<ProductMovementSummaryEntry> => result.status === "fulfilled")
    .map((result) => result.value)
    .sort((a, b) => b.outboundQuantity - a.outboundQuantity);
}
export async function getInventoryCategoryBreakdownMetrics(
  query: URLSearchParams | string = "top=10",
): Promise<InventoryCategoryBreakdownMetricsResponse> {
  const queryString = typeof query === "string" ? query : query.toString();
  const response = await apiFetch(`/metrics/inventory/category-breakdown?${queryString}`);
  return parseJsonResponse<InventoryCategoryBreakdownMetricsResponse>(response);
}

export async function getBaseMetricCatalog(): Promise<BaseMetricCatalogResponse> {
  const response = await apiFetch("/metrics/catalog");
  return parseJsonResponse<BaseMetricCatalogResponse>(response);
}

export async function listMetricDefinitions(): Promise<MetricDefinitionsResponse> {
  const response = await apiFetch("/metrics/definitions");
  return parseJsonResponse<MetricDefinitionsResponse>(response);
}

export async function getMetricDefinition(
  metricId: string,
): Promise<MetricDefinitionResponse> {
  const response = await apiFetch(`/metrics/definitions/${metricId}`);
  return parseJsonResponse<MetricDefinitionResponse>(response);
}

export async function createMetricDefinition(payload: {
  key: string;
  name: string;
  description?: string | null;
  scope: "organization" | "product" | "category";
  format: "number" | "percent" | "currency" | "quantity";
  definition: MetricDefinitionNode;
}): Promise<MetricDefinitionResponse> {
  const response = await apiFetch("/metrics/definitions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<MetricDefinitionResponse>(response);
}

export async function updateMetricDefinition(
  metricId: string,
  payload: {
    key?: string;
    name?: string;
    description?: string | null;
    scope?: "organization" | "product" | "category";
    format?: "number" | "percent" | "currency" | "quantity";
    definition?: MetricDefinitionNode;
    isActive?: boolean;
  },
): Promise<MetricDefinitionResponse> {
  const response = await apiFetch(`/metrics/definitions/${metricId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<MetricDefinitionResponse>(response);
}

export async function deleteMetricDefinition(
  metricId: string,
): Promise<MetricDefinitionResponse> {
  const response = await apiFetch(`/metrics/definitions/${metricId}`, {
    method: "DELETE",
  });
  return parseJsonResponse<MetricDefinitionResponse>(response);
}

export async function previewMetricDefinition(payload: {
  definition: MetricDefinitionNode;
  filters?: {
    q?: string;
    productId?: string;
    categoryIds?: string;
    stockState?: "critical" | "low" | "healthy";
    criticalThreshold?: number;
    lowThreshold?: number;
    days?: number;
  };
}): Promise<MetricPreviewResponse> {
  const response = await apiFetch("/metrics/definitions/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<MetricPreviewResponse>(response);
}

export async function listAlerts(
  query: URLSearchParams | string = "limit=50&offset=0",
): Promise<AlertRecordsResponse> {
  const queryString = typeof query === "string" ? query : query.toString();
  const response = await apiFetch(`/alerts${queryString ? `?${queryString}` : ""}`);
  return parseJsonResponse<AlertRecordsResponse>(response);
}

export async function updateAlert(
  alertId: string,
  payload: {
    status?: "active" | "acknowledged" | "resolved";
    thresholdQuantity?: number | null;
    currentQuantity?: number | null;
    message?: string | null;
  },
): Promise<{ alert: AlertRecord }> {
  const response = await apiFetch(`/alerts/${alertId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<{ alert: AlertRecord }>(response);
}

export async function deleteAlert(
  alertId: string,
): Promise<{ alert: AlertRecord }> {
  const response = await apiFetch(`/alerts/${alertId}`, {
    method: "DELETE",
  });
  return parseJsonResponse<{ alert: AlertRecord }>(response);
}

export async function listAlertDefinitions(): Promise<AlertDefinitionsResponse> {
  const response = await apiFetch("/alerts/definitions");
  return parseJsonResponse<AlertDefinitionsResponse>(response);
}

export async function createAlertDefinition(payload: {
  key: string;
  name: string;
  description?: string | null;
  severity: "low" | "medium" | "high";
  scope: "organization" | "product" | "category";
  condition: AlertConditionNode;
}): Promise<{ alertDefinition: AlertDefinition; engineStatus: "stub" }> {
  const response = await apiFetch("/alerts/definitions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<{ alertDefinition: AlertDefinition; engineStatus: "stub" }>(
    response,
  );
}

export async function updateAlertDefinition(
  alertDefinitionId: string,
  payload: {
    name?: string;
    description?: string | null;
    severity?: "low" | "medium" | "high";
    scope?: "organization" | "product" | "category";
    condition?: AlertConditionNode;
    isActive?: boolean;
  },
): Promise<{ alertDefinition: AlertDefinition; engineStatus: "stub" }> {
  const response = await apiFetch(`/alerts/definitions/${alertDefinitionId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<{ alertDefinition: AlertDefinition; engineStatus: "stub" }>(
    response,
  );
}

export async function deleteAlertDefinition(
  alertDefinitionId: string,
): Promise<{ alertDefinition: AlertDefinition }> {
  const response = await apiFetch(`/alerts/definitions/${alertDefinitionId}`, {
    method: "DELETE",
  });
  return parseJsonResponse<{ alertDefinition: AlertDefinition }>(response);
}

export async function previewAlertDefinition(payload: {
  condition: AlertConditionNode;
  scope: "organization" | "product" | "category";
  filters?: {
    productId?: string;
    categoryIds?: string;
    days?: number;
    stockState?: "critical" | "low" | "healthy";
  };
}): Promise<AlertPreviewResponse> {
  const response = await apiFetch("/alerts/definitions/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<AlertPreviewResponse>(response);
}

export async function createCategory(payload: {
  name: string;
  parentId?: string | null;
}): Promise<{ category: Category }> {
  const response = await apiFetch("/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<{ category: Category }>(response);
}

export async function getProduct(productId: string): Promise<{ product: Product }> {
  const response = await apiFetch(`/products/${productId}`);
  return parseJsonResponse<{ product: Product }>(response);
}

export async function createProduct(payload: {
  name: string;
  description?: string | null;
  sku?: string | null;
  imageObjectKey?: string | null;
  productCategoryId?: string | null;
  unitCost: number;
}): Promise<{ product: Product }> {
  const response = await apiFetch("/products", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<{ product: Product }>(response);
}

export async function updateProduct(
  productId: string,
  payload: {
    name: string;
    description?: string | null;
    sku?: string | null;
    imageObjectKey?: string | null;
    productCategoryId?: string | null;
    unitCost: number;
  },
): Promise<{ product: Product }> {
  const response = await apiFetch(`/products/${productId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<{ product: Product }>(response);
}

export async function createStockMovement(payload: {
  productId: string;
  type:
    | "STOCK_IN"
    | "STOCK_OUT"
    | "TRANSFER_IN"
    | "TRANSFER_OUT"
    | "ADJUSTMENT_INCREASE"
    | "ADJUSTMENT_DECREASE";
  quantity: number;
  reason?: string | null;
}): Promise<{ movement: StockMovement }> {
  const response = await apiFetch("/inventory/movements", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<{ movement: StockMovement }>(response);
}

export async function createInventoryAdjustment(payload: {
  productId: string;
  direction: "increase" | "decrease";
  quantity: number;
  reason: string;
}): Promise<{ movement: StockMovement; inventory: InventorySummary }> {
  const response = await apiFetch("/inventory/adjustments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<{ movement: StockMovement; inventory: InventorySummary }>(
    response,
  );
}

export async function updateMyProfile(payload: {
  name?: string | null;
  profileImageObjectKey?: string | null;
}): Promise<{ user: UserProfile }> {
  const response = await apiFetch("/users/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<{ user: UserProfile }>(response);
}

export async function deleteMyAccount(): Promise<DeleteMyAccountResponse> {
  const response = await apiFetch("/auth/me", {
    method: "DELETE",
  });
  return parseJsonResponse<DeleteMyAccountResponse>(response);
}

/**
 * Requests a presigned upload for a product image and returns the managed
 * object key the caller must later submit through the product API.
 */
export async function createProductImageUploadPresign(payload: {
  filename: string;
  contentType: string;
}): Promise<{
  uploadUrl: string;
  fileUrl: string;
  objectKey: string;
  expiresIn: number;
}> {
  const response = await apiFetch("/uploads/products/presign", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<{
    uploadUrl: string;
    fileUrl: string;
    objectKey: string;
    expiresIn: number;
  }>(response);
}

/**
 * Requests a presigned upload for a profile image and returns the managed
 * object key the caller must later submit through the profile API.
 */
export async function createProfileImageUploadPresign(payload: {
  filename: string;
  contentType: string;
}): Promise<{
  uploadUrl: string;
  fileUrl: string;
  objectKey: string;
  expiresIn: number;
}> {
  const response = await apiFetch("/uploads/profile/presign", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return parseJsonResponse<{
    uploadUrl: string;
    fileUrl: string;
    objectKey: string;
    expiresIn: number;
  }>(response);
}
