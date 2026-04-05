export type UserAccount = {
  id: string;
  orgId: string;
  profileUrl: string | null;
  name: string | null;
  email: string;
  username: string;
  authProvider: "backend" | "cognito";
  cognitoSub: string | null;
  roleId: string | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type PublicUserAccount = UserAccount;
