/**
 * Movement log explorer with filtering, export, and detail views over recent
 * stock movement history.
 */
import { useEffect, useMemo, useState } from "react";
import GlassDialog from "../../components/GlassDialog";
import {
  listProducts,
  listStockMovements,
  type Product,
  type StockMovement,
} from "../../services/api.service";
import "./inventory-pages.css";

type MovementRow = {
  id: string;
  createdAt: string;
  timestamp: string;
  time: string;
  productImageUrl: string | null;
  productName: string;
  sku: string;
  type: string;
  typeLabel: string;
  quantity: number;
  operatorPrimary: string;
  operatorSecondary: string | null;
  reason: string | null;
};

type MovementTypeFilter = "all" | StockMovement["type"];

const isPositiveMovement = (type: string) =>
  type === "STOCK_IN" || type === "TRANSFER_IN" || type === "ADJUSTMENT_INCREASE";

const isNegativeMovement = (type: string) =>
  type === "STOCK_OUT" || type === "TRANSFER_OUT" || type === "ADJUSTMENT_DECREASE";

const getMovementTone = (type: string) => {
  if (isPositiveMovement(type)) {
    return "success";
  }

  if (isNegativeMovement(type)) {
    return "danger";
  }

  return "warning";
};

/**
 * Renders the movement log table, dialogs, export actions, and detail modal.
 */
export default function MovementLogsPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMovement, setSelectedMovement] = useState<MovementRow | null>(null);
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<MovementTypeFilter>("all");
  const [operatorFilter, setOperatorFilter] = useState("all");

  const loadMovements = async () => {
    setLoading(true);
    try {
      const [movementResponse, productsResponse] = await Promise.all([
        listStockMovements("limit=50&offset=0"),
        listProducts("limit=200"),
      ]);
      setMovements(movementResponse.movements);
      setProducts(productsResponse.products);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load movement logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMovements();
  }, []);

  useEffect(() => {
    if (!error) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setError(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [error]);

  useEffect(() => {
    if (!selectedMovement) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedMovement(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedMovement]);

  const movementRows = useMemo(() => {
    const productMap = new Map(products.map((product) => [product.id, product]));
    return movements.map((m): MovementRow => {
      const date = new Date(m.createdAt);
      const product = productMap.get(m.productId);
      let typeLabel = "Adjustment";
      if (m.type === "STOCK_IN") typeLabel = "Inbound";
      else if (m.type === "STOCK_OUT") typeLabel = "Outbound";
      else if (m.type === "TRANSFER_IN") typeLabel = "Transfer In";
      else if (m.type === "TRANSFER_OUT") typeLabel = "Transfer Out";
      else if (m.type === "ADJUSTMENT_INCREASE") typeLabel = "Adjustment Increase";
      else if (m.type === "ADJUSTMENT_DECREASE") typeLabel = "Adjustment Decrease";

      const operatorPrimary =
        m.actorName?.trim() ||
        (m.actorUsername ? `@${m.actorUsername}` : "") ||
        m.actorEmail?.trim() ||
        (m.actorId ? `User ${m.actorId.slice(0, 8)}` : "Unknown user");

      const operatorSecondary =
        m.actorName?.trim() && m.actorUsername
          ? `@${m.actorUsername}`
          : m.actorName?.trim() && m.actorEmail
            ? m.actorEmail
            : null;

      return {
        id: m.id,
        createdAt: m.createdAt,
        timestamp: date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        time: date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        productImageUrl: product?.imageUrl ?? null,
        productName: m.productName,
        sku: m.sku ? `SKU: ${m.sku}` : "SKU unavailable",
        type: m.type,
        typeLabel,
        quantity: m.quantity,
        operatorPrimary,
        operatorSecondary,
        reason: m.reason?.trim() || null,
      };
    });
  }, [movements, products]);

  const operatorOptions = useMemo(() => {
    const values = Array.from(
      new Set(movementRows.map((row) => row.operatorPrimary).filter(Boolean)),
    );
    return values.sort((left, right) => left.localeCompare(right));
  }, [movementRows]);

  const filteredMovementRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return movementRows.filter((row) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        row.productName.toLowerCase().includes(normalizedSearch) ||
        row.sku.toLowerCase().includes(normalizedSearch) ||
        row.operatorPrimary.toLowerCase().includes(normalizedSearch) ||
        row.typeLabel.toLowerCase().includes(normalizedSearch) ||
        (row.reason?.toLowerCase().includes(normalizedSearch) ?? false);

      const matchesType = typeFilter === "all" || row.type === typeFilter;
      const matchesOperator =
        operatorFilter === "all" || row.operatorPrimary === operatorFilter;

      return matchesSearch && matchesType && matchesOperator;
    });
  }, [movementRows, operatorFilter, searchTerm, typeFilter]);

  const inboundVolume = useMemo(
    () =>
      filteredMovementRows
        .filter((row) => isPositiveMovement(row.type))
        .reduce((sum, row) => sum + row.quantity, 0),
    [filteredMovementRows],
  );

  const outboundVolume = useMemo(
    () =>
      filteredMovementRows
        .filter((row) => isNegativeMovement(row.type))
        .reduce((sum, row) => sum + row.quantity, 0),
    [filteredMovementRows],
  );

  const resetFilters = () => {
    setSearchTerm("");
    setTypeFilter("all");
    setOperatorFilter("all");
  };

  const activeFilterCount = [
    searchTerm.trim().length > 0,
    typeFilter !== "all",
    operatorFilter !== "all",
  ].filter(Boolean).length;

  const filterSummary = useMemo(() => {
    const parts: string[] = [];

    if (searchTerm.trim()) {
      parts.push(`Search: ${searchTerm.trim()}`);
    }

    if (typeFilter !== "all") {
      const sample = movementRows.find((row) => row.type === typeFilter);
      parts.push(`Type: ${sample?.typeLabel ?? typeFilter}`);
    }

    if (operatorFilter !== "all") {
      parts.push(`Operator: ${operatorFilter}`);
    }

    return parts.length > 0 ? parts.join(" | ") : "All movement records";
  }, [movementRows, operatorFilter, searchTerm, typeFilter]);

  const exportRowsToCsv = () => {
    const rows = filteredMovementRows.map((row) => [
      row.timestamp,
      row.time,
      row.productName,
      row.sku.replace(/^SKU:\s*/, ""),
      row.typeLabel,
      row.quantity.toString(),
      row.operatorPrimary,
      row.operatorSecondary ?? "",
      row.reason ?? "",
    ]);

    const csv = [
      [
        "Date",
        "Time",
        "Product",
        "SKU",
        "Movement Type",
        "Quantity",
        "Operator",
        "Secondary Operator",
        "Notes",
      ],
      ...rows,
    ]
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll(`"`, `""`)}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "movement-logs.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    setShowExportDialog(false);
  };

  const exportRowsToPdf = async () => {
    try {
      setExportingPdf(true);
      const [{ pdf }, { default: MovementLogsPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./MovementLogsPdfDocument"),
      ]);

      const blob = await pdf(
        <MovementLogsPdfDocument
          rows={filteredMovementRows}
          generatedAt={new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date())}
          filterSummary={filterSummary}
          inboundVolume={inboundVolume}
          outboundVolume={outboundVolume}
          operatorCount={new Set(filteredMovementRows.map((row) => row.operatorPrimary)).size}
        />,
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "movement-logs.pdf";
      anchor.click();
      URL.revokeObjectURL(url);
      setShowExportDialog(false);
    } catch (pdfError) {
      setError(
        pdfError instanceof Error ? pdfError.message : "Failed to export PDF.",
      );
    } finally {
      setExportingPdf(false);
    }
  };

  const selectedMovementTone = selectedMovement ? getMovementTone(selectedMovement.type) : "warning";

  if (loading && movements.length === 0) {
    return (
      <div className="page-panel">
        <div className="inventory-loading-card">
          <div className="inventory-loading-card__dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <h3>Loading movement logs</h3>
          <p>Collecting the latest movement history for this organization.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-panel movement-logs-container">
      <header className="page-panel__header">
        <div className="page-panel__title-stack">
          <h2>Movement Logs</h2>
          <p>Comprehensive record of all product entries, exits, and internal adjustments.</p>
        </div>
        <div className="page-panel__actions">
          <button className="secondary-btn" type="button" onClick={() => setShowExportDialog(true)}>
            <span className="material-symbols-outlined">download</span>
            Export
          </button>
          <button className="primary-btn" type="button" onClick={() => setShowFilterDialog(true)}>
            <span className="material-symbols-outlined">filter_list</span>
            Filter Logs
            {activeFilterCount > 0 ? (
              <span className="btn-filter__count">{activeFilterCount}</span>
            ) : null}
          </button>
        </div>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-card__label">Total Movements</p>
          <h3 className="stat-card__value">{filteredMovementRows.length}</h3>
          <span className="stat-card__note">Shown in the current view</span>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Inbound Volume</p>
          <h3 className="stat-card__value">{inboundVolume}</h3>
          <span className="stat-card__note">Total units received</span>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Outbound Volume</p>
          <h3 className="stat-card__value">{outboundVolume}</h3>
          <span className="stat-card__note">Total units shipped</span>
        </div>
        <div className="stat-card">
          <p className="stat-card__label">Active Operators</p>
          <h3 className="stat-card__value">{new Set(filteredMovementRows.map((row) => row.operatorPrimary)).size}</h3>
          <span className="stat-card__note">Contributors in the current view</span>
        </div>
      </div>

      <div className="product-table-wrapper">
        <table className="product-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Product / SKU</th>
              <th>Type</th>
              <th style={{ textAlign: "right" }}>Quantity</th>
              <th>Operator</th>
              <th>Notes</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredMovementRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="product-name-stack">
                    <span className="name">{row.timestamp}</span>
                    <span className="category-label">{row.time}</span>
                  </div>
                </td>
                <td>
                  <div className="product-info">
                    <div className="product-image-container">
                      {row.productImageUrl ? (
                        <img
                          src={row.productImageUrl}
                          alt={row.productName}
                          className="product-image-container__image"
                        />
                      ) : (
                        <span className="material-symbols-outlined" style={{ color: "#94a3b8" }}>inventory_2</span>
                      )}
                    </div>
                    <div className="product-name-stack">
                      <span className="name">{row.productName}</span>
                      <span className="category-label">{row.sku}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="status-indicator">
                    <div className={`status-dot-ring status-dot-ring--${getMovementTone(row.type)}`} />
                    <span className={`status-pill-small status-pill-small--${getMovementTone(row.type)}`}>
                      {row.typeLabel}
                    </span>
                  </div>
                </td>
                <td style={{ textAlign: "right" }}>
                  <span className={`text-sm font-bold ${
                    isPositiveMovement(row.type) ? "success-text" :
                    isNegativeMovement(row.type) ? "danger-text" :
                    "warning-text"
                  }`}>
                    {isPositiveMovement(row.type) ? "+" : "-"}{row.quantity}
                  </span>
                </td>
                <td>
                  <div className="product-name-stack">
                    <span className="name">{row.operatorPrimary}</span>
                    {row.operatorSecondary ? (
                      <span className="category-label">{row.operatorSecondary}</span>
                    ) : null}
                  </div>
                </td>
                <td>
                  <span className="text-xs text-slate-500 truncate max-w-[160px] inline-block">
                    {row.reason ?? "-"}
                  </span>
                </td>
                <td>
                  <div className="action-btns-hidden">
                    <button
                      className="btn-table-action"
                      type="button"
                      onClick={() => setSelectedMovement(row)}
                      aria-label={`View details for ${row.productName} movement on ${row.timestamp}`}
                    >
                      <span className="material-symbols-outlined">info</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredMovementRows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "64px", color: "#64748b" }}>
                  No movement logs match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <GlassDialog
        open={showFilterDialog}
        title="Filter Movement Logs"
        message="Refine the list by keyword, movement type, or operator."
        confirmLabel="Apply"
        cancelLabel="Close"
        onConfirm={() => setShowFilterDialog(false)}
        onCancel={() => setShowFilterDialog(false)}
      >
        <div className="movement-logs-filter-grid">
          <label className="movement-logs-filter-field">
            <span>Search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Product, SKU, operator, note"
            />
          </label>
          <label className="movement-logs-filter-field">
            <span>Movement Type</span>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as MovementTypeFilter)}
            >
              <option value="all">All movement types</option>
              <option value="STOCK_IN">Inbound</option>
              <option value="STOCK_OUT">Outbound</option>
              <option value="TRANSFER_IN">Transfer In</option>
              <option value="TRANSFER_OUT">Transfer Out</option>
              <option value="ADJUSTMENT_INCREASE">Adjustment Increase</option>
              <option value="ADJUSTMENT_DECREASE">Adjustment Decrease</option>
            </select>
          </label>
          <label className="movement-logs-filter-field">
            <span>Operator</span>
            <select
              value={operatorFilter}
              onChange={(event) => setOperatorFilter(event.target.value)}
            >
              <option value="all">All operators</option>
              {operatorOptions.map((operator) => (
                <option key={operator} value={operator}>
                  {operator}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="movement-logs-filter-actions">
          <button type="button" className="secondary-btn" onClick={resetFilters}>
            Reset Filters
          </button>
        </div>
      </GlassDialog>

      <GlassDialog
        open={showExportDialog}
        title="Export Movement Logs"
        message="Export the current filtered result set."
        confirmLabel="Export CSV"
        cancelLabel="Close"
        onConfirm={exportRowsToCsv}
        onCancel={() => setShowExportDialog(false)}
      >
        <div className="movement-logs-export-panel">
          <p>{filteredMovementRows.length} records selected for export.</p>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => void exportRowsToPdf()}
            disabled={exportingPdf}
          >
            {exportingPdf ? "Preparing PDF..." : "Export PDF"}
          </button>
        </div>
      </GlassDialog>

      {error && (
        <div className="page-toast-stack">
          <div className="page-toast page-toast--error" role="alert">
            <div className="page-toast__content">
              <strong>Unable to load movement logs</strong>
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

      {selectedMovement ? (
        <div
          className="movement-modal-backdrop"
          role="presentation"
          onClick={() => setSelectedMovement(null)}
        >
          <div
            className={`movement-modal movement-modal--${selectedMovementTone}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="movement-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="movement-modal__header">
              <div className="movement-modal__title">
                <h3 id="movement-detail-title">Movement Details</h3>
                <p>Review the full movement snapshot recorded for this organization.</p>
              </div>
              <button
                type="button"
                className="movement-modal__close"
                onClick={() => setSelectedMovement(null)}
                aria-label="Close movement details"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="movement-modal__body">
              <div className={`movement-modal__hero movement-modal__hero--${selectedMovementTone}`}>
                <div className={`movement-modal__hero-icon movement-modal__hero-icon--${selectedMovementTone}`}>
                  {selectedMovement.productImageUrl ? (
                    <img
                      src={selectedMovement.productImageUrl}
                      alt={selectedMovement.productName}
                      className="movement-modal__hero-image"
                    />
                  ) : (
                    <span className="material-symbols-outlined">inventory_2</span>
                  )}
                </div>
                <div className="movement-modal__hero-copy">
                  <span className="movement-modal__eyebrow">{selectedMovement.typeLabel}</span>
                  <strong>{selectedMovement.productName}</strong>
                  <span>{selectedMovement.sku}</span>
                </div>
                <div className="movement-modal__quantity">
                  <span>Quantity</span>
                  <strong className={`movement-modal__quantity-value movement-modal__quantity-value--${selectedMovementTone}`}>
                    {isPositiveMovement(selectedMovement.type) ? "+" : "-"}
                    {selectedMovement.quantity}
                  </strong>
                </div>
              </div>

              <div className="movement-modal__grid">
                <div className="movement-detail-card">
                  <span className="movement-detail-card__label">Date</span>
                  <strong>{selectedMovement.timestamp}</strong>
                </div>
                <div className="movement-detail-card">
                  <span className="movement-detail-card__label">Time</span>
                  <strong>{selectedMovement.time}</strong>
                </div>
                <div className="movement-detail-card">
                  <span className="movement-detail-card__label">Operator</span>
                  <strong>{selectedMovement.operatorPrimary}</strong>
                  {selectedMovement.operatorSecondary ? (
                    <span>{selectedMovement.operatorSecondary}</span>
                  ) : null}
                </div>
                <div className="movement-detail-card">
                  <span className="movement-detail-card__label">Movement ID</span>
                  <strong>{selectedMovement.id}</strong>
                </div>
              </div>

              <div className="movement-detail-card movement-detail-card--full">
                <span className="movement-detail-card__label">Reason / Notes</span>
                <strong>{selectedMovement.reason ?? "No reason was recorded for this movement."}</strong>
              </div>
            </div>

            <div className="movement-modal__footer">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setSelectedMovement(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
