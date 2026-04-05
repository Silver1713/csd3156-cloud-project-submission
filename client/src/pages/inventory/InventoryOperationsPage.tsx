import { useEffect, useMemo, useState } from "react";
import {
  createStockMovement,
  listInventory,
  listProducts,
  type InventorySummary,
  type Product,
  type StockMovement,
} from "../../services/api.service";
import "./inventory-pages.css";

type OperationType =
  | "STOCK_IN"
  | "STOCK_OUT"
  | "TRANSFER_IN"
  | "TRANSFER_OUT";

const operationOptions: Array<{
  type: OperationType;
  label: string;
  icon: string;
  tone: "success" | "danger" | "warning";
}> = [
  {
    type: "STOCK_IN",
    label: "Receive Stock",
    icon: "download",
    tone: "success",
  },
  {
    type: "STOCK_OUT",
    label: "Release Stock",
    icon: "upload",
    tone: "danger",
  },
  {
    type: "TRANSFER_IN",
    label: "Transfer In",
    icon: "south_west",
    tone: "success",
  },
  {
    type: "TRANSFER_OUT",
    label: "Transfer Out",
    icon: "north_east",
    tone: "warning",
  },
];

function isInboundOperation(type: OperationType): boolean {
  return type === "STOCK_IN" || type === "TRANSFER_IN";
}

function toneStyles(
  active: boolean,
  tone: "success" | "danger" | "warning",
): Record<string, string> {
  if (!active) {
    return {};
  }

  if (tone === "success") {
    return {
      background: "#f2f7f4",
      color: "#0f6b54",
      boxShadow: "inset 0 0 0 2px #0f6b54",
      justifyContent: "flex-start",
    };
  }

  if (tone === "danger") {
    return {
      background: "#fff1f0",
      color: "#c93c2c",
      boxShadow: "inset 0 0 0 2px #c93c2c",
      justifyContent: "flex-start",
    };
  }

  return {
    background: "#fff8ef",
    color: "#b26d13",
    boxShadow: "inset 0 0 0 2px #d08319",
    justifyContent: "flex-start",
  };
}

export default function InventoryOperationsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [operationType, setOperationType] = useState<OperationType>("STOCK_IN");
  const [quantity, setQuantity] = useState(1);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, invRes] = await Promise.all([
        listProducts("limit=200"),
        listInventory(),
      ]);
      setProducts(prodRes.products);
      setInventory(invRes.inventory);

      if (prodRes.products.length > 0 && !selectedProductId) {
        setSelectedProductId(prodRes.products[0].id);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load operations data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!error && !success) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setError(null);
      setSuccess(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [error, success]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId),
    [products, selectedProductId],
  );

  const currentInventory = useMemo(
    () => inventory.find((item) => item.productId === selectedProductId),
    [inventory, selectedProductId],
  );

  const currentLevel = currentInventory?.quantity ?? 0;
  const isInbound = isInboundOperation(operationType);
  const projectedLevel = isInbound
    ? currentLevel + quantity
    : Math.max(0, currentLevel - quantity);

  const activeOperation = operationOptions.find(
    (option) => option.type === operationType,
  );

  const handleSubmit = async () => {
    if (!selectedProductId) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await createStockMovement({
        productId: selectedProductId,
        type: operationType,
        quantity: Number(quantity),
      });

      setSuccess(
        `${activeOperation?.label ?? "Inventory operation"} recorded for ${selectedProduct?.name}`,
      );
      setQuantity(1);
      void loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit inventory operation",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && products.length === 0) {
    return (
      <div className="page-panel">
        <div className="inventory-loading-card">
          <div className="inventory-loading-card__dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <h3>Loading inventory operations</h3>
          <p>Syncing product options and stock balances for operational movement entry.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-panel inventory-adjustment-container">
      <header className="page-panel__header">
        <div className="page-panel__title-stack">
          <h2>Inventory Operations</h2>
          <p>
            Record stock receipt, release, and transfer activity using the operational
            movement workflow.
          </p>
        </div>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-card__label">Selected Item</p>
          <h3
            className="stat-card__value"
            style={{
              fontSize: "1.25rem",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {selectedProduct?.name || "Select a product"}
          </h3>
          <span className="stat-card__note">SKU: {selectedProduct?.sku || "N/A"}</span>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Current Balance</p>
          <h3 className="stat-card__value">{currentLevel}</h3>
          <span className="stat-card__note">Units on hand</span>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Operation Delta</p>
          <h3
            className={`stat-card__value ${
              isInbound ? "success-text" : "warning-text"
            }`}
          >
            {isInbound ? "+" : "-"}
            {quantity}
          </h3>
          <span className="stat-card__note">{activeOperation?.label ?? "Select operation"}</span>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Projected Balance</p>
          <h3 className="stat-card__value" style={{ color: "#4a52d1" }}>
            {projectedLevel}
          </h3>
          <span className="stat-card__note">After submission</span>
        </div>
      </div>

      <div className="dashboard-insights-grid">
        <div className="movement-chart-card">
          <div className="modal-form" style={{ padding: 0 }}>
            <div className="form-group">
              <label className="form-label">Product</label>
              <select
                className="form-select"
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
              >
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} (SKU: {product.sku || "N/A"})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Operation Type</label>
              <div className="grid grid-cols-2 gap-2">
                {operationOptions.map((option) => {
                  const isActive = option.type === operationType;

                  return (
                    <button
                      key={option.type}
                      className={`secondary-btn text-xs px-2 min-h-[40px] ${
                        isActive ? "is-active" : ""
                      }`}
                      onClick={() => setOperationType(option.type)}
                      style={toneStyles(isActive, option.tone)}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {option.icon}
                      </span>
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input
                type="number"
                className="form-input"
                min="1"
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
              />
            </div>

            <div style={{ marginTop: "12px" }}>
              <button
                className="primary-btn w-full"
                onClick={handleSubmit}
                disabled={submitting || !selectedProductId}
              >
                <span className="material-symbols-outlined">published_with_changes</span>
                {submitting ? "Processing..." : "Record Operation"}
              </button>
            </div>
          </div>
        </div>

        <div className="category-breakdown-card">
          <div
            className="report-card-indigo"
            style={{ height: "100%", margin: 0, padding: "24px" }}
          >
            <h4>Operational Guidance</h4>
            <p style={{ fontSize: "0.8rem", color: "#c7d2fe" }}>
              Use stock and transfer operations for normal warehouse activity. Manual
              reconciliation belongs in Inventory Adjustment.
            </p>
            <div style={{ marginTop: "auto" }}>
              <div
                className="insight-banner__icon"
                style={{ background: "rgba(255,255,255,0.1)", color: "white" }}
              >
                <span className="material-symbols-outlined">inventory</span>
              </div>
            </div>
            <span className="material-symbols-outlined bg-icon">warehouse</span>
          </div>
        </div>
      </div>

      {error ? (
        <div className="page-toast-stack">
          <div className="page-toast page-toast--error" role="alert">
            <div className="page-toast__content">
              <strong>Unable to record operation</strong>
              <span>{error}</span>
            </div>
            <button
              type="button"
              className="page-toast__dismiss"
              onClick={() => setError(null)}
              aria-label="Dismiss message"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="page-toast__progress" aria-hidden="true" />
          </div>
        </div>
      ) : null}
      {success ? (
        <div className="page-toast-stack">
          <div className="page-toast page-toast--success" role="status">
            <div className="page-toast__content">
              <strong>Operation recorded</strong>
              <span>{success}</span>
            </div>
            <button
              type="button"
              className="page-toast__dismiss"
              onClick={() => setSuccess(null)}
              aria-label="Dismiss message"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="page-toast__progress" aria-hidden="true" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
