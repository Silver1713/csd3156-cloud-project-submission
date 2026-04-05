import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  createAlertDefinition,
  deleteAlert,
  deleteAlertDefinition,
  getBaseMetricCatalog,
  listAlertDefinitions,
  listAlerts,
  listCategories,
  listMetricDefinitions,
  listProducts,
  previewAlertDefinition,
  updateAlert,
  updateAlertDefinition,
  type AlertConditionNode,
  type AlertDefinition,
  type AlertRecord,
  type BaseMetricCatalogEntry,
  type Category,
  type MetricDefinition,
  type Product,
} from "../../services/api.service";
import "./alerts-page.css";

type AlertSeverity = "high" | "medium" | "low";
type AlertScope = "organization" | "product" | "category";
type AlertComparator = "gt" | "gte" | "lt" | "lte" | "eq" | "neq";
type MetricSource = "base" | "definition";
type AlertStatusFilter = "all" | "active" | "acknowledged" | "resolved";

type AlertFormState = {
  id: string | null;
  key: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  scope: AlertScope;
  isActive: boolean;
  source: MetricSource;
  metricKey: string;
  comparator: AlertComparator;
  threshold: string;
};

type BuilderNodeData = {
  title: string;
  subtitle?: string;
  content: ReactNode;
};

const DEFAULT_FORM_STATE: AlertFormState = {
  id: null,
  key: "",
  name: "",
  description: "",
  severity: "medium",
  scope: "organization",
  isActive: true,
  source: "base",
  metricKey: "",
  comparator: "lt",
  threshold: "",
};

const COMPARATOR_LABELS: Record<AlertComparator, string> = {
  gt: "Greater than",
  gte: "Greater than or equal",
  lt: "Less than",
  lte: "Less than or equal",
  eq: "Equal to",
  neq: "Not equal to",
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/__+/g, "_");
}

function relTime(value: string): string {
  const diff = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
}

function toTitle(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function definitionSeverity(
  alert: AlertRecord,
  definitionsById: Map<string, AlertDefinition>,
): AlertSeverity {
  const linked = alert.alertDefinitionId ? definitionsById.get(alert.alertDefinitionId) : null;
  if (linked) return linked.severity;
  if (alert.type === "critical_stock") return "high";
  if (alert.type === "low_stock") return "medium";
  return "low";
}

function parseCondition(definition: AlertDefinition) {
  const condition = definition.condition as AlertConditionNode;
  if (
    condition.kind === "comparison" &&
    condition.left.kind === "metric" &&
    condition.right.kind === "number"
  ) {
    return {
      source: condition.left.source,
      metricKey: condition.left.key,
      comparator: condition.operator,
      threshold: String(condition.right.value),
    };
  }
  return null;
}

function buildCondition(state: AlertFormState): AlertConditionNode {
  return {
    kind: "comparison",
    operator: state.comparator,
    left: { kind: "metric", source: state.source, key: state.metricKey },
    right: { kind: "number", value: Number(state.threshold) },
  };
}

function BuilderNode({ data }: NodeProps<Node<BuilderNodeData>>) {
  return (
    <div className="alerts-flow-node">
      <Handle type="target" position={Position.Left} className="alerts-flow-node__handle" />
      <div className="alerts-flow-node__header">
        <strong>{data.title}</strong>
        {data.subtitle ? <span>{data.subtitle}</span> : null}
      </div>
      <div className="alerts-flow-node__body">{data.content}</div>
      <Handle type="source" position={Position.Right} className="alerts-flow-node__handle" />
    </div>
  );
}

const nodeTypes = {
  builder: BuilderNode,
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [definitions, setDefinitions] = useState<AlertDefinition[]>([]);
  const [baseMetrics, setBaseMetrics] = useState<BaseMetricCatalogEntry[]>([]);
  const [customMetrics, setCustomMetrics] = useState<MetricDefinition[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [statusFilter, setStatusFilter] = useState<AlertStatusFilter>("all");
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<{ triggered: boolean | null; currentValue: number | null; reason?: string } | null>(null);
  const [form, setForm] = useState<AlertFormState>(DEFAULT_FORM_STATE);

  const definitionsById = useMemo(
    () => new Map(definitions.map((definition) => [definition.id, definition])),
    [definitions],
  );

  const metricOptions = useMemo(
    () =>
      form.source === "base"
        ? baseMetrics.map((metric) => ({
            key: metric.key,
            label: metric.name,
            description: metric.description,
          }))
        : customMetrics.filter((metric) => metric.isActive).map((metric) => ({
            key: metric.key,
            label: metric.name,
            description: metric.description ?? "Custom metric definition",
          })),
    [baseMetrics, customMetrics, form.source],
  );

  const visibleAlerts = useMemo(
    () =>
      statusFilter === "all"
        ? alerts
        : alerts.filter((alert) => alert.status === statusFilter),
    [alerts, statusFilter],
  );
  const previewAlerts = useMemo(() => visibleAlerts.slice(0, 5), [visibleAlerts]);

  async function loadPage() {
    setLoading(true);
    setError(null);
    try {
      const [alertsRes, definitionsRes, baseRes, customRes, productsRes, categoriesRes] =
        await Promise.all([
          listAlerts(),
          listAlertDefinitions(),
          getBaseMetricCatalog(),
          listMetricDefinitions(),
          listProducts(),
          listCategories(),
        ]);
      setAlerts(alertsRes.alerts);
      setDefinitions(definitionsRes.alertDefinitions);
      setBaseMetrics(baseRes.metrics);
      setCustomMetrics(customRes.metrics);
      setProducts(productsRes.products);
      setCategories(categoriesRes.categories);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load alerts.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage();
  }, []);

  function resetModal() {
    setShowModal(false);
    setForm(DEFAULT_FORM_STATE);
    setFormError(null);
    setFormSuccess(null);
    setPreviewState(null);
  }

  function openCreate() {
    setForm({
      ...DEFAULT_FORM_STATE,
      metricKey: baseMetrics[0]?.key ?? "",
    });
    setShowModal(true);
    setFormError(null);
    setFormSuccess(null);
    setPreviewState(null);
  }

  function openEdit(definition: AlertDefinition) {
    const parsed = parseCondition(definition);
    setForm({
      id: definition.id,
      key: definition.key,
      name: definition.name,
      description: definition.description ?? "",
      severity: definition.severity,
      scope: definition.scope,
      isActive: definition.isActive,
      source: parsed?.source ?? "base",
      metricKey: parsed?.metricKey ?? "",
      comparator: parsed?.comparator ?? "lt",
      threshold: parsed?.threshold ?? "",
    });
    setShowModal(true);
    setFormError(null);
    setFormSuccess(null);
    setPreviewState(null);
  }

  async function handleDismissAlert(alertId: string) {
    try {
      await deleteAlert(alertId);
      setAlerts((current) => current.filter((alert) => alert.id !== alertId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to dismiss alert.");
    }
  }

  async function handleStatusUpdate(alertId: string, status: "resolved") {
    try {
      const payload = await updateAlert(alertId, { status });
      setAlerts((current) =>
        current.map((alert) => (alert.id === alertId ? payload.alert : alert)),
      );
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update alert.");
    }
  }

  async function handlePreview() {
    if (!form.metricKey || !form.threshold.trim()) {
      setFormError("Select a metric and threshold before previewing.");
      return;
    }
    setPreviewing(true);
    setFormError(null);
    try {
      const result = await previewAlertDefinition({
        scope: form.scope,
        condition: buildCondition(form),
      });
      const currentValue =
        form.source === "base"
          ? result.baseMetrics[form.metricKey] ?? null
          : result.customMetrics[form.metricKey] ?? null;
      setPreviewState({
        triggered: result.preview.triggered,
        currentValue,
        reason: result.preview.reason,
      });
    } catch (previewError) {
      setFormError(previewError instanceof Error ? previewError.message : "Failed to preview.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) return setFormError("Alert name is required.");
    if (!form.metricKey) return setFormError("Choose a metric.");
    if (!form.threshold.trim() || Number.isNaN(Number(form.threshold))) {
      return setFormError("Threshold must be a number.");
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const condition = buildCondition(form);
      if (form.id) {
        const result = await updateAlertDefinition(form.id, {
          name: form.name.trim(),
          description: form.description.trim() || null,
          severity: form.severity,
          scope: form.scope,
          condition,
          isActive: form.isActive,
        });
        setDefinitions((current) =>
          current.map((entry) =>
            entry.id === result.alertDefinition.id ? result.alertDefinition : entry,
          ),
        );
        setFormSuccess("Alert definition updated.");
      } else {
        const result = await createAlertDefinition({
          key: slugify(form.key || form.name),
          name: form.name.trim(),
          description: form.description.trim() || null,
          severity: form.severity,
          scope: form.scope,
          condition,
        });
        setDefinitions((current) => [result.alertDefinition, ...current]);
        setFormSuccess("Alert definition created.");
        setForm((current) => ({
          ...DEFAULT_FORM_STATE,
          metricKey: current.source === "base" ? baseMetrics[0]?.key ?? "" : "",
        }));
      }
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Failed to save definition.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(definitionId: string) {
    try {
      await deleteAlertDefinition(definitionId);
      setDefinitions((current) => current.filter((entry) => entry.id !== definitionId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete definition.");
    }
  }

  const metricDescription =
    metricOptions.find((option) => option.key === form.metricKey)?.description ?? null;

  const builderNodes = useMemo<Node<BuilderNodeData>[]>(
    () => [
      {
        id: "metric",
        type: "builder",
        position: { x: 0, y: 60 },
        dragHandle: ".alerts-flow-node__header",
        data: {
          title: "Metric Source",
          subtitle: "Choose a base or custom metric",
          content: (
            <div className="alerts-flow-node__form">
              <label className="alerts-flow-node__field">
                <span>Source</span>
                <select
                  value={form.source}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      source: event.target.value as MetricSource,
                      metricKey:
                        event.target.value === "base"
                          ? baseMetrics[0]?.key ?? ""
                          : customMetrics.find((metric) => metric.isActive)?.key ?? "",
                    }))
                  }
                >
                  <option value="base">Base metric</option>
                  <option
                    value="definition"
                    disabled={customMetrics.filter((metric) => metric.isActive).length === 0}
                  >
                    Custom metric
                  </option>
                </select>
              </label>
              <label className="alerts-flow-node__field">
                <span>Metric</span>
                <select
                  value={form.metricKey}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      metricKey: event.target.value,
                    }))
                  }
                >
                  <option value="">Select a metric</option>
                  {metricOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ),
        },
      },
      {
        id: "operator",
        type: "builder",
        position: { x: 320, y: 60 },
        dragHandle: ".alerts-flow-node__header",
        data: {
          title: "Comparator",
          subtitle: "How the metric should be tested",
          content: (
            <div className="alerts-flow-node__form">
              <label className="alerts-flow-node__field">
                <span>Comparator</span>
                <select
                  value={form.comparator}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      comparator: event.target.value as AlertComparator,
                    }))
                  }
                >
                  {Object.entries(COMPARATOR_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ),
        },
      },
      {
        id: "threshold",
        type: "builder",
        position: { x: 620, y: 60 },
        dragHandle: ".alerts-flow-node__header",
        data: {
          title: "Threshold",
          subtitle: "Numeric value to compare against",
          content: (
            <div className="alerts-flow-node__form">
              <label className="alerts-flow-node__field">
                <span>Threshold</span>
                <input
                  type="number"
                  value={form.threshold}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      threshold: event.target.value,
                    }))
                  }
                  placeholder="10"
                />
              </label>
            </div>
          ),
        },
      },
      {
        id: "result",
        type: "builder",
        position: { x: 930, y: 60 },
        dragHandle: ".alerts-flow-node__header",
        data: {
          title: "Alert Result",
          subtitle: "The persisted condition sent to backend",
          content: (
            <div className="alerts-flow-node__result">
              <p>
                {form.metricKey ? form.metricKey : "metric"}{" "}
                {COMPARATOR_LABELS[form.comparator].toLowerCase()}{" "}
                {form.threshold || "threshold"}
              </p>
              <small>
                {form.source === "base" ? "Base metric condition" : "Custom metric condition"}
              </small>
            </div>
          ),
        },
      },
    ],
    [baseMetrics, customMetrics, form.comparator, form.metricKey, form.source, form.threshold, metricOptions],
  );

  const builderEdges = useMemo<Edge[]>(
    () => [
      {
        id: "metric-operator",
        source: "metric",
        target: "operator",
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        id: "operator-threshold",
        source: "operator",
        target: "threshold",
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
      },
      {
        id: "threshold-result",
        source: "threshold",
        target: "result",
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed },
      },
    ],
    [],
  );

  const [flowNodes, setFlowNodes, onFlowNodesChange] =
    useNodesState<Node<BuilderNodeData>>([]);
  const [flowEdges, setFlowEdges, onFlowEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (!showModal) {
      setFlowNodes([]);
      setFlowEdges([]);
      return;
    }

    setFlowEdges(builderEdges);
    setFlowNodes((current) => {
      if (current.length === 0) {
        return builderNodes;
      }

      return current.map((node) => {
        const nextNode = builderNodes.find((candidate) => candidate.id === node.id);
        return nextNode ? { ...node, data: nextNode.data } : node;
      });
    });
  }, [builderEdges, builderNodes, setFlowEdges, setFlowNodes, showModal]);

  return (
    <section className="page-panel alerts-page">
      <div className="alerts-page__header">
        <div className="alerts-page__title-wrap">
          <h2>Alerts</h2>
          <p>Use base metrics immediately. Custom metrics are optional and appear automatically when available.</p>
        </div>
        <div className="alerts-page__actions">
          <button type="button" className="secondary-btn" onClick={() => void loadPage()}>
            Refresh
          </button>
          <button type="button" className="primary-btn" onClick={openCreate}>
            + New Alert Definition
          </button>
        </div>
      </div>

      {error ? <p className="alerts-page__error">{error}</p> : null}

      <div className="alerts-page__summary-grid">
        <div className="alerts-page__summary-card"><span>Alert Records</span><strong>{alerts.length}</strong></div>
        <div className="alerts-page__summary-card"><span>Definitions</span><strong>{definitions.length}</strong></div>
        <div className="alerts-page__summary-card"><span>Base Metrics</span><strong>{baseMetrics.length}</strong></div>
      </div>

      <section className="alerts-rules-section">
        <div className="alerts-rules-section__header">
          <div><h3>Live Alerts</h3><p>Persisted records from the backend alert store. Showing the latest 5 here.</p></div>
          <div className="alerts-page__actions">
            <span className="alert-rule-badge alert-rule-badge--status">
              {visibleAlerts.length} shown by filter
            </span>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => setShowAlertsModal(true)}
            >
              See More
            </button>
          </div>
        </div>

        {loading ? (
          <div className="alerts-empty-state">Loading alerts...</div>
        ) : visibleAlerts.length === 0 ? (
          <div className="alerts-empty-state">No alert records match the current filter.</div>
        ) : (
          <div className="alerts-list">
            {previewAlerts.map((alert) => {
              const severity = definitionSeverity(alert, definitionsById);
              return (
                <div key={alert.id} className={`alert-card ${severity}`}>
                  <div className="alert-icon">{severity === "low" ? "i" : "!"}</div>
                  <div className="alert-content">
                    <div className="alert-header">
                      <div className="alert-title">{alert.productName ?? "Organization Alert"}{alert.productSku ? ` (${alert.productSku})` : ""}</div>
                      <div className="alert-time">{relTime(alert.createdAt)}</div>
                    </div>
                    <div className="alert-meta">
                      <span className={`alert-rule-badge alert-rule-badge--${severity}`}>{toTitle(severity)}</span>
                      <span className="alert-rule-badge alert-rule-badge--status">{toTitle(alert.status)}</span>
                      <span className="alert-rule-badge alert-rule-badge--type">{toTitle(alert.type)}</span>
                    </div>
                    <div className="alert-desc">{alert.message ?? "No custom message recorded for this alert."}</div>
                    <div className="alert-stats">
                      <span>Current: {alert.currentQuantity ?? "-"}</span>
                      <span>Threshold: {alert.thresholdQuantity ?? "-"}</span>
                      {alert.alertDefinitionId ? <span>Definition: {definitionsById.get(alert.alertDefinitionId)?.name ?? "Linked definition"}</span> : null}
                    </div>
                    {alert.status !== "resolved" ? (
                      <div className="alert-actions">
                        {alert.status === "active" ? <button type="button" className="primary-btn" onClick={() => void handleDismissAlert(alert.id)}>Acknowledge</button> : null}
                        <button type="button" className="link-btn" onClick={() => void handleStatusUpdate(alert.id, "resolved")}>Mark as Resolved</button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="alerts-rules-section">
        <div className="alerts-rules-section__header">
          <div><h3>Alert Definitions</h3><p>Monitor inventory thresholds and business rules from one place.</p></div>
        </div>
        {loading ? (
          <div className="alerts-empty-state">Loading definitions...</div>
        ) : definitions.length === 0 ? (
          <div className="alerts-empty-state">No alert definitions yet.</div>
        ) : (
          <div className="alerts-rules-list">
            {definitions.map((definition) => {
              const parsed = parseCondition(definition);
              return (
                <div key={definition.id} className="alert-rule-card">
                  <div className="alert-rule-card__top">
                    <strong>{definition.name}</strong>
                    <div className="alerts-definition-actions">
                      <span className={`alert-rule-badge alert-rule-badge--${definition.severity}`}>{definition.severity}</span>
                      <span className="alert-rule-badge alert-rule-badge--status">{definition.isActive ? "Active" : "Paused"}</span>
                    </div>
                  </div>
                  <p>Key: <strong>{definition.key}</strong></p>
                  <p>Scope: <strong>{definition.scope}</strong></p>
                  <p>Condition: <strong>{parsed ? `${parsed.source === "base" ? "Base" : "Custom"} / ${parsed.metricKey} / ${COMPARATOR_LABELS[parsed.comparator]} / ${parsed.threshold}` : "Complex logic"}</strong></p>
                  {definition.description ? <p>{definition.description}</p> : null}
                  <div className="alert-rule-card__actions">
                    <button type="button" className="secondary-btn" onClick={() => openEdit(definition)}>Edit</button>
                    <button type="button" className="link-btn" onClick={() => void handleDelete(definition.id)}>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {showModal ? (
        <div className="alert-modal-backdrop" onClick={resetModal}>
          <div className="alert-modal alert-modal--wide" onClick={(event) => event.stopPropagation()}>
            <div className="alert-modal__header">
              <div>
                <h3>{form.id ? "Edit Alert Definition" : "Create Alert Definition"}</h3>
                <p>Choose a metric, threshold, and severity for this alert.</p>
              </div>
              <button type="button" className="alert-modal__close" onClick={resetModal} aria-label="Close alert modal">×</button>
            </div>
            <div className="alert-modal__body">
              <div className="alert-form-grid">
                <label className="alert-field"><span>Alert Name</span><input type="text" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value, key: current.id ? current.key : slugify(event.target.value) }))} placeholder="Low stock pressure" /></label>
                <label className="alert-field"><span>Key</span><input type="text" value={form.key} onChange={(event) => setForm((current) => ({ ...current, key: slugify(event.target.value) }))} disabled={form.id !== null} placeholder="low_stock_pressure" /></label>
                <label className="alert-field"><span>Severity</span><select value={form.severity} onChange={(event) => setForm((current) => ({ ...current, severity: event.target.value as AlertSeverity }))}><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
                <label className="alert-field"><span>Scope</span><select value={form.scope} onChange={(event) => setForm((current) => ({ ...current, scope: event.target.value as AlertScope }))}><option value="organization">Organization</option><option value="product">Product</option><option value="category">Category</option></select></label>
                <label className="alert-field alert-field--full"><span>Description</span><textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} rows={4} placeholder="Add context for operators and reviewers" /></label>
                <label className="alert-field alert-field--checkbox"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} /><span>Active</span></label>
              </div>

              <div className="alerts-builder">
                <div className="alerts-builder__header">
                  <div>
                    <h4>Condition Builder</h4>
                    <p>Configure the metric path and alert threshold.</p>
                  </div>
                </div>
                <div className="alerts-builder__canvas">
                  <ReactFlow
                    nodes={flowNodes}
                    edges={flowEdges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onFlowNodesChange}
                    onEdgesChange={onFlowEdgesChange}
                    nodesDraggable
                    nodesConnectable={false}
                    elementsSelectable
                    zoomOnScroll
                    panOnDrag
                    panOnScroll
                    selectionOnDrag
                    fitView
                    fitViewOptions={{ padding: 0.12 }}
                  >
                    <Background color="#dde4f2" gap={20} size={1} />
                    <Controls showInteractive={false} position="bottom-right" />
                  </ReactFlow>
                </div>
              </div>

              {metricDescription ? <p className="alerts-page__helper">{metricDescription}</p> : null}
              {form.scope === "product" ? <p className="alerts-page__helper">Product scope target picker comes next. Loaded products: {products.length}.</p> : null}
              {form.scope === "category" ? <p className="alerts-page__helper">Category scope target picker comes next. Loaded categories: {categories.length}.</p> : null}

              {previewState ? (
                <div className="alerts-preview-card">
                  <strong>Preview: {previewState.triggered === null ? "Unavailable" : previewState.triggered ? "Triggered" : "Not Triggered"}</strong>
                  <p>Current metric value: <b>{previewState.currentValue === null ? "-" : String(previewState.currentValue)}</b></p>
                  {previewState.reason ? <p>{previewState.reason}</p> : null}
                </div>
              ) : null}

              {formError ? <p className="alerts-page__error">{formError}</p> : null}
              {formSuccess ? <p className="alerts-page__success">{formSuccess}</p> : null}
            </div>
            <div className="alert-modal__footer">
              <button type="button" className="secondary-btn" onClick={resetModal}>Close</button>
              <div className="alerts-modal__footer-actions">
                <button type="button" className="secondary-btn" onClick={() => void handlePreview()} disabled={previewing}>{previewing ? "Previewing..." : "Preview"}</button>
                <button type="button" className="primary-btn" onClick={() => void handleSave()} disabled={submitting}>{submitting ? "Saving..." : form.id ? "Save Definition" : "Create Definition"}</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showAlertsModal ? (
        <div className="alert-modal-backdrop" onClick={() => setShowAlertsModal(false)}>
          <div
            className="alert-modal alert-modal--wide"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="alert-modal__header">
              <div>
                <h3>All Alerts</h3>
                <p>Browse the full alert list with a status filter and dismiss actions.</p>
              </div>
              <button
                type="button"
                className="alert-modal__close"
                onClick={() => setShowAlertsModal(false)}
                aria-label="Close alerts list modal"
              >
                ×
              </button>
            </div>
            <div className="alert-modal__body">
              <div className="alerts-list-toolbar">
                <div className="alerts-list-toolbar__meta">
                  <strong>{visibleAlerts.length}</strong>
                  <span>matching alerts</span>
                </div>
                <select
                  className="alerts-page__filter"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as AlertStatusFilter)}
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="acknowledged">Acknowledged</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              {visibleAlerts.length === 0 ? (
                <div className="alerts-empty-state">No alert records match the current filter.</div>
              ) : (
                <div className="product-table-wrapper alerts-table-wrapper">
                  <table className="product-table alerts-table">
                    <thead>
                      <tr>
                        <th>Alert</th>
                        <th>Status</th>
                        <th>Current</th>
                        <th>Threshold</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleAlerts.map((alert) => {
                        const severity = definitionSeverity(alert, definitionsById);
                        return (
                          <tr key={alert.id}>
                            <td>
                              <div className="alerts-table__title">
                                <strong>{alert.productName ?? "Organization Alert"}</strong>
                                <span>
                                  {alert.message ?? "No custom message recorded for this alert."}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div className="alert-meta">
                                <span className={`alert-rule-badge alert-rule-badge--${severity}`}>
                                  {toTitle(severity)}
                                </span>
                                <span className="alert-rule-badge alert-rule-badge--status">
                                  {toTitle(alert.status)}
                                </span>
                              </div>
                            </td>
                            <td>{alert.currentQuantity ?? "-"}</td>
                            <td>{alert.thresholdQuantity ?? "-"}</td>
                            <td>{relTime(alert.createdAt)}</td>
                            <td>
                              <div className="alert-actions">
                                {alert.status === "active" ? (
                                  <button
                                    type="button"
                                    className="secondary-btn"
                                    onClick={() => void handleDismissAlert(alert.id)}
                                  >
                                    Acknowledge
                                  </button>
                                ) : null}
                                {alert.status !== "resolved" ? (
                                  <button
                                    type="button"
                                    className="link-btn"
                                    onClick={() => void handleStatusUpdate(alert.id, "resolved")}
                                  >
                                    Resolve
                                  </button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="alert-modal__footer">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setShowAlertsModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
