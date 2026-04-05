import { getOrganizationAccessContext } from "../../organizations/services/organizations.service.js";
import type { AuthenticatedAccountContext } from "../../auth/types/auth.request.types.js";
import {
  findUserById,
  updateCurrentUserProfile,
  updateUserInOrganization,
} from "../repositories/users.repository.js";
import type {
  PublicUserAccount,
} from "../types/users.account.types.js";
import type { UpdateUserCommand, UpdateUserResult } from "../types/users.command.types.js";
import type { UserAccountRow } from "../types/users.db.types.js";
import { UserNotFoundError } from "../types/users.errors.types.js";
import {
  deleteImageObject,
  isManagedImageObjectKey,
  isValidProfileImageObjectKeyForAccount,
  resolveStoredImageUrl,
} from "../../uploads/services/uploads.service.js";

async function mapUserAccountRowToPublicAccount(
  account: UserAccountRow,
  dependencies: Pick<UsersServiceDependencies, "resolveStoredImageUrl">,
): Promise<PublicUserAccount> {
  return {
    id: account.id,
    orgId: account.org_id,
    profileUrl: await dependencies.resolveStoredImageUrl(
      account.profile_object_key,
      account.profile_url,
    ),
    name: account.name,
    email: account.email,
    username: account.username,
    authProvider: account.auth_provider,
    cognitoSub: account.cognito_sub,
    roleId: account.role_id,
    createdAt: account.created_at,
    updatedAt: account.updated_at,
  };
}

type UsersServiceDependencies = {
  updateCurrentUserProfile: typeof updateCurrentUserProfile;
  findUserById: typeof findUserById;
  updateUserInOrganization: typeof updateUserInOrganization;
  getOrganizationAccessContext: typeof getOrganizationAccessContext;
  resolveStoredImageUrl: typeof resolveStoredImageUrl;
  deleteImageObject: typeof deleteImageObject;
};

const defaultDependencies: UsersServiceDependencies = {
  updateCurrentUserProfile,
  findUserById,
  updateUserInOrganization,
  getOrganizationAccessContext,
  resolveStoredImageUrl,
  deleteImageObject,
};

export async function updateMyUser(
  userId: string,
  command: Pick<UpdateUserCommand, "name" | "profileUrl"> & {
    profileImageObjectKey?: string | null | undefined;
  },
  dependencies: UsersServiceDependencies = defaultDependencies,
): Promise<UpdateUserResult> {
  let profileUrl = command.profileUrl;
  let profileObjectKey: string | null | undefined;
  const existingUser = await dependencies.findUserById(userId);
  const previousProfileObjectKey = existingUser?.profile_object_key ?? null;

  if (command.profileImageObjectKey === null) {
    profileUrl = null;
    profileObjectKey = null;
  } else if (command.profileImageObjectKey !== undefined) {
    if (
      !isValidProfileImageObjectKeyForAccount(
        userId,
        command.profileImageObjectKey,
      )
    ) {
      throw new Error("Invalid profile image object key");
    }

    profileUrl = null;
    profileObjectKey = command.profileImageObjectKey;
  }

  const user = await dependencies.updateCurrentUserProfile(userId, {
    name: command.name,
    profileUrl,
    profileObjectKey,
  });

  if (!user) {
    throw new UserNotFoundError();
  }

  if (
    previousProfileObjectKey &&
    previousProfileObjectKey !== (profileObjectKey ?? previousProfileObjectKey) &&
    isManagedImageObjectKey(previousProfileObjectKey)
  ) {
    await dependencies.deleteImageObject(previousProfileObjectKey);
  }

  return {
    user: await mapUserAccountRowToPublicAccount(user, dependencies),
  };
}

export async function updateUser(
  currentUser: AuthenticatedAccountContext,
  command: UpdateUserCommand,
  dependencies: UsersServiceDependencies = defaultDependencies,
): Promise<UpdateUserResult> {
  const organizationAccessContext =
    await dependencies.getOrganizationAccessContext(currentUser.id);
  const permissions = organizationAccessContext.role?.permissions ?? [];
  const isAdmin =
    permissions.includes("organization:members:manage")
    || permissions.includes("auth:manage");

  if (!isAdmin) {
    throw new Error("Admin permissions are required to update users");
  }

  const user = await dependencies.updateUserInOrganization(
    command.userId,
    currentUser.orgId,
    {
      name: command.name,
      profileUrl: command.profileUrl,
      profileObjectKey: command.profileUrl !== undefined ? null : undefined,
      email: command.email,
      username: command.username,
      roleId: command.roleId,
    },
  );

  if (!user) {
    throw new UserNotFoundError();
  }

  return {
    user: await mapUserAccountRowToPublicAccount(user, dependencies),
  };
}
