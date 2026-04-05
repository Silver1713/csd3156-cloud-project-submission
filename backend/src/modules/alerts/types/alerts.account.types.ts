import type { AlertStatus, AlertType } from "./alerts.db.types.js";

export type PublicAlert = {
  id: string;
  ownerId: string;
  productId: string | null;
  productName: string | null;
  productSku: string | null;
  triggeredByMovementId: string | null;
  alertDefinitionId: string | null;
  type: AlertType;
  status: AlertStatus;
  thresholdQuantity: number | null;
  currentQuantity: number | null;
  message: string | null;
  acknowledgedBy: {
    id: string;
    name: string | null;
    username: string | null;
  } | null;
  acknowledgedAt: string | null;
  createdAt: string;
};

export type AlertListResult = {
  alerts: PublicAlert[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
};
