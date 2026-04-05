export type InventorySummaryRow = {
  product_id: string;
  owner_id: string | null;
  product_name: string;
  sku: string | null;
  unit_cost: string;
  quantity: number;
  updated_at: Date;
};

export type InventoryProductRow = {
  id: string;
  owner_id: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  unit_cost: string;
  created_at: Date;
  updated_at: Date;
};

export type InventoryInventoryRow = {
  product_id: string;
  quantity: number;
  created_at: Date;
  updated_at: Date;
};

export type InventoryMovementRow = {
  id: string;
  owner_id: string | null;
  actor_id: string | null;
  product_id: string | null;
  product_name: string;
  sku?: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  actor_username?: string | null;
  type: string;
  quantity: number;
  reason?: string | null;
  created_at: Date;
};

export type InventoryMovementQuery = {
  ownerId: string;
  productId?: string;
  actorId?: string;
  type?: string;
  createdFrom?: Date;
  createdTo?: Date;
  limit: number;
  offset: number;
};
