export const inventoryMovementTypes = [
  "STOCK_IN",
  "STOCK_OUT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
  "ADJUSTMENT_INCREASE",
  "ADJUSTMENT_DECREASE",
] as const;

export type InventoryMovementType = (typeof inventoryMovementTypes)[number];

const increaseMovementTypes: ReadonlySet<InventoryMovementType> = new Set([
  "STOCK_IN",
  "TRANSFER_IN",
  "ADJUSTMENT_INCREASE",
]);

const decreaseMovementTypes: ReadonlySet<InventoryMovementType> = new Set([
  "STOCK_OUT",
  "TRANSFER_OUT",
  "ADJUSTMENT_DECREASE",
]);

export function getMovementDeltaSign(
  type: InventoryMovementType,
): 1 | -1 {
  if (increaseMovementTypes.has(type)) {
    return 1;
  }

  if (decreaseMovementTypes.has(type)) {
    return -1;
  }

  throw new Error(`Unsupported inventory movement type: ${type}`);
}
