export type CategoryRow = {
  id: string;
  org_id: string;
  name: string;
  parent_id: string | null;
  created_at: Date;
};
