import assert from "node:assert/strict";
import test from "node:test";

import { getPermissionCatalog } from "../services/authorization.service.js";

test("getPermissionCatalog returns stable sequential permission ids", () => {
  const result = getPermissionCatalog();

  assert.equal(result.permissions.length > 0, true);
  assert.equal(result.permissions[0]?.id, 1);
  assert.equal(result.permissionMap["auth:delete"], 1);
  assert.equal(result.permissionMap["organization:create"], 100);
  assert.equal(result.permissionMap["category:create"], 200);
  assert.equal(result.permissionMap["product:create"], 300);
  assert.equal(result.permissionMap["inventory:read"], 400);
  assert.deepEqual(
    result.permissions.find((entry) => entry.key === "category:create"),
    { id: 200, key: "category:create" },
  );
});
