/**
 * Metrics workspace combining operational analytics, saved custom metric
 * definitions, and the React Flow-based metric builder.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  createMetricDefinition,
  deleteMetricDefinition,
  getBaseMetricCatalog,
  getInventoryCategoryBreakdownMetrics,
  getInventoryOverviewMetrics,
  getInventoryMovementTrendMetrics,
  getProductMovementLeaderboard,
  listInventory,
  listMetricDefinitions,
  previewMetricDefinition,
  updateMetricDefinition,
  type BaseMetricCatalogEntry,
  type InventoryCategoryBreakdownEntry,
  type InventoryOverviewMetrics,
  type InventoryMovementTrendPoint,
  type MetricDefinition,
  type MetricDefinitionNode,
  type ProductMovementSummaryEntry,
} from "../../services/api.service";
import "./metrics-page.css";

type MetricScope = "organization" | "product" | "category";
type MetricFormat = "number" | "percent" | "currency" | "quantity";
type BinaryOperator = "add" | "sub" | "mul" | "div";
type GraphNodeKind = "metric" | "number" | "operator" | "output";

type MetricFormState = {
  id: string | null;
  name: string;
  key: string;
  description: string;
  scope: MetricScope;
  format: MetricFormat;
  isActive: boolean;
};

type GraphNodeData = {
  kind: GraphNodeKind;
  label: string;
  metricKey?: string;
  numberValue?: string;
  operator?: BinaryOperator;
  metricOptions: BaseMetricCatalogEntry[];
  onMetricChange: (nodeId: string, metricKey: string) => void;
  onNumberChange: (nodeId: string, value: string) => void;
  onOperatorChange: (nodeId: string, operator: BinaryOperator) => void;
  onRemove: (nodeId: string) => void;
  removable: boolean;
};

const DEFAULT_FORM_STATE: MetricFormState = {
  id: null,
  name: "",
  key: "",
  description: "",
  scope: "organization",
  format: "number",
  isActive: true,
};

const FORMAT_LABELS: Record<MetricFormat, string> = {
  number: "Number",
  percent: "Percent",
  currency: "Currency",
  quantity: "Quantity",
};

const OPERATOR_LABELS: Record<BinaryOperator, string> = {
  add: "+",
  sub: "-",
  mul: "×",
  div: "÷",
};

const CATEGORY_COLORS = ["#24389c", "#5265cc", "#0f6b54", "#e28b26", "#d75f4a"];

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/__+/g, "_");
}

function formatMetricValue(value: number | null, format: MetricFormat): string {
  if (value === null || Number.isNaN(value)) return "Unavailable";
  if (format === "currency") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: Math.abs(value) >= 1000 ? "compact" : "standard",
      maximumFractionDigits: 2,
    }).format(value);
  }
  if (format === "percent") {
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)}%`;
  }
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    notation: Math.abs(value) >= 1000 ? "compact" : "standard",
  }).format(value);
}

function describeMetricNode(node: MetricDefinitionNode, labels: Map<string, string>): string {
  if (node.kind === "metric") return labels.get(node.key) ?? node.key;
  if (node.kind === "number") return String(node.value);
  return `(${describeMetricNode(node.left, labels)} ${OPERATOR_LABELS[node.kind]} ${describeMetricNode(node.right, labels)})`;
}

function lastDays(count: number) {
  const values: string[] = [];
  const now = new Date();
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - index);
    values.push(date.toISOString().slice(0, 10));
  }
  return values;
}

function fillTrendWindow(points: InventoryMovementTrendPoint[], days = 14) {
  const map = new Map(points.map((point) => [point.bucket, point]));
  return lastDays(days).map((bucket) => ({
    bucket,
    shortLabel: bucket.slice(5),
    inbound: map.get(bucket)?.inbound ?? 0,
    outbound: map.get(bucket)?.outbound ?? 0,
  }));
}

function percentageValue(value: number, total: number) {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

function categoryShareData(categories: InventoryCategoryBreakdownEntry[]) {
  return categories
    .filter((entry) => entry.totalValue > 0)
    .map((entry, index) => ({
      ...entry,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    }));
}

function MetricSummaryCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="metrics-page__summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{note}</p>
    </div>
  );
}

/**
 * Custom React Flow node renderer used by the graph builder to handle operand,
 * operator, and output node editing in-place.
 */
function MetricBuilderNode({ id, data }: NodeProps<Node<GraphNodeData>>) {
  return (
    <div className={`metrics-flow-node metrics-flow-node--${data.kind}`}>
      {data.kind === "operator" ? (
        <>
          <Handle type="target" position={Position.Left} id="left" className="metrics-flow-node__handle metrics-flow-node__handle--left" />
          <Handle type="target" position={Position.Left} id="right" className="metrics-flow-node__handle metrics-flow-node__handle--right" />
          <span className="metrics-flow-node__handle-label metrics-flow-node__handle-label--left">L</span>
          <span className="metrics-flow-node__handle-label metrics-flow-node__handle-label--right">R</span>
        </>
      ) : null}
      {data.kind === "output" ? (
        <>
          <Handle type="target" position={Position.Left} id="result" className="metrics-flow-node__handle metrics-flow-node__handle--output" />
          <span className="metrics-flow-node__handle-label metrics-flow-node__handle-label--output">IN</span>
        </>
      ) : null}
      <div className="metrics-flow-node__header">
        <strong>{data.label}</strong>
        {data.removable ? <button type="button" className="metrics-flow-node__remove" onClick={() => data.onRemove(id)}>Remove</button> : null}
      </div>
      <div className="metrics-flow-node__body">
        {data.kind === "metric" ? (
          <label className="metrics-flow-node__field">
            <span>Base metric</span>
            <select value={data.metricKey ?? ""} onChange={(event) => data.onMetricChange(id, event.target.value)}>
              {data.metricOptions.map((metric) => <option key={metric.key} value={metric.key}>{metric.name}</option>)}
            </select>
          </label>
        ) : null}
        {data.kind === "number" ? (
          <label className="metrics-flow-node__field">
            <span>Literal number</span>
            <input type="number" value={data.numberValue ?? ""} onChange={(event) => data.onNumberChange(id, event.target.value)} />
          </label>
        ) : null}
        {data.kind === "operator" ? (
          <>
            <label className="metrics-flow-node__field">
              <span>Operator</span>
              <select value={data.operator ?? "div"} onChange={(event) => data.onOperatorChange(id, event.target.value as BinaryOperator)}>
                <option value="add">Add (+)</option>
                <option value="sub">Subtract (-)</option>
                <option value="mul">Multiply (×)</option>
                <option value="div">Divide (÷)</option>
              </select>
            </label>
            <div className="metrics-flow-node__slots">
              <span>Top input = left operand</span>
              <span>Bottom input = right operand</span>
            </div>
          </>
        ) : null}
        {data.kind === "output" ? (
          <div className="metrics-flow-node__result">
            <p>Connect the final operand or operator here.</p>
            <small>The graph must terminate at Output before preview or save.</small>
          </div>
        ) : null}
      </div>
      {data.kind !== "output" ? (
        <>
          <Handle type="source" position={Position.Right} id="out" className="metrics-flow-node__handle metrics-flow-node__handle--source" />
          <span className="metrics-flow-node__handle-label metrics-flow-node__handle-label--source">OUT</span>
        </>
      ) : null}
    </div>
  );
}

const nodeTypes = { metricBuilder: MetricBuilderNode };

function metricNode(defaultMetricKey: string, options: BaseMetricCatalogEntry[]): Node<GraphNodeData> {
  return {
    id: `metric-${crypto.randomUUID()}`,
    type: "metricBuilder",
    position: { x: 80, y: 80 },
    data: {
      kind: "metric",
      label: "Base Metric",
      metricKey: defaultMetricKey,
      metricOptions: options,
      onMetricChange: () => undefined,
      onNumberChange: () => undefined,
      onOperatorChange: () => undefined,
      onRemove: () => undefined,
      removable: true,
    },
  };
}

function numberNode(): Node<GraphNodeData> {
  return {
    id: `number-${crypto.randomUUID()}`,
    type: "metricBuilder",
    position: { x: 80, y: 250 },
    data: {
      kind: "number",
      label: "Number",
      numberValue: "1",
      metricOptions: [],
      onMetricChange: () => undefined,
      onNumberChange: () => undefined,
      onOperatorChange: () => undefined,
      onRemove: () => undefined,
      removable: true,
    },
  };
}

function operatorNode(): Node<GraphNodeData> {
  return {
    id: `operator-${crypto.randomUUID()}`,
    type: "metricBuilder",
    position: { x: 420, y: 160 },
    data: {
      kind: "operator",
      label: "Operator",
      operator: "div",
      metricOptions: [],
      onMetricChange: () => undefined,
      onNumberChange: () => undefined,
      onOperatorChange: () => undefined,
      onRemove: () => undefined,
      removable: true,
    },
  };
}

function outputNode(): Node<GraphNodeData> {
  return {
    id: "output",
    type: "metricBuilder",
    position: { x: 880, y: 170 },
    draggable: false,
    selectable: false,
    data: {
      kind: "output",
      label: "Output",
      metricOptions: [],
      onMetricChange: () => undefined,
      onNumberChange: () => undefined,
      onOperatorChange: () => undefined,
      onRemove: () => undefined,
      removable: false,
    },
  };
}

function isOperandKind(kind: GraphNodeKind) {
  return kind === "metric" || kind === "number" || kind === "operator";
}

function withData(
  rawNodes: Node<GraphNodeData>[],
  catalog: BaseMetricCatalogEntry[],
  onMetricChange: (nodeId: string, metricKey: string) => void,
  onNumberChange: (nodeId: string, value: string) => void,
  onOperatorChange: (nodeId: string, operator: BinaryOperator) => void,
  onRemove: (nodeId: string) => void,
) {
  return rawNodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      metricOptions: node.data.kind === "metric" ? catalog : [],
      onMetricChange,
      onNumberChange,
      onOperatorChange,
      onRemove,
      removable: node.id !== "output",
    },
  }));
}

function flattenDefinition(
  node: MetricDefinitionNode,
  metricOptions: BaseMetricCatalogEntry[],
  column = 0,
  rowState = { value: 0 },
): { nodes: Node<GraphNodeData>[]; edges: Edge[]; rootId: string } {
  if (node.kind === "metric") {
    const id = `metric-${crypto.randomUUID()}`;
    const row = rowState.value++;
    return {
      nodes: [{
        id,
        type: "metricBuilder",
        position: { x: 80 + column * 270, y: 80 + row * 140 },
        data: { kind: "metric", label: "Base Metric", metricKey: node.key, metricOptions, onMetricChange: () => undefined, onNumberChange: () => undefined, onOperatorChange: () => undefined, onRemove: () => undefined, removable: true },
      }],
      edges: [],
      rootId: id,
    };
  }
  if (node.kind === "number") {
    const id = `number-${crypto.randomUUID()}`;
    const row = rowState.value++;
    return {
      nodes: [{
        id,
        type: "metricBuilder",
        position: { x: 80 + column * 270, y: 80 + row * 140 },
        data: { kind: "number", label: "Number", numberValue: String(node.value), metricOptions: [], onMetricChange: () => undefined, onNumberChange: () => undefined, onOperatorChange: () => undefined, onRemove: () => undefined, removable: true },
      }],
      edges: [],
      rootId: id,
    };
  }

  const left = flattenDefinition(node.left, metricOptions, column, rowState);
  const operatorRow = rowState.value++;
  const right = flattenDefinition(node.right, metricOptions, column, rowState);
  const operatorId = `operator-${crypto.randomUUID()}`;

  return {
    nodes: [
      ...left.nodes,
      ...right.nodes,
      {
        id: operatorId,
        type: "metricBuilder",
        position: { x: 380 + column * 260, y: 100 + operatorRow * 90 },
        data: { kind: "operator", label: "Operator", operator: node.kind, metricOptions: [], onMetricChange: () => undefined, onNumberChange: () => undefined, onOperatorChange: () => undefined, onRemove: () => undefined, removable: true },
      },
    ],
    edges: [
      ...left.edges,
      ...right.edges,
      { id: `${left.rootId}-${operatorId}-left`, source: left.rootId, target: operatorId, targetHandle: "left", type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } },
      { id: `${right.rootId}-${operatorId}-right`, source: right.rootId, target: operatorId, targetHandle: "right", type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } },
    ],
    rootId: operatorId,
  };
}

/**
 * Renders the analytics overview and custom metric builder page.
 */
export default function MetricsPage(_props: {
  criticalThreshold?: number;
  lowThreshold?: number;
}) {
  const [performanceTab, setPerformanceTab] = useState<"turnover" | "low-stock">("turnover");
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "1y">("30d");
  const [catalog, setCatalog] = useState<BaseMetricCatalogEntry[]>([]);
  const [definitions, setDefinitions] = useState<MetricDefinition[]>([]);
  const [overview, setOverview] = useState<InventoryOverviewMetrics>({
    totalSku: 0,
    totalQuantity: 0,
    totalValue: 0,
    criticalCount: 0,
    lowCount: 0,
  });
  const [movementTrend, setMovementTrend] = useState<InventoryMovementTrendPoint[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<InventoryCategoryBreakdownEntry[]>([]);
  const [leaderboard, setLeaderboard] = useState<ProductMovementSummaryEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [previewValue, setPreviewValue] = useState<number | null>(null);
  const [previewReason, setPreviewReason] = useState<string | null>(null);
  const [form, setForm] = useState<MetricFormState>(DEFAULT_FORM_STATE);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<GraphNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const defaultMetricKey = catalog[0]?.key ?? "";
  const metricLabelMap = useMemo(() => new Map(catalog.map((metric) => [metric.key, metric.name])), [catalog]);
  const activeDefinitions = useMemo(() => definitions.filter((definition) => definition.isActive), [definitions]);

  const timeRangeDays = timeRange === "7d" ? 7 : timeRange === "1y" ? 365 : 30;
  const timeRangeLabel = timeRange === "7d" ? "7-Day" : timeRange === "1y" ? "1-Year" : "30-Day";

  const filledTrend = useMemo(() => fillTrendWindow(movementTrend, timeRangeDays), [movementTrend, timeRangeDays]);
  const outboundTotal = useMemo(() => filledTrend.reduce((sum, point) => sum + point.outbound, 0), [filledTrend]);
  const turnoverRate = useMemo(
    () => percentageValue(outboundTotal, overview.totalQuantity),
    [outboundTotal, overview.totalQuantity],
  );
  const categoryShare = useMemo(() => categoryShareData(categoryBreakdown), [categoryBreakdown]);

  const onMetricChange = useCallback((nodeId: string, metricKey: string) => {
    setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, metricKey } } : node));
  }, [setNodes]);

  const onNumberChange = useCallback((nodeId: string, value: string) => {
    setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, numberValue: value } } : node));
  }, [setNodes]);

  const onOperatorChange = useCallback((nodeId: string, operator: BinaryOperator) => {
    setNodes((current) => current.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, operator } } : node));
  }, [setNodes]);

  const onRemove = useCallback((nodeId: string) => {
    setNodes((current) => current.filter((node) => node.id !== nodeId));
    setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
  }, [setEdges, setNodes]);

  async function loadPage(days = timeRangeDays) {
    setLoading(true);
    setError(null);
    try {
      const [
        overviewResponse,
        catalogResponse,
        definitionsResponse,
        trendResponse,
        categoryResponse,
        inventoryResponse,
      ] = await Promise.all([
        getInventoryOverviewMetrics(),
        getBaseMetricCatalog(),
        listMetricDefinitions(),
        getInventoryMovementTrendMetrics(`days=${days}`),
        getInventoryCategoryBreakdownMetrics("top=5"),
        listInventory(),
      ]);
      setOverview(overviewResponse.overview);
      setCatalog(catalogResponse.metrics);
      setDefinitions(definitionsResponse.metrics);
      setMovementTrend(trendResponse.trend);
      setCategoryBreakdown(categoryResponse.categories);

      // Fetch per-product movement leaderboard in the background
      const productStubs = inventoryResponse.inventory.map((item) => ({
        id: item.productId,
        name: item.productName,
        sku: item.sku,
      }));
      if (productStubs.length > 0) {
        setLeaderboardLoading(true);
        getProductMovementLeaderboard(productStubs, days)
          .then(setLeaderboard)
          .catch(() => { /* non-critical — leaderboard is supplemental */ })
          .finally(() => setLeaderboardLoading(false));
      } else {
        setLeaderboard([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load metrics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage(timeRangeDays);
  }, [timeRange]);

  function defaultGraph() {
    const baseNodes = defaultMetricKey
      ? [metricNode(defaultMetricKey, catalog), outputNode()]
      : [outputNode()];
    const baseEdges: Edge[] = defaultMetricKey
      ? [{ id: `${baseNodes[0].id}-output`, source: baseNodes[0].id, target: "output", targetHandle: "result", type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } }]
      : [];
    return {
      nodes: withData(baseNodes, catalog, onMetricChange, onNumberChange, onOperatorChange, onRemove),
      edges: baseEdges,
    };
  }

  function resetModal() {
    setShowModal(false);
    setForm(DEFAULT_FORM_STATE);
    setFormError(null);
    setFormSuccess(null);
    setPreviewValue(null);
    setPreviewReason(null);
    setNodes([]);
    setEdges([]);
  }

  function openCreateModal() {
    const graph = defaultGraph();
    setForm(DEFAULT_FORM_STATE);
    setFormError(null);
    setFormSuccess(null);
    setPreviewValue(null);
    setPreviewReason(null);
    setNodes(graph.nodes);
    setEdges(graph.edges);
    setShowModal(true);
  }

  function openEditModal(metric: MetricDefinition) {
    const graph = flattenDefinition(metric.definition as MetricDefinitionNode, catalog);
    setForm({
      id: metric.id,
      name: metric.name,
      key: metric.key,
      description: metric.description ?? "",
      scope: metric.scope,
      format: metric.format,
      isActive: metric.isActive,
    });
    setFormError(null);
    setFormSuccess(null);
    setPreviewValue(null);
    setPreviewReason(null);
    setNodes(withData([...graph.nodes, outputNode()], catalog, onMetricChange, onNumberChange, onOperatorChange, onRemove));
    setEdges([...graph.edges, { id: `${graph.rootId}-output`, source: graph.rootId, target: "output", targetHandle: "result", type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } }]);
    setShowModal(true);
  }

  function validateMetadata() {
    if (!form.name.trim()) return "Metric name is required.";
    if (!form.key.trim()) return "Metric key is required.";
    return null;
  }

  function validateAndBuildDefinition(): { definition: MetricDefinitionNode | null; error: string | null } {
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const outputInput = edges.filter((edge) => edge.target === "output");
    if (outputInput.length !== 1) {
      return { definition: null, error: "Connect exactly one final result into the Output node." };
    }

    const visiting = new Set<string>();
    const buildNode = (nodeId: string): MetricDefinitionNode => {
      const node = nodeMap.get(nodeId);
      if (!node) throw new Error("Builder graph contains a missing node.");
      if (visiting.has(nodeId)) throw new Error("Builder graph contains a cycle.");
      visiting.add(nodeId);
      try {
        if (node.data.kind === "metric") {
          if (!node.data.metricKey) throw new Error("Each metric node must choose a base metric.");
          return { kind: "metric", key: node.data.metricKey as BaseMetricCatalogEntry["key"] };
        }
        if (node.data.kind === "number") {
          if ((node.data.numberValue ?? "").trim() === "") throw new Error("Each number node must contain a numeric value.");
          const value = Number(node.data.numberValue);
          if (!Number.isFinite(value)) throw new Error("Each number node must contain a valid numeric value.");
          return { kind: "number", value };
        }
        if (node.data.kind === "operator") {
          const left = edges.find((edge) => edge.target === nodeId && edge.targetHandle === "left");
          const right = edges.find((edge) => edge.target === nodeId && edge.targetHandle === "right");
          if (!left || !right) throw new Error("Each operator must have both left and right inputs connected.");
          if (!node.data.operator) throw new Error("Each operator node must choose an operator.");
          return {
            kind: node.data.operator,
            left: buildNode(left.source),
            right: buildNode(right.source),
          };
        }
        throw new Error("Output cannot be used as an operand.");
      } finally {
        visiting.delete(nodeId);
      }
    };

    try {
      const definition = buildNode(outputInput[0].source);
      const reachable = new Set<string>();
      const walk = (nodeId: string) => {
        if (reachable.has(nodeId)) return;
        reachable.add(nodeId);
        edges.filter((edge) => edge.target === nodeId).forEach((edge) => walk(edge.source));
      };
      walk("output");
      const disconnected = nodes.some((node) => node.id !== "output" && !reachable.has(node.id));
      if (disconnected) {
        return { definition: null, error: "Remove or connect every node before previewing or saving." };
      }
      return { definition, error: null };
    } catch (builderError) {
      return { definition: null, error: builderError instanceof Error ? builderError.message : "Invalid metric graph." };
    }
  }

  async function handlePreview() {
    const metadataError = validateMetadata();
    if (metadataError) {
      setFormError(metadataError);
      return;
    }
    const built = validateAndBuildDefinition();
    if (built.error || !built.definition) {
      setFormError(built.error ?? "Invalid metric graph.");
      return;
    }
    setPreviewing(true);
    setFormError(null);
    try {
      const response = await previewMetricDefinition({ definition: built.definition });
      setPreviewValue(response.preview.value);
      setPreviewReason(response.preview.reason ?? null);
    } catch (previewError) {
      setFormError(previewError instanceof Error ? previewError.message : "Failed to preview metric definition.");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const metadataError = validateMetadata();
    if (metadataError) {
      setFormError(metadataError);
      return;
    }
    const built = validateAndBuildDefinition();
    if (built.error || !built.definition) {
      setFormError(built.error ?? "Invalid metric graph.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    setFormSuccess(null);
    try {
      const payload = { key: form.key.trim(), name: form.name.trim(), description: form.description.trim() || null, scope: form.scope, format: form.format, isActive: form.isActive, definition: built.definition };
      if (form.id) {
        await updateMetricDefinition(form.id, payload);
        setFormSuccess("Metric definition updated.");
      } else {
        await createMetricDefinition(payload);
        setFormSuccess("Metric definition created.");
      }
      await loadPage();
      window.setTimeout(() => resetModal(), 700);
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : "Failed to save metric definition.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(metricId: string) {
    try {
      await deleteMetricDefinition(metricId);
      setDefinitions((current) => current.filter((metric) => metric.id !== metricId));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete metric definition.");
    }
  }

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    const sourceNode = nodes.find((node) => node.id === connection.source);
    const targetNode = nodes.find((node) => node.id === connection.target);
    if (!sourceNode || !targetNode || !isOperandKind(sourceNode.data.kind)) return;
    if (targetNode.data.kind === "operator") {
      if (connection.targetHandle !== "left" && connection.targetHandle !== "right") return;
      if (edges.some((edge) => edge.target === connection.target && edge.targetHandle === connection.targetHandle)) return;
    } else if (targetNode.data.kind === "output") {
      if (connection.targetHandle !== "result") return;
      if (edges.some((edge) => edge.target === "output")) return;
    } else {
      return;
    }
    setEdges((current) => addEdge({ ...connection, type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } }, current));
  }, [edges, nodes, setEdges]);

  const addMetricOperand = () => {
    if (!defaultMetricKey) return;
    const next = withData([metricNode(defaultMetricKey, catalog)], catalog, onMetricChange, onNumberChange, onOperatorChange, onRemove)[0];
    setNodes((current) => [...current, { ...next, position: { x: 60, y: 80 + current.length * 36 } }]);
  };

  const addNumberOperand = () => {
    const next = withData([numberNode()], catalog, onMetricChange, onNumberChange, onOperatorChange, onRemove)[0];
    setNodes((current) => [...current, { ...next, position: { x: 60, y: 80 + current.length * 36 } }]);
  };

  const addOperator = () => {
    const next = withData([operatorNode()], catalog, onMetricChange, onNumberChange, onOperatorChange, onRemove)[0];
    setNodes((current) => [...current, { ...next, position: { x: 420, y: 100 + current.length * 28 } }]);
  };

  const chainSummary = useMemo(() => {
    const built = validateAndBuildDefinition();
    if (!built.definition) return "Build your formula by connecting inputs to operators and routing the result to Output.";
    return describeMetricNode(built.definition, metricLabelMap);
  }, [edges, metricLabelMap, nodes]);

  return (
    <section className="page-panel metrics-page">
      <div className="metrics-page__header">
        <div className="metrics-page__title-wrap">
          <h2>Metrics</h2>
          <p>Build formulas visually. Operands feed operators, operator outputs can chain into more operators, and the final result must connect to Output.</p>
        </div>
        <div className="metrics-page__actions">
          <div className="metrics-page__time-toggle" role="group" aria-label="Time range">
            {(["7d", "30d", "1y"] as const).map((range) => (
              <button
                key={range}
                type="button"
                className={`metrics-page__time-btn${timeRange === range ? " metrics-page__time-btn--active" : ""}`}
                onClick={() => setTimeRange(range)}
                aria-pressed={timeRange === range}
              >
                {range === "7d" ? "7D" : range === "30d" ? "30D" : "1Y"}
              </button>
            ))}
          </div>
          <button type="button" className="secondary-btn" onClick={() => void loadPage(timeRangeDays)}>Refresh</button>
          <button type="button" className="primary-btn" onClick={openCreateModal}>Create Metric</button>
        </div>
      </div>

      <section className="metrics-page__overview">
        <div className="metrics-page__overview-copy">
          <h3>Operations Metrics</h3>
          <p>Live inventory health and a {timeRangeLabel.toLowerCase()} performance view sit above the custom metric builder.</p>
        </div>

        <div className="metrics-page__overview-grid">
          <MetricSummaryCard
            label="Total Warehouse Value"
            value={formatMetricValue(overview.totalValue, "currency")}
            note="Current inventory valuation across the organization."
          />
          <MetricSummaryCard
            label="Total SKUs"
            value={formatMetricValue(overview.totalSku, "number")}
            note="Tracked products currently in inventory."
          />
          <MetricSummaryCard
            label="Total Quantity"
            value={formatMetricValue(overview.totalQuantity, "quantity")}
            note="Units currently held across all stocked items."
          />
          <MetricSummaryCard
            label="Critical Stock"
            value={formatMetricValue(overview.criticalCount, "number")}
            note="Products currently at or below the critical threshold."
          />
        </div>

        <div className="metrics-page__performance-copy">
          <h3>{timeRangeLabel} Performance</h3>
          <p>Recent movement throughput and category contribution for the last {timeRangeLabel.toLowerCase()}.</p>
        </div>

        <div className="metrics-page__performance-grid">
          <section className="metrics-page__card metrics-page__card--performance">
            <div className="metrics-page__performance-tabs" role="tablist" aria-label={`${timeRangeLabel} performance insights`}>
              <button
                type="button"
                role="tab"
                aria-selected={performanceTab === "turnover"}
                className={`metrics-page__performance-tab ${performanceTab === "turnover" ? "metrics-page__performance-tab--active" : ""}`}
                onClick={() => setPerformanceTab("turnover")}
              >
                Turnover
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={performanceTab === "low-stock"}
                className={`metrics-page__performance-tab ${performanceTab === "low-stock" ? "metrics-page__performance-tab--active" : ""}`}
                onClick={() => setPerformanceTab("low-stock")}
              >
                Low Stock
              </button>
            </div>
            {performanceTab === "turnover" ? (
              <div className="metrics-page__performance-panel">
                <span>Stock Turnover Rate</span>
                <strong>{formatMetricValue(turnoverRate, "percent")}</strong>
                <p>{timeRangeLabel} outbound movement against current total quantity.</p>
              </div>
            ) : (
              <div className="metrics-page__performance-panel">
                <span>Low Stock Warning</span>
                <strong>{formatMetricValue(overview.lowCount, "number")}</strong>
                <p>Products between the critical and low-stock thresholds.</p>
              </div>
            )}
          </section>

          <section className="metrics-page__card metrics-page__card--chart">
            <div className="metrics-page__card-header">
              <div>
                <h3>{timeRangeLabel} Inventory Flow</h3>
                <p>Inbound and outbound movement over the last {timeRangeLabel.toLowerCase()}, including quiet days.</p>
              </div>
            </div>
            <div className="metrics-page__chart-shell">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={filledTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5ebf5" />
                  <XAxis dataKey="shortLabel" stroke="#76829a" tickLine={false} axisLine={false} minTickGap={16} />
                  <YAxis stroke="#76829a" tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="inbound" stroke="#2f7cf6" strokeWidth={3} dot={false} name="Inbound" />
                  <Line type="monotone" dataKey="outbound" stroke="#1f3c88" strokeWidth={3} dot={false} name="Outbound" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="metrics-page__card metrics-page__card--chart">
            <div className="metrics-page__card-header">
              <div>
                <h3>Amount by Category</h3>
                <p>Current inventory value share across the top categories.</p>
              </div>
            </div>
            <div className="metrics-page__category-body">
              <div className="metrics-page__category-chart">
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Tooltip formatter={(value) => formatMetricValue(Number(value), "currency")} />
                    <Pie
                      data={categoryShare}
                      dataKey="totalValue"
                      nameKey="categoryName"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={categoryShare.length > 1 ? 3 : 0}
                    >
                      {categoryShare.map((entry) => (
                        <Cell key={entry.categoryName} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="metrics-page__category-legend">
                {categoryShare.length === 0 ? (
                  <p className="metrics-page__helper">Category value will appear here once inventory is assigned.</p>
                ) : (
                  categoryShare.map((entry) => (
                    <div key={entry.categoryName} className="metrics-page__category-legend-item">
                      <span className="metrics-page__category-swatch" style={{ backgroundColor: entry.color }} />
                      <span>{entry.categoryName}</span>
                      <strong>{Math.round(entry.share)}%</strong>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>
      </section>

      <section className="metrics-page__leaderboard-section">
        <div className="metrics-page__performance-copy">
          <h3>Top Products by Outbound</h3>
          <p>Products ranked by total outbound quantity over the {timeRangeLabel.toLowerCase()} window.</p>
        </div>
        <div className="metrics-page__card metrics-page__card--leaderboard">
          {leaderboardLoading ? (
            <p className="metrics-page__helper">Loading product movement data...</p>
          ) : leaderboard.length === 0 ? (
            <div className="metrics-page__empty">
              <h4>No movement data</h4>
              <p>No outbound activity was recorded for this period.</p>
            </div>
          ) : (
            <div className="metrics-page__leaderboard">
              <div className="metrics-page__leaderboard-header">
                <span className="metrics-page__leaderboard-rank">#</span>
                <span className="metrics-page__leaderboard-name">Product</span>
                <span className="metrics-page__leaderboard-stat">Outbound</span>
                <span className="metrics-page__leaderboard-stat">Inbound</span>
                <span className="metrics-page__leaderboard-stat">Net</span>
                <span className="metrics-page__leaderboard-stat">Movements</span>
              </div>
              {leaderboard.map((entry, index) => {
                const maxOutbound = leaderboard[0]?.outboundQuantity ?? 1;
                const barWidth = maxOutbound > 0 ? (entry.outboundQuantity / maxOutbound) * 100 : 0;
                return (
                  <div key={entry.productId} className="metrics-page__leaderboard-row">
                    <span className="metrics-page__leaderboard-rank">
                      {index + 1}
                    </span>
                    <div className="metrics-page__leaderboard-name">
                      <span className="metrics-page__leaderboard-product-name">{entry.productName}</span>
                      {entry.sku ? <code className="metrics-page__leaderboard-sku">{entry.sku}</code> : null}
                      <div className="metrics-page__leaderboard-bar-track">
                        <div
                          className="metrics-page__leaderboard-bar-fill"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                    <span className="metrics-page__leaderboard-stat">
                      {formatMetricValue(entry.outboundQuantity, "quantity")}
                    </span>
                    <span className="metrics-page__leaderboard-stat">
                      {formatMetricValue(entry.inboundQuantity, "quantity")}
                    </span>
                    <span className={`metrics-page__leaderboard-stat ${entry.netQuantity >= 0 ? "metrics-page__leaderboard-stat--positive" : "metrics-page__leaderboard-stat--negative"}`}>
                      {entry.netQuantity >= 0 ? "+" : ""}{formatMetricValue(entry.netQuantity, "quantity")}
                    </span>
                    <span className="metrics-page__leaderboard-stat metrics-page__leaderboard-stat--muted">
                      {entry.movementCount}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <div className="metrics-page__summary-grid">
        <MetricSummaryCard label="Base Metrics" value={String(catalog.length)} note="System metrics available in the builder." />
        <MetricSummaryCard label="Custom Metrics" value={String(definitions.length)} note="Saved graph-based metric definitions." />
        <MetricSummaryCard label="Active Metrics" value={String(activeDefinitions.length)} note="Definitions currently available to alerts." />
      </div>

      {error ? <p className="metrics-page__error">{error}</p> : null}

      <div className="metrics-page__grid">
        <section className="metrics-page__card">
          <div className="metrics-page__card-header">
            <div>
              <h3>Base Metric Catalog</h3>
              <p>Use these as operands when building a metric graph.</p>
            </div>
          </div>
          {loading ? <p className="metrics-page__helper">Loading base metrics...</p> : (
            <div className="metrics-page__catalog">
              {catalog.map((metric) => (
                <article key={metric.key} className="metrics-page__catalog-card">
                  <div className="metrics-page__catalog-meta">
                    <strong>{metric.name}</strong>
                    <span>{FORMAT_LABELS[metric.format]}</span>
                  </div>
                  <code>{metric.key}</code>
                  <p>{metric.description}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="metrics-page__stack">
          <section className="metrics-page__card">
            <div className="metrics-page__card-header">
              <div>
                <h3>Custom Metric Definitions</h3>
                <p>Saved formulas compiled from the drag-and-drop graph.</p>
              </div>
            </div>
            {loading ? <p className="metrics-page__helper">Loading metrics...</p> : definitions.length === 0 ? (
              <div className="metrics-page__empty">
                <h4>No custom metrics yet</h4>
                <p>Create your first metric to track a derived KPI.</p>
              </div>
            ) : (
              <div className="metrics-page__definitions">
                {definitions.map((metric) => (
                  <article key={metric.id} className="metrics-page__definition-card">
                    <div className="metrics-page__definition-header">
                      <div>
                        <h4>{metric.name}</h4>
                        <p>{metric.description || "No description provided."}</p>
                      </div>
                      <div className="metrics-page__definition-badges">
                        <span className="metrics-page__badge">{FORMAT_LABELS[metric.format]}</span>
                        <span className="metrics-page__badge metrics-page__badge--muted">{metric.scope}</span>
                        <span className={`metrics-page__badge ${metric.isActive ? "metrics-page__badge--success" : "metrics-page__badge--warning"}`}>{metric.isActive ? "Active" : "Paused"}</span>
                      </div>
                    </div>
                    <div className="metrics-page__definition-body">
                      <div>
                        <span>Key</span>
                        <code>{metric.key}</code>
                      </div>
                      <div>
                        <span>Formula</span>
                        <p>{describeMetricNode(metric.definition as MetricDefinitionNode, metricLabelMap)}</p>
                      </div>
                    </div>
                    <div className="metrics-page__definition-actions">
                      <button type="button" className="secondary-btn" onClick={() => openEditModal(metric)}>Edit</button>
                      <button type="button" className="link-btn" onClick={() => void handleDelete(metric.id)}>Delete</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>

      {showModal ? (
        <div className="metrics-page__modal-backdrop" role="presentation">
          <div className="metrics-page__modal metrics-page__modal--wide" role="dialog" aria-modal="true">
            <div className="metrics-page__modal-header">
              <div>
                <h3>{form.id ? "Edit Metric Definition" : "Create Metric Definition"}</h3>
                <p>Create a reusable KPI formula by combining inputs and operators.</p>
              </div>
              <button type="button" className="metrics-page__modal-close" aria-label="Close" onClick={resetModal}>×</button>
            </div>

            <form className="metrics-page__modal-body" onSubmit={handleSubmit}>
              <div className="metrics-page__field-grid">
                <label className="metrics-page__field">
                  <span>Name</span>
                  <input type="text" value={form.name} onChange={(event) => {
                    const nextName = event.target.value;
                    setForm((current) => ({ ...current, name: nextName, key: current.id ? current.key : slugify(nextName) }));
                  }} placeholder="Margin Ratio" />
                </label>
                <label className="metrics-page__field">
                  <span>Key</span>
                  <input type="text" value={form.key} onChange={(event) => setForm((current) => ({ ...current, key: slugify(event.target.value) }))} placeholder="margin_ratio" />
                </label>
              </div>

              <div className="metrics-page__field-grid">
                <label className="metrics-page__field">
                  <span>Scope</span>
                  <select value={form.scope} onChange={(event) => setForm((current) => ({ ...current, scope: event.target.value as MetricScope }))}>
                    <option value="organization">Organization</option>
                    <option value="product">Product</option>
                    <option value="category">Category</option>
                  </select>
                </label>
                <label className="metrics-page__field">
                  <span>Format</span>
                  <select value={form.format} onChange={(event) => setForm((current) => ({ ...current, format: event.target.value as MetricFormat }))}>
                    {Object.entries(FORMAT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
              </div>

              <label className="metrics-page__field">
                <span>Description</span>
                <textarea rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Add business context for this metric" />
              </label>

              <div className="metrics-page__toggle-row">
                <label className="metrics-page__checkbox">
                  <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
                  <span>Active</span>
                </label>
              </div>

              <div className="metrics-page__builder">
                <div className="metrics-page__builder-header">
                  <div>
                    <h4>Formula Graph</h4>
                    <p>Connect inputs and operators to build the final metric.</p>
                  </div>
                  <div className="metrics-page__builder-actions">
                    <button type="button" className="secondary-btn" onClick={addMetricOperand}>+ Metric</button>
                    <button type="button" className="secondary-btn" onClick={addNumberOperand}>+ Number</button>
                    <button type="button" className="secondary-btn" onClick={addOperator}>+ Operator</button>
                  </div>
                </div>
                <div className="metrics-page__chain-summary">
                  <span>Current expression</span>
                  <strong>{chainSummary}</strong>
                </div>
                <div className="metrics-page__flow-shell">
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    fitView
                    fitViewOptions={{ padding: 0.16 }}
                    snapToGrid
                    snapGrid={[20, 20]}
                    defaultEdgeOptions={{ type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed } }}
                  >
                    <Background color="#dde4f2" gap={20} size={1} />
                    <Controls showInteractive={false} position="bottom-right" />
                  </ReactFlow>
                </div>
              </div>

              {formError ? <p className="metrics-page__error">{formError}</p> : null}
              {formSuccess ? <p className="metrics-page__success">{formSuccess}</p> : null}

              <div className="metrics-page__preview">
                <div>
                  <h4>Preview</h4>
                  <p>Preview the current formula against live inventory data.</p>
                </div>
                <div className="metrics-page__preview-result">
                  <strong>{formatMetricValue(previewValue, form.format)}</strong>
                  {previewReason ? <span>{previewReason}</span> : null}
                </div>
              </div>

              <div className="metrics-page__modal-actions">
                <button type="button" className="secondary-btn" onClick={resetModal}>Cancel</button>
                <button type="button" className="secondary-btn" onClick={() => void handlePreview()} disabled={previewing}>{previewing ? "Previewing..." : "Preview"}</button>
                <button type="submit" className="primary-btn" disabled={submitting}>{submitting ? "Saving..." : form.id ? "Save Metric" : "Create Metric"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
