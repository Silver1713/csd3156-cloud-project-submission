import test from "node:test";
import assert from "node:assert/strict";

import { updateMyUser, updateUser } from "../services/users.service.js";
import { UserNotFoundError } from "../types/users.errors.types.js";

process.env.AWS_REGION ??= "us-east-1";
process.env.S3_PRODUCT_IMAGE_BUCKET ??= "replace-with-s3-bucket-name";

const sampleUserRow = {
  id: "11111111-1111-1111-1111-111111111111",
  org_id: "22222222-2222-2222-2222-222222222222",
  profile_url: "https://example.com/avatar.png",
  profile_object_key: null,
  name: "Sample User",
  email: "sample@example.com",
  username: "sample_user",
  auth_provider: "cognito" as const,
  cognito_sub: "sub-123",
  role_id: "33333333-3333-3333-3333-333333333333",
  created_at: new Date("2026-03-28T00:00:00.000Z"),
  updated_at: new Date("2026-03-28T00:00:00.000Z"),
};

test("updateMyUser returns mapped user data and mocks repository access", async () => {
  let callCount = 0;

  const result = await updateMyUser(
    sampleUserRow.id,
    {
      name: "Renamed User",
      profileImageObjectKey: `images/profiles/${sampleUserRow.id}/avatar.png`,
    },
        {
          findUserById: async () => sampleUserRow,
          updateCurrentUserProfile: async () => {
            callCount += 1;
            return sampleUserRow;
          },
          updateUserInOrganization: async () => sampleUserRow,
          resolveStoredImageUrl: async (objectKey: string | null | undefined, fallbackUrl: string | null | undefined) =>
            objectKey ? `signed:${objectKey}` : (fallbackUrl ?? null),
          deleteImageObject: async () => undefined,
          getOrganizationAccessContext: async () => ({
        accountId: sampleUserRow.id,
        organization: {
          id: sampleUserRow.org_id,
          name: "Example Org",
          joinKey: "EXM10001",
          criticalStockThreshold: 10,
          lowStockThreshold: 25,
          capabilities: {
            canDeleteOrganization: false,
            canRegenerateJoinKey: false,
            canViewJoinKey: false,
          },
        },
        role: null,
      }),
    },
  );

  assert.equal(callCount, 1);
  assert.equal(result.user.id, sampleUserRow.id);
  assert.equal(result.user.name, sampleUserRow.name);
  assert.equal(
    result.user.profileUrl,
    sampleUserRow.profile_url,
  );
});

test("updateMyUser throws when repository returns null", async () => {
  let callCount = 0;

  await assert.rejects(
    () =>
      updateMyUser(
        "missing-user",
        { name: "Missing" },
        {
          findUserById: async () => sampleUserRow,
          updateCurrentUserProfile: async () => {
            callCount += 1;
            return null;
          },
          updateUserInOrganization: async () => sampleUserRow,
          resolveStoredImageUrl: async (objectKey: string | null | undefined, fallbackUrl: string | null | undefined) =>
            objectKey ? `signed:${objectKey}` : (fallbackUrl ?? null),
          deleteImageObject: async () => undefined,
          getOrganizationAccessContext: async () => ({
            accountId: sampleUserRow.id,
            organization: {
              id: sampleUserRow.org_id,
              name: "Example Org",
              joinKey: "EXM10001",
              criticalStockThreshold: 10,
              lowStockThreshold: 25,
              capabilities: {
                canDeleteOrganization: false,
                canRegenerateJoinKey: false,
                canViewJoinKey: false,
              },
            },
            role: null,
          }),
        },
      ),
    UserNotFoundError,
  );

  assert.equal(callCount, 1);
});

test("updateUser requires admin-style permissions before touching the repository", async () => {
  let callCount = 0;

  const currentUser = {
    id: sampleUserRow.id,
    orgId: sampleUserRow.org_id,
    profileUrl: sampleUserRow.profile_url,
    name: sampleUserRow.name,
    email: sampleUserRow.email,
    username: sampleUserRow.username,
    authProvider: sampleUserRow.auth_provider,
    cognitoSub: sampleUserRow.cognito_sub,
    roleId: sampleUserRow.role_id,
  };

  await assert.rejects(
    () =>
      updateUser(
        currentUser,
        {
          userId: sampleUserRow.id,
          name: "Unauthorized change",
        },
        {
          findUserById: async () => sampleUserRow,
          updateCurrentUserProfile: async () => sampleUserRow,
          updateUserInOrganization: async () => {
            callCount += 1;
            return sampleUserRow;
          },
          resolveStoredImageUrl: async (objectKey: string | null | undefined, fallbackUrl: string | null | undefined) =>
            objectKey ? `signed:${objectKey}` : (fallbackUrl ?? null),
          deleteImageObject: async () => undefined,
          getOrganizationAccessContext: async () => ({
            accountId: sampleUserRow.id,
            organization: {
              id: sampleUserRow.org_id,
              name: "Example Org",
              joinKey: "EXM10001",
              criticalStockThreshold: 10,
              lowStockThreshold: 25,
              capabilities: {
                canDeleteOrganization: false,
                canRegenerateJoinKey: false,
                canViewJoinKey: false,
              },
            },
            role: {
              id: sampleUserRow.role_id!,
              orgId: sampleUserRow.org_id,
              name: "viewer",
              level: 10,
              createdAt: "",
              permissions: ["auth:read"],
            },
          }),
        },
      ),
    /Admin permissions are required to update users/,
  );

  assert.equal(callCount, 0);
});
