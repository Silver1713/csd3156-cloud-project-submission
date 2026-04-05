export class CategoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CategoryError";
  }
}

export class CategoryNotFoundError extends CategoryError {
  constructor(message = "Category not found") {
    super(message);
    this.name = "CategoryNotFoundError";
  }
}

export class CategoryDeleteBlockedError extends CategoryError {
  constructor() {
    super("Category cannot be deleted while related records still exist");
    this.name = "CategoryDeleteBlockedError";
  }
}
