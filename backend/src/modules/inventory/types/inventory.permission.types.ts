export const INVENTORY_PERMISSIONS = [
  "inventory:read",
  "inventory:update",
  "stockmovement:read",
  "stockmovement:create",
  "alert:manage",
] as const;

export type InventoryPermission =
  | "inventory:read"
  | "inventory:update"
  | "stockmovement:read"
  | "stockmovement:create"
  | "alert:manage";
