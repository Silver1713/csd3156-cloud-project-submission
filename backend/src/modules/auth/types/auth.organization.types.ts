export type AuthOrganization = {
  id: string;
  name: string | null;
};

export type CurrentOrganizationContext = {
  orgId: string;
  orgName: string | null;
};
