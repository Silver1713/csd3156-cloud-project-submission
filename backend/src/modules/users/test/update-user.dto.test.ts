import test from "node:test";
import assert from "node:assert/strict";

import { updateCurrentUserRequestSchema } from "../dto/update-user.dto.js";

test("updateCurrentUserRequestSchema accepts name-only updates", () => {
  const result = updateCurrentUserRequestSchema.safeParse({
    name: "Updated Name",
  });

  assert.equal(result.success, true);
});

test("updateCurrentUserRequestSchema accepts profileImageObjectKey-only updates", () => {
  const result = updateCurrentUserRequestSchema.safeParse({
    profileImageObjectKey: "profiles/11111111-1111-1111-1111-111111111111/avatar.png",
  });

  assert.equal(result.success, true);
});

test("updateCurrentUserRequestSchema rejects empty payloads", () => {
  const result = updateCurrentUserRequestSchema.safeParse({});

  assert.equal(result.success, false);
});

test("updateCurrentUserRequestSchema rejects invalid profile image object keys", () => {
  const result = updateCurrentUserRequestSchema.safeParse({
    profileImageObjectKey: "",
  });

  assert.equal(result.success, false);
});
