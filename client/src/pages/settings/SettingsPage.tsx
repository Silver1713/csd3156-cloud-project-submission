import { useMemo, useState } from "react";
import GlassDialog from "../../components/GlassDialog";
import {
  deleteMyAccount,
  getMyOrganization,
  listAlerts,
  listInventory,
  listProducts,
  type AlertRecord,
  type InventorySummary,
  type OrganizationSummary,
  type Product,
} from "../../services/api.service";
import "./settings-page.css";

type SettingsSection =
  | "General"
  | "Dashboard"
  | "Alerts & Notifications"
  | "Security"
  | "Data & Export";

type SettingsPageProps = {
  onSignOut?: () => void;
};

type GeneralSettings = {
  landingPage: "Dashboard" | "Products" | "Alerts";
  timezoneMode: "Auto-detect" | "UTC" | "Asia/Singapore";
  compactTables: boolean;
  denseCharts: boolean;
};

type DashboardSettings = {
  defaultMovementRange: "7" | "14" | "30";
  defaultMovementView: "bars" | "line";
  defaultCategoryView: "donut" | "pie";
  pinLowStockCard: boolean;
};

type AlertSettings = {
  inAppToasts: boolean;
  criticalSticky: boolean;
  pollFrequency: "15s" | "30s" | "60s";
  notifyOnRecovered: boolean;
};

type SecuritySettings = {
  restoreSession: boolean;
  requireSensitiveConfirm: boolean;
  rememberWorkspace: boolean;
};

type ExportSettings = {
  defaultExportFormat: "csv" | "pdf";
  includeResolvedAlerts: boolean;
  includeInventoryValue: boolean;
};

type ExportSnapshot = {
  organization: OrganizationSummary;
  inventory: InventorySummary[];
  products: Product[];
  alerts: AlertRecord[];
  exportedAt: string;
};

export default function SettingsPage({ onSignOut }: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("General");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const [general, setGeneral] = useState<GeneralSettings>({
    landingPage: "Dashboard",
    timezoneMode: "Auto-detect",
    compactTables: false,
    denseCharts: false,
  });
  const [dashboard, setDashboard] = useState<DashboardSettings>({
    defaultMovementRange: "14",
    defaultMovementView: "line",
    defaultCategoryView: "donut",
    pinLowStockCard: true,
  });
  const [alerts, setAlerts] = useState<AlertSettings>({
    inAppToasts: true,
    criticalSticky: true,
    pollFrequency: "30s",
    notifyOnRecovered: false,
  });
  const [security, setSecurity] = useState<SecuritySettings>({
    restoreSession: true,
    requireSensitiveConfirm: true,
    rememberWorkspace: true,
  });
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    defaultExportFormat: "csv",
    includeResolvedAlerts: false,
    includeInventoryValue: true,
  });

  const sectionMeta = useMemo(
    () =>
      ({
        General: {
          eyebrow: "Application Preferences",
          title: "General Settings",
          description:
            "Set your default landing page, display density, and everyday application behavior.",
        },
        Dashboard: {
          eyebrow: "Dashboard Preferences",
          title: "Dashboard Settings",
          description:
            "Set default chart modes and dashboard views for daily operations.",
        },
        "Alerts & Notifications": {
          eyebrow: "Notifications",
          title: "Alerts & Notifications",
          description:
            "Control how alerts appear in the app and how often they refresh.",
        },
        Security: {
          eyebrow: "Security",
          title: "Security Settings",
          description:
            "Choose how sessions restore and how the app handles sensitive actions.",
        },
        "Data & Export": {
          eyebrow: "Exports",
          title: "Data & Export",
          description:
            "Choose export defaults and the reporting details included in each export.",
        },
      }) satisfies Record<
        SettingsSection,
        { eyebrow: string; title: string; description: string }
      >,
    [],
  );

  function handleSave(section: SettingsSection) {
    setSaveMessage(`${section} settings saved for this session.`);
    window.setTimeout(() => setSaveMessage(null), 2500);
  }

  function setTimedExportMessage(message: string) {
    setExportMessage(message);
    window.setTimeout(() => setExportMessage(null), 3000);
  }

  async function handleDeleteAccount(): Promise<void> {
    if (isDeletingAccount) {
      return;
    }

    setIsDeletingAccount(true);
    setDeleteError(null);

    try {
      await deleteMyAccount();
      onSignOut?.();
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Failed to delete account",
      );
    } finally {
      setIsDeletingAccount(false);
    }
  }

  function escapeHtml(value: string): string {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function formatTimestamp(value: string): string {
    return new Intl.DateTimeFormat("en-SG", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  }

  function downloadTextFile(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function buildExportSnapshot(): Promise<ExportSnapshot> {
    const alertQuery = new URLSearchParams({
      limit: "200",
      offset: "0",
    });

    if (!exportSettings.includeResolvedAlerts) {
      alertQuery.set("status", "active");
    }

    const [organizationResponse, inventoryResponse, productsResponse, alertsResponse] =
      await Promise.all([
        getMyOrganization(),
        listInventory(),
        listProducts("limit=200&offset=0"),
        listAlerts(alertQuery),
      ]);

    return {
      organization: organizationResponse.organization,
      inventory: inventoryResponse.inventory,
      products: productsResponse.products,
      alerts: alertsResponse.alerts,
      exportedAt: new Date().toISOString(),
    };
  }

  function buildInventoryCsv(snapshot: ExportSnapshot): string {
    const productMap = new Map(snapshot.products.map((product) => [product.id, product]));
    const rows = snapshot.inventory.map((item) => {
      const product = productMap.get(item.productId);
      const baseColumns = [
        snapshot.organization.name ?? "Organization Workspace",
        item.productName,
        item.sku ?? "",
        String(item.quantity),
        String(item.unitCost),
      ];

      const valueColumns = exportSettings.includeInventoryValue
        ? [String(item.valuation)]
        : [];

      return [
        ...baseColumns,
        ...valueColumns,
        product?.productCategoryId ?? "",
        item.updatedAt,
      ];
    });

    const headers = [
      "Organization",
      "Product Name",
      "SKU",
      "Quantity",
      "Unit Cost",
      ...(exportSettings.includeInventoryValue ? ["Inventory Value"] : []),
      "Category Id",
      "Updated At",
    ];

    const alertHeaders = [
      "Alert Name",
      "Type",
      "Status",
      "Product",
      "Threshold",
      "Current",
      "Created At",
      "Message",
    ];
    const alertRows = snapshot.alerts.map((alert) => [
      alert.productName ?? "Organization Alert",
      alert.type,
      alert.status,
      alert.productSku ?? "",
      alert.thresholdQuantity === null ? "" : String(alert.thresholdQuantity),
      alert.currentQuantity === null ? "" : String(alert.currentQuantity),
      alert.createdAt,
      alert.message ?? "",
    ]);

    const encodeRow = (columns: string[]) =>
      columns
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(",");

    return [
      encodeRow(headers),
      ...rows.map(encodeRow),
      "",
      encodeRow(alertHeaders),
      ...alertRows.map(encodeRow),
    ].join("\n");
  }

  function buildPrintableExportHtml(snapshot: ExportSnapshot): string {
    const productMap = new Map(snapshot.products.map((product) => [product.id, product]));
    const inventoryRows = snapshot.inventory
      .map((item) => {
        const product = productMap.get(item.productId);
        return `
          <tr>
            <td>${escapeHtml(item.productName)}</td>
            <td>${escapeHtml(item.sku ?? "-")}</td>
            <td>${item.quantity}</td>
            <td>${item.unitCost.toFixed(2)}</td>
            ${
              exportSettings.includeInventoryValue
                ? `<td>${item.valuation.toFixed(2)}</td>`
                : ""
            }
            <td>${escapeHtml(product?.productCategoryId ?? "-")}</td>
            <td>${escapeHtml(formatTimestamp(item.updatedAt))}</td>
          </tr>
        `;
      })
      .join("");

    const alertRows = snapshot.alerts
      .map(
        (alert) => `
          <tr>
            <td>${escapeHtml(alert.productName ?? "Organization Alert")}</td>
            <td>${escapeHtml(alert.type)}</td>
            <td>${escapeHtml(alert.status)}</td>
            <td>${escapeHtml(alert.thresholdQuantity?.toString() ?? "-")}</td>
            <td>${escapeHtml(alert.currentQuantity?.toString() ?? "-")}</td>
            <td>${escapeHtml(formatTimestamp(alert.createdAt))}</td>
            <td>${escapeHtml(alert.message ?? "-")}</td>
          </tr>
        `,
      )
      .join("");

    const inventoryValueHeader = exportSettings.includeInventoryValue
      ? "<th>Inventory Value</th>"
      : "";

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(snapshot.organization.name ?? "Organization Workspace")} Export</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 32px; color: #1f2937; }
      h1, h2 { margin: 0 0 12px; }
      p { margin: 0 0 8px; }
      .meta { margin-bottom: 24px; color: #6b7280; }
      .section { margin-top: 28px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #d1d5db; padding: 8px 10px; font-size: 12px; text-align: left; vertical-align: top; }
      th { background: #f3f4f6; font-weight: 700; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(snapshot.organization.name ?? "Organization Workspace")}</h1>
    <p class="meta">Exported ${escapeHtml(formatTimestamp(snapshot.exportedAt))}</p>
    <p>Critical threshold: ${snapshot.organization.criticalStockThreshold}</p>
    <p>Low threshold: ${snapshot.organization.lowStockThreshold}</p>

    <section class="section">
      <h2>Inventory Snapshot</h2>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Quantity</th>
            <th>Unit Cost</th>
            ${inventoryValueHeader}
            <th>Category Id</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>${inventoryRows}</tbody>
      </table>
    </section>

    <section class="section">
      <h2>Alerts</h2>
      <table>
        <thead>
          <tr>
            <th>Alert</th>
            <th>Type</th>
            <th>Status</th>
            <th>Threshold</th>
            <th>Current</th>
            <th>Created</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>${alertRows}</tbody>
      </table>
    </section>
  </body>
</html>`;
  }

  async function handleExport(format: "csv" | "pdf") {
    setExporting(format);
    setExportMessage(null);

    try {
      const snapshot = await buildExportSnapshot();
      const safeOrgName = (snapshot.organization.name ?? "organization_workspace")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
      const dateTag = snapshot.exportedAt.slice(0, 10);

      if (format === "csv") {
        const csv = buildInventoryCsv(snapshot);
        downloadTextFile(`${safeOrgName}_snapshot_${dateTag}.csv`, csv, "text/csv;charset=utf-8");
        setTimedExportMessage("CSV export generated.");
        return;
      }

      const exportWindow = window.open("", "_blank", "noopener,noreferrer");
      if (!exportWindow) {
        throw new Error("The browser blocked the print window for PDF export.");
      }

      exportWindow.document.open();
      exportWindow.document.write(buildPrintableExportHtml(snapshot));
      exportWindow.document.close();
      exportWindow.focus();
      exportWindow.print();
      setTimedExportMessage("PDF export opened in a printable report window.");
    } catch (error) {
      setExportMessage(
        error instanceof Error ? error.message : "Failed to export workspace data.",
      );
    } finally {
      setExporting(null);
    }
  }

  return (
    <section className="page-panel settings-page">
      <div className="page-panel__header">
        <div>
          <h2>Settings</h2>
          <p>Configure workspace defaults, notification behavior, and day-to-day product preferences.</p>
        </div>
      </div>

      <section className="settings-shell">
        <aside className="settings-nav" aria-label="Settings sections">
          {(Object.keys(sectionMeta) as SettingsSection[]).map((section) => (
            <button
              key={section}
              type="button"
              className={`settings-nav__item ${activeSection === section ? "is-active" : ""}`}
              onClick={() => setActiveSection(section)}
            >
              {section}
            </button>
          ))}
        </aside>

        <div className="settings-panel">
          <div className="settings-panel__header">
            <p className="settings-panel__eyebrow">{sectionMeta[activeSection].eyebrow}</p>
            <h3>{sectionMeta[activeSection].title}</h3>
            <p>{sectionMeta[activeSection].description}</p>
          </div>

          {activeSection === "General" ? (
            <div className="settings-detail-grid">
              <article className="settings-card settings-card--detail">
                <h4>Workspace Defaults</h4>
                <div className="settings-form">
                  <label className="settings-field">
                    <span>Default Landing Page</span>
                    <select
                      value={general.landingPage}
                      onChange={(event) =>
                        setGeneral((current) => ({
                          ...current,
                          landingPage: event.target.value as GeneralSettings["landingPage"],
                        }))
                      }
                    >
                      <option value="Dashboard">Dashboard</option>
                      <option value="Products">Products</option>
                      <option value="Alerts">Alerts</option>
                    </select>
                  </label>

                  <label className="settings-field">
                    <span>Timezone Mode</span>
                    <select
                      value={general.timezoneMode}
                      onChange={(event) =>
                        setGeneral((current) => ({
                          ...current,
                          timezoneMode: event.target.value as GeneralSettings["timezoneMode"],
                        }))
                      }
                    >
                      <option value="Auto-detect">Auto-detect</option>
                      <option value="UTC">UTC</option>
                      <option value="Asia/Singapore">Asia/Singapore</option>
                    </select>
                  </label>
                </div>
              </article>

              <article className="settings-card settings-card--detail">
                <h4>Interface Density</h4>
                <div className="settings-stack">
                  <label className="settings-switch">
                    <div>
                      <strong>Compact Tables</strong>
                      <span>Reduce row height in product, inventory, and movement tables.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={general.compactTables}
                      onChange={(event) =>
                        setGeneral((current) => ({
                          ...current,
                          compactTables: event.target.checked,
                        }))
                      }
                    />
                  </label>

                  <label className="settings-switch">
                    <div>
                      <strong>Dense Charts</strong>
                      <span>Prefer tighter chart spacing when viewing analytics-heavy pages.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={general.denseCharts}
                      onChange={(event) =>
                        setGeneral((current) => ({
                          ...current,
                          denseCharts: event.target.checked,
                        }))
                      }
                    />
                  </label>
                </div>
              </article>
            </div>
          ) : null}

          {activeSection === "Dashboard" ? (
            <div className="settings-detail-grid">
              <article className="settings-card settings-card--detail">
                <h4>Chart Defaults</h4>
                <div className="settings-form">
                  <label className="settings-field">
                    <span>Default Movement Range</span>
                    <select
                      value={dashboard.defaultMovementRange}
                      onChange={(event) =>
                        setDashboard((current) => ({
                          ...current,
                          defaultMovementRange: event.target.value as DashboardSettings["defaultMovementRange"],
                        }))
                      }
                    >
                      <option value="7">7 Days</option>
                      <option value="14">14 Days</option>
                      <option value="30">30 Days</option>
                    </select>
                  </label>

                  <label className="settings-field">
                    <span>Default Movement View</span>
                    <select
                      value={dashboard.defaultMovementView}
                      onChange={(event) =>
                        setDashboard((current) => ({
                          ...current,
                          defaultMovementView: event.target.value as DashboardSettings["defaultMovementView"],
                        }))
                      }
                    >
                      <option value="bars">Bars</option>
                      <option value="line">Line</option>
                    </select>
                  </label>

                  <label className="settings-field">
                    <span>Default Category View</span>
                    <select
                      value={dashboard.defaultCategoryView}
                      onChange={(event) =>
                        setDashboard((current) => ({
                          ...current,
                          defaultCategoryView: event.target.value as DashboardSettings["defaultCategoryView"],
                        }))
                      }
                    >
                      <option value="donut">Donut</option>
                      <option value="pie">Pie</option>
                    </select>
                  </label>
                </div>
              </article>

              <article className="settings-card settings-card--detail">
                <h4>Analytics Emphasis</h4>
                <div className="settings-stack">
                  <label className="settings-switch">
                    <div>
                      <strong>Pin Low Stock Card</strong>
                      <span>Keep stock health summaries visible above deeper dashboard panels.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={dashboard.pinLowStockCard}
                      onChange={(event) =>
                        setDashboard((current) => ({
                          ...current,
                          pinLowStockCard: event.target.checked,
                        }))
                      }
                    />
                  </label>
                </div>
              </article>
            </div>
          ) : null}

          {activeSection === "Alerts & Notifications" ? (
            <div className="settings-detail-grid">
              <article className="settings-card settings-card--detail">
                <h4>In-App Alerts</h4>
                <div className="settings-stack">
                  <label className="settings-switch">
                    <div>
                      <strong>Enable In-App Toasts</strong>
                      <span>Show new active alerts in the floating glass notification stack.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={alerts.inAppToasts}
                      onChange={(event) =>
                        setAlerts((current) => ({
                          ...current,
                          inAppToasts: event.target.checked,
                        }))
                      }
                    />
                  </label>

                  <label className="settings-switch">
                    <div>
                      <strong>Sticky Critical Alerts</strong>
                      <span>Keep critical alerts visible until manually dismissed.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={alerts.criticalSticky}
                      onChange={(event) =>
                        setAlerts((current) => ({
                          ...current,
                          criticalSticky: event.target.checked,
                        }))
                      }
                    />
                  </label>

                  <label className="settings-switch">
                    <div>
                      <strong>Notify When Recovered</strong>
                      <span>Surface a small notice when a previously triggered condition clears.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={alerts.notifyOnRecovered}
                      onChange={(event) =>
                        setAlerts((current) => ({
                          ...current,
                          notifyOnRecovered: event.target.checked,
                        }))
                      }
                    />
                  </label>
                </div>
              </article>

              <article className="settings-card settings-card--detail">
                <h4>Polling</h4>
                <div className="settings-form">
                  <label className="settings-field">
                    <span>Alert Poll Frequency</span>
                    <select
                      value={alerts.pollFrequency}
                      onChange={(event) =>
                        setAlerts((current) => ({
                          ...current,
                          pollFrequency: event.target.value as AlertSettings["pollFrequency"],
                        }))
                      }
                    >
                      <option value="15s">15 seconds</option>
                      <option value="30s">30 seconds</option>
                      <option value="60s">60 seconds</option>
                    </select>
                  </label>
                </div>
              </article>
            </div>
          ) : null}

          {activeSection === "Security" ? (
            <div className="settings-detail-grid">
              <article className="settings-card settings-card--detail">
                <h4>Session Controls</h4>
                <div className="settings-stack">
                  <label className="settings-switch">
                    <div>
                      <strong>Restore Session Automatically</strong>
                      <span>Attempt to restore the last authenticated session on page refresh.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={security.restoreSession}
                      onChange={(event) =>
                        setSecurity((current) => ({
                          ...current,
                          restoreSession: event.target.checked,
                        }))
                      }
                    />
                  </label>

                  <label className="settings-switch">
                    <div>
                      <strong>Confirm Sensitive Actions</strong>
                      <span>Require explicit confirmation before destructive workflow steps.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={security.requireSensitiveConfirm}
                      onChange={(event) =>
                        setSecurity((current) => ({
                          ...current,
                          requireSensitiveConfirm: event.target.checked,
                        }))
                      }
                    />
                  </label>

                  <label className="settings-switch">
                    <div>
                      <strong>Remember Last Workspace Context</strong>
                      <span>Re-open the last section you were using after sign-in.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={security.rememberWorkspace}
                      onChange={(event) =>
                        setSecurity((current) => ({
                          ...current,
                          rememberWorkspace: event.target.checked,
                        }))
                      }
                    />
                  </label>
                </div>
              </article>

              <article className="settings-card settings-card--detail">
                <h4>Identity Provider Status</h4>
                <div className="settings-status-list">
                  <div>
                    <strong>Cognito Session</strong>
                    <span>Managed in the active profile and auth resolve flow.</span>
                  </div>
                  <div>
                    <strong>Password & MFA</strong>
                    <span>Reserved for future backend-connected account security controls.</span>
                  </div>
                </div>
              </article>
            </div>
          ) : null}

          {activeSection === "Data & Export" ? (
            <div className="settings-detail-grid">
              <article className="settings-card settings-card--detail">
                <h4>Export Defaults</h4>
                <div className="settings-form">
                  <label className="settings-field">
                    <span>Default Export Format</span>
                    <select
                      value={exportSettings.defaultExportFormat}
                      onChange={(event) =>
                        setExportSettings((current) => ({
                          ...current,
                          defaultExportFormat: event.target.value as ExportSettings["defaultExportFormat"],
                        }))
                      }
                    >
                      <option value="csv">CSV</option>
                      <option value="pdf">PDF</option>
                    </select>
                  </label>
                </div>
              </article>

              <article className="settings-card settings-card--detail">
                <h4>Included Data</h4>
                <div className="settings-stack">
                  <label className="settings-switch">
                    <div>
                      <strong>Include Resolved Alerts</strong>
                      <span>Keep resolved incidents in exported alert datasets by default.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={exportSettings.includeResolvedAlerts}
                      onChange={(event) =>
                        setExportSettings((current) => ({
                          ...current,
                          includeResolvedAlerts: event.target.checked,
                        }))
                      }
                    />
                  </label>

                  <label className="settings-switch">
                    <div>
                      <strong>Include Inventory Valuation</strong>
                      <span>Attach inventory value columns when exporting inventory summaries.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={exportSettings.includeInventoryValue}
                      onChange={(event) =>
                        setExportSettings((current) => ({
                          ...current,
                          includeInventoryValue: event.target.checked,
                        }))
                      }
                    />
                  </label>
                </div>
              </article>

              <article className="settings-card settings-card--detail">
                <h4>Export Actions</h4>
                <div className="settings-stack">
                  <div className="settings-export-actions">
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => void handleExport("csv")}
                      disabled={exporting !== null}
                    >
                      {exporting === "csv" ? "Exporting CSV..." : "Export CSV"}
                    </button>
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() => void handleExport("pdf")}
                      disabled={exporting !== null}
                    >
                      {exporting === "pdf" ? "Preparing PDF..." : "Export PDF"}
                    </button>
                  </div>
                  <p className="settings-export-note">
                    Export uses live client-side data from organization, inventory, product,
                    and alert endpoints. PDF opens a print-ready report window.
                  </p>
                </div>
              </article>
            </div>
          ) : null}

          <div className="settings-panel__actions settings-panel__actions--split">
            <div className="settings-page__save-state">
              {deleteError ? (
                <p>{deleteError}</p>
              ) : saveMessage ? (
                <p>{saveMessage}</p>
              ) : exportMessage ? (
                <p>{exportMessage}</p>
              ) : (
                <p>These settings are currently client-side only.</p>
              )}
            </div>

            <div className="settings-page__action-group">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => handleSave(activeSection)}
              >
                Save Section
              </button>
              <button
                type="button"
                className="settings-panel__danger"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isDeletingAccount}
              >
                {isDeletingAccount ? "Deleting Account..." : "Delete Account"}
              </button>
              <button type="button" className="settings-panel__danger" onClick={onSignOut}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </section>

      <GlassDialog
        open={showDeleteDialog}
        title="Delete Account"
        message="Delete your account? This action is permanent. If you are the only member, the organization will be deleted too."
        confirmLabel={isDeletingAccount ? "Deleting Account..." : "Delete Account"}
        tone="danger"
        busy={isDeletingAccount}
        onConfirm={() => void handleDeleteAccount()}
        onCancel={() => {
          if (!isDeletingAccount) {
            setShowDeleteDialog(false);
          }
        }}
      />
    </section>
  );
}
