export const PRODUCT_PERMISSIONS = [
  "product:create",
  "product:read",
  "product:update",
  "product:delete",
] as const;

export type ProductPermission =
  | "product:create"
  | "product:read"
  | "product:update"
  | "product:delete";
