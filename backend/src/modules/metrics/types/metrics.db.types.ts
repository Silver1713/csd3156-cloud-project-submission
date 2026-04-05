export type InventoryOverviewRow = {
  total_sku: string;
  total_quantity: string;
  total_value: string;
  critical_count: string;
  low_count: string;
};

export type InventoryMovementTrendRow = {
  bucket_date: Date | string;
  inbound_quantity: string;
  outbound_quantity: string;
};

export type InventoryCategoryBreakdownRow = {
  category_id: string | null;
  category_name: string;
  sku_count: string;
  total_quantity: string;
  total_value: string;
};

export type InventoryMovementSummaryRow = {
  movement_count: string;
  stock_in_quantity: string;
  stock_out_quantity: string;
  transfer_in_quantity: string;
  transfer_out_quantity: string;
  adjustment_increase_quantity: string;
  adjustment_decrease_quantity: string;
};
