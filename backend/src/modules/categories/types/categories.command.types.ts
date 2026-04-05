export type Category = {
  id: string;
  orgId: string;
  name: string;
  parentId: string | null;
  createdAt: string;
};

export type CreateCategoryCommand = {
  name: string;
  parentId?: string | null | undefined;
};

export type UpdateCategoryCommand = {
  name: string;
  parentId?: string | null | undefined;
};
