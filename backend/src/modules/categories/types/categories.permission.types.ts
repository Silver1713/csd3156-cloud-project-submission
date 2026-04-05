export const CATEGORY_PERMISSIONS = [
  "category:create",
  "category:read",
  "category:update",
  "category:delete",
] as const;

export type CategoryPermission =
  | "category:create"
  | "category:read"
  | "category:update"
  | "category:delete";
