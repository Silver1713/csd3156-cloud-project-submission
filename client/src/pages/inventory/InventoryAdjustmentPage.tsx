import { useEffect, useState, useMemo } from "react";
import {
  listProducts,
  listInventory,
  createInventoryAdjustment,
  type Product,
  type InventorySummary,
} from "../../services/api.service";
import "./inventory-pages.css";

export default function InventoryAdjustmentPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [selectedProductId, setSelectedProductId] = useState("");
  const [adjustmentDirection, setAdjustmentDirection] = useState<
    "increase" | "decrease"
  >("increase");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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

  const selectedProduct = useMemo(() => 
    products.find(p => p.id === selectedProductId), 
    [products, selectedProductId]
  );

  const currentInventory = useMemo(() => 
    inventory.find(i => i.productId === selectedProductId),
    [inventory, selectedProductId]
  );

  const isIncrease = adjustmentDirection === "increase";
  const trimmedReason = reason.trim();

  const currentLevel = currentInventory?.quantity || 0;
  const newLevel = isIncrease ? currentLevel + quantity : Math.max(0, currentLevel - quantity);

  const handleSubmit = async () => {
    if (!selectedProductId || trimmedReason.length === 0) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await createInventoryAdjustment({
        productId: selectedProductId,
        direction: adjustmentDirection,
        quantity: Number(quantity),
        reason: trimmedReason,
      });
      
      setSuccess(`Successfully adjusted stock for ${selectedProduct?.name}`);
      setQuantity(1);
      setReason("");
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit adjustment");
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
          <h3>Loading inventory details</h3>
          <p>Preparing adjustment controls and current stock balance.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-panel inventory-adjustment-container">
      <header className="page-panel__header">
        <div className="page-panel__title-stack">
          <h2>Inventory Adjustment</h2>
          <p>Modify stock levels manually for shrinkage, restock, or quality control corrections.</p>
        </div>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-card__label">Selected Item</p>
          <h3 className="stat-card__value" style={{ fontSize: "1.25rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
          <p className="stat-card__label">Adjustment</p>
          <h3 className={`stat-card__value ${isIncrease ? "success-text" : "danger-text"}`}>
            {isIncrease ? "+" : "-"}{quantity}
          </h3>
          <span className="stat-card__note">{isIncrease ? "Adjustment Increase" : "Adjustment Decrease"}</span>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">New Balance</p>
          <h3 className="stat-card__value" style={{ color: "#4a52d1" }}>{newLevel}</h3>
          <span className="stat-card__note">After submission</span>
        </div>
      </div>

      <div className="dashboard-insights-grid">
        <div className="movement-chart-card">
          <div className="modal-form" style={{ padding: 0 }}>
            <div className="form-group">
              <label className="form-label">Product to Adjust</label>
              <select 
                className="form-select"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} (SKU: {p.sku || "N/A"})</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Adjustment Direction</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={`secondary-btn text-xs px-2 min-h-[40px] ${isIncrease ? "is-active" : ""}`}
                  onClick={() => setAdjustmentDirection("increase")}
                  style={{
                    background: isIncrease ? "#f2f7f4" : "",
                    color: isIncrease ? "#0f6b54" : "",
                    boxShadow: isIncrease ? "inset 0 0 0 2px #0f6b54" : "",
                    justifyContent: "flex-start",
                  }}
                >
                  <span className="material-symbols-outlined text-sm">
                    add_circle
                  </span>
                  Increase Stock
                </button>
                <button
                  className={`secondary-btn text-xs px-2 min-h-[40px] ${!isIncrease ? "is-active" : ""}`}
                  onClick={() => setAdjustmentDirection("decrease")}
                  style={{
                    background: !isIncrease ? "#fff1f0" : "",
                    color: !isIncrease ? "#c93c2c" : "",
                    boxShadow: !isIncrease ? "inset 0 0 0 2px #c93c2c" : "",
                    justifyContent: "flex-start",
                  }}
                >
                  <span className="material-symbols-outlined text-sm">
                    remove_circle
                  </span>
                  Decrease Stock
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input 
                type="number" 
                className="form-input"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Adjustment Reason</label>
              <textarea 
                className="form-textarea"
                placeholder="e.g., Annual stock take correction, damaged goods, or restock..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div style={{ marginTop: "12px" }}>
              <button 
                className="primary-btn w-full"
                onClick={handleSubmit}
                disabled={submitting || !selectedProductId || trimmedReason.length === 0}
              >
                <span className="material-symbols-outlined">check_circle</span>
                {submitting ? "Processing..." : "Commit Adjustment"}
              </button>
            </div>
          </div>
        </div>

        <div className="category-breakdown-card">
          <div className="report-card-indigo" style={{ height: "100%", margin: 0, padding: "24px" }}>
            <h4>Compliance Note</h4>
            <p style={{ fontSize: "0.8rem", color: "#c7d2fe" }}>
              Manual adjustments bypass standard procurement workflows. All changes are logged with your user ID for audit compliance.
            </p>
            <div style={{ marginTop: "auto" }}>
              <div className="insight-banner__icon" style={{ background: "rgba(255,255,255,0.1)", color: "white" }}>
                <span className="material-symbols-outlined">gavel</span>
              </div>
            </div>
            <span className="material-symbols-outlined bg-icon">history_edu</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="page-toast-stack">
          <div className="page-toast page-toast--error" role="alert">
            <div className="page-toast__content">
              <strong>Unable to complete adjustment</strong>
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
      )}
      {success && (
        <div className="page-toast-stack">
          <div className="page-toast page-toast--success" role="status">
            <div className="page-toast__content">
              <strong>Adjustment recorded</strong>
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
      )}
    </div>
  );
}
