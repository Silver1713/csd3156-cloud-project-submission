export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
  }
}

export class ProductNotFoundError extends InventoryError {
  constructor(message = "Product was not found") {
    super(message);
    this.name = "ProductNotFoundError";
  }
}

export class InsufficientStockError extends InventoryError {
  constructor(message = "Insufficient stock for this movement") {
    super(message);
    this.name = "InsufficientStockError";
  }
}

export class InventoryNotFoundError extends InventoryError {
  constructor(message = "Inventory row was not found") {
    super(message);
    this.name = "InventoryNotFoundError";
  }
}

export class InventoryAlreadyExistsError extends InventoryError {
  constructor(message = "Inventory row already exists for this product") {
    super(message);
    this.name = "InventoryAlreadyExistsError";
  }
}

export class UnsupportedMovementTypeError extends InventoryError {
  constructor(message = "Unsupported inventory movement type") {
    super(message);
    this.name = "UnsupportedMovementTypeError";
  }
}
