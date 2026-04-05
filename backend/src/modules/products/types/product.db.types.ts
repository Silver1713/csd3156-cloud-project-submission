export type ProductRow = {
  id: string;
  owner_id: string | null;
  product_category_id: string | null;
  name: string;
  description: string | null;
  sku: string | null;
  image_url: string | null;
  image_object_key: string | null;
  unit_cost: string;
  deleted_at?: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type ProductListQuery = {
  ownerId: string;
  q?: string;
  sku?: string;
  productCategoryId?: string;
  createdFrom?: Date;
  createdTo?: Date;
  updatedFrom?: Date;
  updatedTo?: Date;
  hasInventory?: boolean;
  minQuantity?: number;
  maxQuantity?: number;
  minUnitCost?: number;
  maxUnitCost?: number;
  sortBy:
    | "name"
    | "sku"
    | "createdAt"
    | "updatedAt"
    | "quantity"
    | "unitCost";
  sortOrder: "asc" | "desc";
  limit: number;
  offset: number;
};
