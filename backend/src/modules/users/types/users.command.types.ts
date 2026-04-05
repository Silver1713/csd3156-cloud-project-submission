import type { PublicUserAccount } from "./users.account.types.js";

export type ListUsersCommand = {
  orgId: string;
};

export type GetUserCommand = {
  userId: string;
};

export type CreateUserCommand = {
  orgId: string;
  profileUrl?: string | null;
  name?: string | null;
  email: string;
  username: string;
  authProvider: "backend" | "cognito";
  passwordHash?: string | null;
  cognitoSub?: string | null;
  roleId?: string | null;
};

export type UpdateUserCommand = {
  userId: string;
  profileUrl?: string | null | undefined;
  name?: string | null | undefined;
  email?: string;
  username?: string;
  roleId?: string | null;
};

export type DeleteUserCommand = {
  userId: string;
};

export type ListUsersResult = {
  users: PublicUserAccount[];
};

export type GetUserResult = {
  user: PublicUserAccount;
};

export type CreateUserResult = {
  user: PublicUserAccount;
};

export type UpdateUserResult = {
  user: PublicUserAccount;
};

export type DeleteUserResult = {
  deletedUserId: string;
};
