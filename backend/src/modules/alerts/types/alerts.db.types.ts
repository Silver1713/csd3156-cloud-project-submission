export type AlertStatus = "active" | "acknowledged" | "resolved";

export type AlertType = "low_stock" | "critical_stock" | "custom";

export type AlertRow = {
  id: string;
  owner_id: string;
  product_id: string | null;
  triggered_by_movement_id: string | null;
  alert_definition_id: string | null;
  type: AlertType;
  status: AlertStatus;
  threshold_quantity: number | null;
  current_quantity: number | null;
  message: string | null;
  acknowledged_by: string | null;
  acknowledged_at: Date | null;
  created_at: Date;
  product_name: string | null;
  product_sku: string | null;
  acknowledged_by_name: string | null;
  acknowledged_by_username: string | null;
};

export type AlertListQuery = {
  ownerId: string;
  status?: AlertStatus;
  type?: AlertType;
  productId?: string;
  limit: number;
  offset: number;
};
