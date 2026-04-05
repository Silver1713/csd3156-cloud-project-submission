import {
  INVENTORY_PERMISSIONS,
  type InventoryPermission,
} from "../../inventory/types/inventory.permission.types.js";
import {
  CATEGORY_PERMISSIONS,
  type CategoryPermission,
} from "../../categories/types/categories.permission.types.js";
import {
  PRODUCT_PERMISSIONS,
  type ProductPermission,
} from "../../products/types/products.permission.types.js";

export const AUTH_PERMISSIONS = [
  "auth:delete",
  "auth:delete_self",
  "auth:read",
  "auth:update",
  "auth:link",
  "auth:manage",
] as const;

export const ORGANIZATION_PERMISSIONS = [
  "organization:create",
  "organization:read",
  "organization:update",
  "organization:members:read",
  "organization:members:invite",
  "organization:members:manage",
  "organization:manage",
] as const;

export type AuthPermission = (typeof AUTH_PERMISSIONS)[number];

export type OrganizationPermission = (typeof ORGANIZATION_PERMISSIONS)[number];

export type Permission =
  | AuthPermission
  | OrganizationPermission
  | CategoryPermission
  | ProductPermission
  | InventoryPermission;

export const PERMISSION_ID_MAP = {
  "auth:delete": 1,
  "auth:delete_self": 2,
  "auth:read": 3,
  "auth:update": 4,
  "auth:link": 5,
  "auth:manage": 6,
  "organization:create": 100,
  "organization:read": 101,
  "organization:update": 102,
  "organization:members:read": 103,
  "organization:members:invite": 104,
  "organization:members:manage": 105,
  "organization:manage": 106,
  "category:create": 200,
  "category:read": 201,
  "category:update": 202,
  "category:delete": 203,
  "product:create": 300,
  "product:read": 301,
  "product:update": 302,
  "product:delete": 303,
  "inventory:read": 400,
  "inventory:update": 401,
  "stockmovement:read": 402,
  "stockmovement:create": 403,
  "alert:manage": 404,
} as const satisfies Record<Permission, number>;

export const ALL_PERMISSIONS = Object.keys(PERMISSION_ID_MAP) as Permission[];
