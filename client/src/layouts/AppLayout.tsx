/**
 * Primary authenticated shell for the client. It owns page routing, dashboard
 * hydration, onboarding, and cross-page notification surfaces.
 */
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Sidebar from "../components/Sidebar";
import {
  cacheOrganizationSummary,
  getStoredOrganizationSummary,
  type BackendAuthAccount,
} from "../services/auth.service";
import {
  getInventoryCategoryBreakdownMetrics,
  getInventoryMovementTrendMetrics,
  getInventoryOverviewMetrics,
  getMyOrganization,
  listAlerts,
  listCategories,
  listInventory,
  listProducts,
  type AlertRecord,
  type Category,
  type InventoryCategoryBreakdownEntry as InventoryCategoryBreakdownMetric,
  type InventorySummary,
  type InventoryOverviewMetrics,
  type OrganizationSummary,
  type Product,
} from "../services/api.service";
import "./app-layout.css";

const ProductsPage = lazy(() => import("../pages/products/ProductsPage"));
const MetricsPage = lazy(() => import("../pages/metrics/MetricsPage"));
const InventoryOperationsPage = lazy(
  () => import("../pages/inventory/InventoryOperationsPage"),
);
const MovementLogsPage = lazy(
  () => import("../pages/inventory/MovementLogsPage"),
);
const InventoryAdjustmentPage = lazy(
  () => import("../pages/inventory/InventoryAdjustmentPage"),
);
const ProfilePage = lazy(() => import("../pages/profile/ProfilePage"));
const SettingsPage = lazy(() => import("../pages/settings/SettingsPage"));
const UserManagementPage = lazy(
  () => import("../pages/users/UserManagementPage"),
);

const AlertsPage = lazy(() => import("../pages/alerts/AlertsPage"));

const OrganizationPage = lazy(
  () => import("../pages/organization/OrganizationPage"),
);

type PageName =
  | "Dashboard"
  | "Products"
  | "Inventory Operations"
  | "Movement Logs"
  | "Inventory Adjustment"
  | "Metrics"
  | "Alerts"
  | "Organization"
  | "User Management"
  | "Profile"
  | "Settings";

type StatCardProps = {
  label: string;
  value: string;
  note: string;
  tone?: "default" | "warning" | "danger";
};

type MovementTrendPoint = {
  label: string;
  inbound: number;
  outbound: number;
};

type MovementChartMode = "bars" | "line";
type CategoryChartMode = "donut" | "pie";
type MovementTimeRange = 7 | 14 | 30;

type DashboardStats = {
  totalSku: number;
  criticalStockCount: number;
  lowStockCount: number;
  inventoryValue: number;
};

type DashboardInventoryRow = {
  productId: string;
  productName: string;
  sku: string;
  categoryId: string | null;
  categoryName: string;
  quantity: number;
  valuation: number;
  threshold: number;
};

type StockStateFilter = "all" | "critical" | "low" | "healthy";
type InventorySortOption =
  | "stock-asc"
  | "stock-desc"
  | "value-desc"
  | "value-asc"
  | "name-asc"
  | "name-desc";

const DEFAULT_CRITICAL_STOCK_THRESHOLD = 10;
const DEFAULT_LOW_STOCK_THRESHOLD = 25;
const DATA_ANIMATION_DURATION_MS = 700;
const ALERT_POLL_INTERVAL_MS = 30000;

type CategoryBreakdownEntry = {
  label: string;
  share: number;
  value: number;
  colorClass: (typeof CATEGORY_SWATCHES)[number];
};

type AlertToast = {
  id: string;
  title: string;
  message: string;
  tone: "critical" | "warning" | "info";
  status: AlertRecord["status"];
};

type OnboardingStep = {
  title: string;
  body: string;
  hint: string;
};

const CATEGORY_SWATCHES = [
  "category-breakdown__swatch--primary",
  "category-breakdown__swatch--tertiary",
  "category-breakdown__swatch--accent",
  "category-breakdown__swatch--muted",
] as const;

const ONBOARDING_STORAGE_KEY = "indigo-ledger:onboarding-dismissed";
const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: "Workspace Navigation",
    body:
      "Use the left sidebar to move between dashboard, products, inventory actions, metrics, alerts, organization, and account management.",
    hint: "Start here whenever you need to jump between operations.",
  },
  {
    title: "Dashboard Signals",
    body:
      "The dashboard gives the live stock snapshot, movement charts, category split, and the main filtered inventory table.",
    hint: "Use it for quick operational checks before drilling into a page.",
  },
  {
    title: "Product And Inventory Flow",
    body:
      "Products manages catalog records and images, while the inventory pages handle stock-in, stock-out, logs, and adjustments.",
    hint: "If stock changes physically, it should pass through one of the inventory pages.",
  },
  {
    title: "Metrics And Alerts",
    body:
      "Metrics lets you build graph-based formulas. Alerts can then use base metrics or custom metrics to trigger active notifications.",
    hint: "Create the metric first when an alert needs a derived value.",
  },
  {
    title: "Organization Controls",
    body:
      "Organization and User Management cover roles, join keys, member changes, and org-level administration based on permission and hierarchy.",
    hint: "Owners and higher roles can manage lower roles, but not the reverse.",
  },
];

const CATEGORY_SWATCH_COLORS: Record<(typeof CATEGORY_SWATCHES)[number], string> = {
  "category-breakdown__swatch--primary": "#24389c",
  "category-breakdown__swatch--tertiary": "#0f6b54",
  "category-breakdown__swatch--accent": "#5265cc",
  "category-breakdown__swatch--muted": "#d9dee8",
};

function formatTrendLabel(date: Date, days: MovementTimeRange): string {
  if (days <= 14) {
    return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function buildEmptyTrendSeries(days: MovementTimeRange): MovementTrendPoint[] {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - ((days - 1) - index));

    return {
      label: formatTrendLabel(date, days),
      inbound: 0,
      outbound: 0,
    };
  });
}

function formatCompactCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 2,
  }).format(value);
}

function buildMovementTrendSeriesFromMetrics(
  trend: { bucket: string; inbound: number; outbound: number }[],
  days: MovementTimeRange,
): MovementTrendPoint[] {
  if (trend.length === 0) {
    return buildEmptyTrendSeries(days);
  }

  const pointMap = new Map(
    trend.map((point) => [point.bucket, { inbound: point.inbound, outbound: point.outbound }]),
  );

  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - ((days - 1) - index));

    const bucket = date.toISOString().slice(0, 10);
    const values = pointMap.get(bucket);

    return {
      label: formatTrendLabel(date, days),
      inbound: values?.inbound ?? 0,
      outbound: values?.outbound ?? 0,
    };
  });
}

function buildCategoryBreakdown(
  rows: DashboardInventoryRow[],
  topCount: number,
  hiddenCategoryLabels: string[],
): CategoryBreakdownEntry[] {
  const totals = new Map<string, number>();
  const hiddenSet = new Set(hiddenCategoryLabels);

  for (const row of rows) {
    const label = row.categoryName || "Uncategorized";
    if (hiddenSet.has(label)) {
      continue;
    }
    totals.set(label, (totals.get(label) ?? 0) + row.valuation);
  }

  const totalValue = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);

  if (totalValue <= 0) {
    return [];
  }

  const rankedEntries = Array.from(totals.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([label, value]) => ({
      label,
      value,
      share: (value / totalValue) * 100,
    }));

  const topEntries = rankedEntries.slice(0, topCount);
  const remainingValue = rankedEntries
    .slice(topCount)
    .reduce((sum, entry) => sum + entry.value, 0);

  const entries = remainingValue > 0
    ? [
        ...topEntries,
        {
          label: "Other",
          value: remainingValue,
          share: (remainingValue / totalValue) * 100,
        },
      ]
    : topEntries;

  return entries.map((entry, index) => ({
    ...entry,
    colorClass: CATEGORY_SWATCHES[index] ?? CATEGORY_SWATCHES[CATEGORY_SWATCHES.length - 1],
  }));
}

function buildCategoryBreakdownFromMetrics(
  entries: InventoryCategoryBreakdownMetric[],
  topCount: number,
  hiddenCategoryLabels: string[],
): CategoryBreakdownEntry[] {
  const hiddenSet = new Set(hiddenCategoryLabels);
  const visibleEntries = entries.filter(
    (entry) => !hiddenSet.has(entry.categoryName),
  );

  if (visibleEntries.length === 0) {
    return [];
  }

  const sortedEntries = [...visibleEntries].sort(
    (left, right) => right.totalValue - left.totalValue,
  );
  const topEntries = sortedEntries.slice(0, topCount);
  const remaining = sortedEntries.slice(topCount);
  const remainingValue = remaining.reduce(
    (sum, entry) => sum + entry.totalValue,
    0,
  );
  const totalValue = sortedEntries.reduce(
    (sum, entry) => sum + entry.totalValue,
    0,
  );

  const mergedEntries =
    remainingValue > 0
      ? [
          ...topEntries,
          {
            categoryId: null,
            categoryName: "Other",
            skuCount: remaining.reduce((sum, entry) => sum + entry.skuCount, 0),
            totalQuantity: remaining.reduce(
              (sum, entry) => sum + entry.totalQuantity,
              0,
            ),
            totalValue: remainingValue,
            share: totalValue > 0 ? (remainingValue / totalValue) * 100 : 0,
          },
        ]
      : topEntries;

  return mergedEntries.map((entry, index) => ({
    label: entry.categoryName,
    share: totalValue > 0 ? (entry.totalValue / totalValue) * 100 : 0,
    value: entry.totalValue,
    colorClass:
      CATEGORY_SWATCHES[index] ??
      CATEGORY_SWATCHES[CATEGORY_SWATCHES.length - 1],
  }));
}

function buildDashboardMetricsQuery(
  input: {
    q: string;
    categoryIds: string[];
    stockState: StockStateFilter;
  },
  extras: Record<string, string> = {},
): URLSearchParams {
  const query = new URLSearchParams();

  if (input.q.trim().length > 0) {
    query.set("q", input.q.trim());
  }

  if (input.categoryIds.length > 0) {
    query.set("categoryIds", input.categoryIds.join(","));
  }

  if (input.stockState !== "all") {
    query.set("stockState", input.stockState);
  }

  for (const [key, value] of Object.entries(extras)) {
    query.set(key, value);
  }

  return query;
}

function formatWholeNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactQuantity(value: number): string {
  if (Math.abs(value) < 1000) {
    return formatWholeNumber(value);
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function clampProgress(progress: number): number {
  return Math.min(1, Math.max(0, progress));
}

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}

function useAnimatedProgress(trigger: unknown): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frameId = 0;
    const startedAt = performance.now();

    setProgress(0);

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const nextProgress = clampProgress(elapsed / DATA_ANIMATION_DURATION_MS);
      setProgress(easeOutCubic(nextProgress));

      if (nextProgress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [trigger]);

  return progress;
}

function scaleMovementTrend(
  movementTrend: MovementTrendPoint[],
  progress: number,
): MovementTrendPoint[] {
  return movementTrend.map((point) => ({
    ...point,
    inbound: point.inbound * progress,
    outbound: point.outbound * progress,
  }));
}

function scaleCategoryBreakdown(
  categoryBreakdown: CategoryBreakdownEntry[],
  progress: number,
): CategoryBreakdownEntry[] {
  return categoryBreakdown.map((entry) => ({
    ...entry,
    value: entry.value * progress,
    share: entry.share * progress,
  }));
}

function scaleDashboardStats(
  stats: DashboardStats,
  progress: number,
): DashboardStats {
  return {
    totalSku: stats.totalSku * progress,
    criticalStockCount: stats.criticalStockCount * progress,
    lowStockCount: stats.lowStockCount * progress,
    inventoryValue: stats.inventoryValue * progress,
  };
}

function buildDashboardStats(
  inventory: InventorySummary[],
  products: Product[],
  criticalStockThreshold: number,
  lowStockThreshold: number,
): DashboardStats {
  const inventoryValue = inventory.reduce((sum, item) => sum + item.valuation, 0);
  const criticalStockCount = inventory.filter(
    (item) => item.quantity <= criticalStockThreshold,
  ).length;
  const lowStockCount = inventory.filter(
    (item) =>
      item.quantity > criticalStockThreshold &&
      item.quantity <= lowStockThreshold,
  ).length;

  return {
    totalSku: products.length,
    criticalStockCount,
    lowStockCount,
    inventoryValue,
  };
}

function buildDashboardStatsFromMetrics(metrics: InventoryOverviewMetrics): DashboardStats {
  return {
    totalSku: metrics.totalSku,
    criticalStockCount: metrics.criticalCount,
    lowStockCount: metrics.lowCount,
    inventoryValue: metrics.totalValue,
  };
}

function buildDashboardInventoryRows(
  categories: Category[],
  products: Product[],
  inventory: InventorySummary[],
  criticalStockThreshold: number,
  lowStockThreshold: number,
): DashboardInventoryRow[] {
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const productsById = new Map(products.map((product) => [product.id, product]));

  return inventory
    .map((item) => {
      const product = productsById.get(item.productId);
      const categoryName = product?.productCategoryId
        ? (categoryNames.get(product.productCategoryId) ?? "Uncategorized")
        : "Uncategorized";
      const threshold =
        item.quantity <= criticalStockThreshold
          ? criticalStockThreshold
          : lowStockThreshold;

      return {
        productId: item.productId,
        productName: item.productName,
        sku: item.sku ?? "SKU unavailable",
        categoryId: product?.productCategoryId ?? null,
        categoryName,
        quantity: item.quantity,
        valuation: item.valuation,
        threshold,
      };
    });
}

/**
 * Stateless KPI card used across the dashboard summary strip.
 */
function StatCard({ label, value, note, tone = "default" }: StatCardProps) {
  return (
    <div className={`stat-card stat-card--${tone}`}>
      <p className="stat-card__label">{label}</p>
      <h3 className="stat-card__value">{value}</h3>
      <span className="stat-card__note">{note}</span>
    </div>
  );
}

type PlaceholderPageProps = {
  title: string;
  description: string;
};

function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section className="page-panel">
      <div className="page-panel__header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        <div className="page-panel__actions">
          <button type="button" className="secondary-btn">
            Filter
          </button>
          <button type="button" className="primary-btn">
            Add New
          </button>
        </div>
      </div>

      <div className="placeholder-box">
        <p>{title} content will appear here as this area is expanded.</p>
      </div>
    </section>
  );
}

function alertToastTone(alert: AlertRecord): "critical" | "warning" | "info" {
  if (alert.type === "critical_stock") {
    return "critical";
  }

  if (alert.type === "low_stock" || alert.type === "custom") {
    return "warning";
  }

  return "info";
}

function buildAlertToast(alert: AlertRecord): AlertToast {
  const title =
    alert.type === "critical_stock"
      ? "Critical Stock Alert"
      : alert.type === "low_stock"
        ? "Low Stock Alert"
        : "Inventory Alert";
  const subject = alert.productName ? `: ${alert.productName}` : "";

  return {
    id: alert.id,
    title: `${title}${subject}`,
    message:
      alert.message ??
      (alert.currentQuantity !== null && alert.thresholdQuantity !== null
        ? `Current quantity ${alert.currentQuantity} is against threshold ${alert.thresholdQuantity}.`
        : "A new active alert needs attention."),
    tone: alertToastTone(alert),
    status: alert.status,
  };
}

/**
 * Fallback shown while lazy page bundles are being fetched.
 */
function PageSuspenseFallback() {
  return (
    <section className="page-panel">
      <div className="placeholder-box placeholder-box--loading">
        <div className="page-loading-state">
          <div className="page-loading-state__dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <p>Loading page...</p>
        </div>
      </div>
    </section>
  );
}

/**
 * Renders the dashboard once shell-level inventory, category, and metrics data
 * has been loaded and normalized.
 */
function DashboardContent({
  criticalStockThreshold = DEFAULT_CRITICAL_STOCK_THRESHOLD,
  lowStockThreshold = DEFAULT_LOW_STOCK_THRESHOLD,
  onAddProduct,
}: {
  criticalStockThreshold?: number;
  lowStockThreshold?: number;
  onAddProduct?: () => void;
}) {
  const [movementChartMode, setMovementChartMode] =
    useState<MovementChartMode>("bars");
  const [categoryChartMode, setCategoryChartMode] =
    useState<CategoryChartMode>("donut");
  const [movementTimeRange, setMovementTimeRange] =
    useState<MovementTimeRange>(7);
  const [showMovementConfig, setShowMovementConfig] = useState(false);
  const [showCategoryConfig, setShowCategoryConfig] = useState(false);
  const [categoryTopCount, setCategoryTopCount] = useState(3);
  const [hiddenCategoryLabels, setHiddenCategoryLabels] = useState<string[]>([]);
  const [movementTrend, setMovementTrend] = useState<MovementTrendPoint[]>(
    buildEmptyTrendSeries(7),
  );
  const [movementError, setMovementError] = useState<string | null>(null);
  const [movementLoading, setMovementLoading] = useState<boolean>(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryLoading, setCategoryLoading] = useState<boolean>(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [dashboardOverview, setDashboardOverview] =
    useState<InventoryOverviewMetrics>({
      totalSku: 0,
      totalQuantity: 0,
      totalValue: 0,
      criticalCount: 0,
      lowCount: 0,
    });
  const [dashboardCategoryMetrics, setDashboardCategoryMetrics] = useState<
    InventoryCategoryBreakdownMetric[]
  >([]);
  const [dashboardProducts, setDashboardProducts] = useState<Product[]>([]);
  const [dashboardInventory, setDashboardInventory] = useState<InventorySummary[]>([]);
  const [dashboardCategories, setDashboardCategories] = useState<Category[]>([]);
  const [showDashboardFilterModal, setShowDashboardFilterModal] =
    useState(false);
  const [dashboardSearchTerm, setDashboardSearchTerm] = useState("");
  const [dashboardCategoryIds, setDashboardCategoryIds] = useState<string[]>([]);
  const [dashboardStockState, setDashboardStockState] =
    useState<StockStateFilter>("all");
  const [dashboardSortOption, setDashboardSortOption] =
    useState<InventorySortOption>("stock-asc");
  const allDashboardRows = useMemo(
    () =>
      buildDashboardInventoryRows(
        dashboardCategories,
        dashboardProducts,
        dashboardInventory,
        criticalStockThreshold,
        lowStockThreshold,
      ),
    [
      criticalStockThreshold,
      dashboardCategories,
      dashboardInventory,
      dashboardProducts,
      lowStockThreshold,
    ],
  );
  const filteredDashboardRows = useMemo(() => {
    const normalizedSearch = dashboardSearchTerm.trim().toLowerCase();
    const filteredRows = allDashboardRows.filter((row) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        row.productName.toLowerCase().includes(normalizedSearch) ||
        row.sku.toLowerCase().includes(normalizedSearch) ||
        row.categoryName.toLowerCase().includes(normalizedSearch);

      const matchesCategory =
        dashboardCategoryIds.length === 0 ||
        (row.categoryId ? dashboardCategoryIds.includes(row.categoryId) : false);

      const matchesStockState =
        dashboardStockState === "all" ||
        (dashboardStockState === "critical" &&
          row.quantity <= criticalStockThreshold) ||
        (dashboardStockState === "low" &&
          row.quantity > criticalStockThreshold &&
          row.quantity <= lowStockThreshold) ||
        (dashboardStockState === "healthy" && row.quantity > lowStockThreshold);

      return matchesSearch && matchesCategory && matchesStockState;
    });

    return [...filteredRows].sort((left, right) => {
      switch (dashboardSortOption) {
        case "stock-desc":
          return right.quantity - left.quantity;
        case "value-desc":
          return right.valuation - left.valuation;
        case "value-asc":
          return left.valuation - right.valuation;
        case "name-asc":
          return left.productName.localeCompare(right.productName);
        case "name-desc":
          return right.productName.localeCompare(left.productName);
        case "stock-asc":
        default:
          return left.quantity - right.quantity;
      }
    });
  }, [
    allDashboardRows,
    criticalStockThreshold,
    dashboardCategoryIds,
    dashboardSearchTerm,
    dashboardSortOption,
    dashboardStockState,
    lowStockThreshold,
  ]);
  const displayedDashboardRows = useMemo(
    () => filteredDashboardRows.slice(0, 5),
    [filteredDashboardRows],
  );
  const categoryBreakdown = useMemo(
    () =>
      buildCategoryBreakdownFromMetrics(
        dashboardCategoryMetrics,
        categoryTopCount,
        hiddenCategoryLabels,
      ),
    [categoryTopCount, dashboardCategoryMetrics, hiddenCategoryLabels],
  );
  const dashboardStats = useMemo(
    () => buildDashboardStatsFromMetrics(dashboardOverview),
    [dashboardOverview],
  );
  const dashboardFilterCount = [
    dashboardSearchTerm.trim().length > 0,
    dashboardCategoryIds.length > 0,
    dashboardStockState !== "all",
    dashboardSortOption !== "stock-asc",
  ].filter(Boolean).length;
  const movementAnimationProgress = useAnimatedProgress(
    JSON.stringify(movementTrend),
  );
  const summaryAnimationProgress = useAnimatedProgress(
    JSON.stringify({
      categoryBreakdown,
      dashboardStats,
    }),
  );
  const animatedMovementTrend = useMemo(
    () => scaleMovementTrend(movementTrend, movementAnimationProgress),
    [movementAnimationProgress, movementTrend],
  );
  const animatedCategoryBreakdown = useMemo(
    () => scaleCategoryBreakdown(categoryBreakdown, summaryAnimationProgress),
    [categoryBreakdown, summaryAnimationProgress],
  );
  const animatedDashboardStats = useMemo(
    () => scaleDashboardStats(dashboardStats, summaryAnimationProgress),
    [dashboardStats, summaryAnimationProgress],
  );
  const hasMovementData = movementTrend.some(
    (point) => point.inbound > 0 || point.outbound > 0,
  );
  const totalInventoryValue = animatedCategoryBreakdown.reduce(
    (sum, entry) => sum + entry.value,
    0,
  );

  useEffect(() => {
    let cancelled = false;
    const metricsQuery = buildDashboardMetricsQuery(
      {
        q: dashboardSearchTerm,
        categoryIds: dashboardCategoryIds,
        stockState: dashboardStockState,
      },
      { days: String(movementTimeRange) },
    );
    const categoryMetricsQuery = buildDashboardMetricsQuery(
      {
        q: dashboardSearchTerm,
        categoryIds: dashboardCategoryIds,
        stockState: dashboardStockState,
      },
      { top: "10" },
    );
    const overviewQuery = buildDashboardMetricsQuery({
      q: dashboardSearchTerm,
      categoryIds: dashboardCategoryIds,
      stockState: dashboardStockState,
    });

    async function loadMovementTrend() {
      try {
        const payload = await getInventoryMovementTrendMetrics(metricsQuery);

        if (cancelled) {
          return;
        }

        setMovementTrend(
          buildMovementTrendSeriesFromMetrics(payload.trend, movementTimeRange),
        );
        setMovementError(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setMovementTrend(buildEmptyTrendSeries(movementTimeRange));
        setMovementError(
          error instanceof Error
            ? error.message
            : "Failed to load stock movement trend",
        );
      } finally {
        if (!cancelled) {
          setMovementLoading(false);
        }
      }
    }

    async function loadCategoryBreakdown() {
      try {
        const [productsPayload, inventoryPayload, categoriesResult] = await Promise.allSettled([
          listProducts(),
          listInventory(),
          listCategories(),
        ]);

        if (productsPayload.status === "rejected") {
          throw productsPayload.reason;
        }

        if (inventoryPayload.status === "rejected") {
          throw inventoryPayload.reason;
        }

        if (cancelled) {
          return;
        }

        const categories =
          categoriesResult.status === "fulfilled"
            ? categoriesResult.value.categories
            : [];

        setDashboardCategories(categories);
        setDashboardProducts(productsPayload.value.products);
        setDashboardInventory(inventoryPayload.value.inventory);

        setCategoryError(
          categoriesResult.status === "rejected"
            ? categoriesResult.reason instanceof Error
              ? categoriesResult.reason.message
              : "Failed to load categories"
            : null,
        );
      } catch (error) {
        if (cancelled) {
          return;
        }

        setDashboardProducts([]);
        setDashboardInventory([]);
        setDashboardCategories([]);
        setCategoryError(
          error instanceof Error
            ? error.message
            : "Failed to load category valuation breakdown",
        );
      } finally {
        if (!cancelled) {
          setCategoryLoading(false);
        }
      }
    }

    async function loadOverviewMetrics() {
      try {
        const payload = await getInventoryOverviewMetrics(overviewQuery);

        if (cancelled) {
          return;
        }

        setDashboardOverview(payload.overview);
        setOverviewError(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setDashboardOverview({
          totalSku: 0,
          totalQuantity: 0,
          totalValue: 0,
          criticalCount: 0,
          lowCount: 0,
        });
        setOverviewError(
          error instanceof Error
            ? error.message
            : "Failed to load inventory overview metrics",
        );
      }
    }

    async function loadCategoryMetrics() {
      try {
        const payload = await getInventoryCategoryBreakdownMetrics(
          categoryMetricsQuery,
        );

        if (cancelled) {
          return;
        }

        setDashboardCategoryMetrics(payload.categories);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setDashboardCategoryMetrics([]);
        setCategoryError(
          error instanceof Error
            ? error.message
            : "Failed to load category breakdown metrics",
        );
      }
    }

    void loadMovementTrend();
    void loadCategoryBreakdown();
    void loadOverviewMetrics();
    void loadCategoryMetrics();

    return () => {
      cancelled = true;
    };
  }, [
    dashboardCategoryIds,
    dashboardSearchTerm,
    dashboardStockState,
    movementTimeRange,
  ]);

  const dashboardCategoryOptions = useMemo(
    () =>
      [...dashboardCategories].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    [dashboardCategories],
  );

  const categoryLabels = useMemo(
    () =>
      Array.from(
        new Set(allDashboardRows.map((row) => row.categoryName || "Uncategorized")),
      ).sort((left, right) => left.localeCompare(right)),
    [allDashboardRows],
  );

  const toggleDashboardCategory = (categoryId: string) => {
    setDashboardCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  };

  const resetDashboardFilters = () => {
    setDashboardSearchTerm("");
    setDashboardCategoryIds([]);
    setDashboardStockState("all");
    setDashboardSortOption("stock-asc");
  };

  const toggleHiddenCategoryLabel = (label: string) => {
    setHiddenCategoryLabels((current) =>
      current.includes(label)
        ? current.filter((entry) => entry !== label)
        : [...current, label],
    );
  };

  return (
    <section className="page-panel">
      <div className="page-panel__header">
        <div className="page-panel__title-stack">
          <h2>Dashboard</h2>
          <p>Track stock, movement, valuation, and replenishment from one view.</p>
        </div>

        <div className="page-panel__actions">
          <button
            type="button"
            className="secondary-btn flex items-center gap-2"
            onClick={() => setShowDashboardFilterModal(true)}
          >
            <span className="material-symbols-outlined">filter_list</span>
            Filters
            {dashboardFilterCount > 0 ? (
              <span className="btn-filter__count">{dashboardFilterCount}</span>
            ) : null}
          </button>
          <button
            type="button"
            className="primary-btn flex items-center gap-2"
            onClick={onAddProduct}
          >
            <span className="material-symbols-outlined">add</span>
            Add Product
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          label="Total SKU"
          value={formatWholeNumber(animatedDashboardStats.totalSku)}
          note={
            overviewError
              ? `Overview unavailable: ${overviewError}`
              : "Distinct products in this organization"
          }
        />
        <StatCard
          label="Critical Stock"
          value={formatWholeNumber(animatedDashboardStats.criticalStockCount)}
          note={`Quantity at or below ${criticalStockThreshold}`}
          tone="danger"
        />
        <StatCard
          label="Low Stock"
          value={formatWholeNumber(animatedDashboardStats.lowStockCount)}
          note={`Quantity between ${criticalStockThreshold + 1} and ${lowStockThreshold}`}
          tone="warning"
        />
        <StatCard
          label="Inventory Value"
          value={formatCompactCurrency(animatedDashboardStats.inventoryValue)}
          note="Live valuation from quantity x unit cost"
        />
      </div>

      <section className="dashboard-insights-grid">
        <section className="movement-chart-card">
          <div className="movement-chart-card__header">
            <div>
              <p className="movement-chart-card__eyebrow">Movement Analytics</p>
              <h3>Stock movement over time</h3>
              <p>
                {movementLoading
                  ? "Loading movement activity."
                  : hasMovementData
                    ? "Inbound and outbound quantities grouped by day."
                    : "No stock movement has been recorded yet."}
              </p>
            </div>

            <div className="movement-chart-card__controls">
              <div className="movement-chart-card__legend">
                <span><i className="movement-chart-card__dot movement-chart-card__dot--inbound" />Inbound</span>
                <span><i className="movement-chart-card__dot movement-chart-card__dot--outbound" />Outbound</span>
              </div>
              <button
                type="button"
                className="panel-config-btn"
                onClick={() => setShowMovementConfig((current) => !current)}
                aria-label="Configure movement chart"
                aria-expanded={showMovementConfig}
              >
                <span className="material-symbols-outlined">tune</span>
              </button>
            </div>
          </div>

          <div className="movement-chart-card__toolbar">
            <span className="movement-chart-card__range-label">
              Showing last {movementTimeRange} days in {movementChartMode === "bars" ? "bar" : "line"} view
            </span>
          </div>

          {showMovementConfig ? (
            <div className="panel-config-sheet">
              <div className="panel-config-sheet__group">
                <span>Display</span>
                <div className="movement-chart-toggle">
                  <button
                    type="button"
                    className={`movement-chart-toggle__btn ${
                      movementChartMode === "bars" ? "movement-chart-toggle__btn--active" : ""
                    }`}
                    onClick={() => setMovementChartMode("bars")}
                  >
                    Bars
                  </button>
                  <button
                    type="button"
                    className={`movement-chart-toggle__btn ${
                      movementChartMode === "line" ? "movement-chart-toggle__btn--active" : ""
                    }`}
                    onClick={() => setMovementChartMode("line")}
                  >
                    Line
                  </button>
                </div>
              </div>

              <div className="panel-config-sheet__group">
                <span>Time Window</span>
                <div className="panel-chip-row">
                  {[7, 14, 30].map((range) => (
                    <button
                      key={range}
                      type="button"
                      className={`panel-chip ${
                        movementTimeRange === range ? "panel-chip--active" : ""
                      }`}
                      onClick={() => setMovementTimeRange(range as MovementTimeRange)}
                    >
                      {range} days
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="movement-chart-shell">
            <ResponsiveContainer width="100%" height={260}>
              {movementChartMode === "bars" ? (
                <BarChart
                  data={animatedMovementTrend}
                  margin={{ top: 8, right: 6, left: 4, bottom: 0 }}
                  barGap={8}
                >
                  <defs>
                    <linearGradient id="movementInboundBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6976ef" />
                      <stop offset="100%" stopColor="#4a52d1" />
                    </linearGradient>
                    <linearGradient id="movementOutboundBar" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c3ccda" />
                      <stop offset="100%" stopColor="#94a0b6" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#eef2f7" strokeDasharray="4 6" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#79839a", fontSize: 12, fontWeight: 700 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#98a2b3", fontSize: 12, fontWeight: 600 }}
                    tickFormatter={(value) => formatCompactQuantity(Number(value))}
                    width={64}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(105, 118, 239, 0.06)" }}
                    formatter={(value) => formatWholeNumber(Number(value))}
                    contentStyle={{
                      borderRadius: 16,
                      border: "1px solid rgba(226, 232, 240, 0.9)",
                      background: "rgba(255, 255, 255, 0.94)",
                      boxShadow: "0 18px 40px rgba(30, 52, 109, 0.14)",
                    }}
                  />
                  <Bar dataKey="inbound" fill="url(#movementInboundBar)" radius={[999, 999, 8, 8]} />
                  <Bar dataKey="outbound" fill="url(#movementOutboundBar)" radius={[999, 999, 8, 8]} />
                </BarChart>
              ) : (
                <ComposedChart
                  data={animatedMovementTrend}
                  margin={{ top: 8, right: 6, left: 4, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="movementInboundLine" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#6976ef" />
                      <stop offset="100%" stopColor="#4a52d1" />
                    </linearGradient>
                    <linearGradient id="movementOutboundLine" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#9aa6bf" />
                      <stop offset="100%" stopColor="#78849d" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#eef2f7" strokeDasharray="4 6" />
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#79839a", fontSize: 12, fontWeight: 700 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#98a2b3", fontSize: 12, fontWeight: 600 }}
                    tickFormatter={(value) => formatCompactQuantity(Number(value))}
                    width={64}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ stroke: "rgba(105, 118, 239, 0.14)", strokeWidth: 1 }}
                    formatter={(value) => formatWholeNumber(Number(value))}
                    contentStyle={{
                      borderRadius: 16,
                      border: "1px solid rgba(226, 232, 240, 0.9)",
                      background: "rgba(255, 255, 255, 0.94)",
                      boxShadow: "0 18px 40px rgba(30, 52, 109, 0.14)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="inbound"
                    stroke="url(#movementInboundLine)"
                    strokeWidth={3}
                    dot={{ r: 0 }}
                    activeDot={{ r: 5, fill: "#4a52d1", stroke: "#ffffff", strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="outbound"
                    stroke="url(#movementOutboundLine)"
                    strokeWidth={3}
                    dot={{ r: 0 }}
                    activeDot={{ r: 5, fill: "#78849d", stroke: "#ffffff", strokeWidth: 2 }}
                  />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>

          {movementError ? (
            <p className="movement-chart__status movement-chart__status--error">
              Movement data is currently unavailable: {movementError}
            </p>
          ) : null}

          {!movementLoading && !hasMovementData ? (
            <p className="movement-chart__status">
              Record your first inventory change to populate the activity trend.
            </p>
          ) : null}
        </section>

        <section className="category-breakdown-card">
          <div className="category-breakdown-card__header">
            <div>
              <h3>Category Breakdown</h3>
              <p>
                {categoryLoading
                  ? "Loading stock valuation by category."
                  : categoryBreakdown.length > 0
                    ? "Live inventory valuation grouped by product category."
                    : "No category valuation available for this organization."}
              </p>
            </div>

            <div className="movement-chart-card__controls">
              <span className="movement-chart-card__range-label">
                {categoryChartMode === "donut" ? "Donut" : "Pie"} view
              </span>
              <button
                type="button"
                className="panel-config-btn"
                onClick={() => setShowCategoryConfig((current) => !current)}
                aria-label="Configure category chart"
                aria-expanded={showCategoryConfig}
              >
                <span className="material-symbols-outlined">tune</span>
              </button>
            </div>
          </div>

          {showCategoryConfig ? (
            <div className="panel-config-sheet panel-config-sheet--category">
              <div className="panel-config-sheet__group">
                <span>Top Categories</span>
                <div className="panel-chip-row">
                  {[3, 4, 5].map((count) => (
                    <button
                      key={count}
                      type="button"
                      className={`panel-chip ${
                        categoryTopCount === count ? "panel-chip--active" : ""
                      }`}
                      onClick={() => setCategoryTopCount(count)}
                    >
                      Top {count}
                    </button>
                  ))}
                </div>
              </div>

              <div className="panel-config-sheet__group">
                <span>Hide Categories</span>
                <div className="panel-chip-row">
                  {categoryLabels.map((label) => (
                    <button
                      key={label}
                      type="button"
                      className={`panel-chip ${
                        hiddenCategoryLabels.includes(label)
                          ? "panel-chip--muted"
                          : ""
                      }`}
                      onClick={() => toggleHiddenCategoryLabel(label)}
                    >
                      {hiddenCategoryLabels.includes(label) ? `Show ${label}` : `Hide ${label}`}
                    </button>
                  ))}
                  {categoryLabels.length === 0 ? (
                    <span className="dashboard-filter-empty">No categories to configure.</span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          <div className="category-breakdown-card__body">
            <div className="category-breakdown-card__donut-wrap">
              <div className="category-breakdown-card__chart-shell" aria-label="Category stock value breakdown">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Tooltip
                      formatter={(value) =>
                        formatCompactCurrency(typeof value === "number" ? value : Number(value ?? 0))
                      }
                      contentStyle={{
                        borderRadius: 16,
                        border: "1px solid rgba(226, 232, 240, 0.9)",
                        background: "rgba(255, 255, 255, 0.94)",
                        boxShadow: "0 18px 40px rgba(30, 52, 109, 0.14)",
                      }}
                    />
                    <Pie
                      data={animatedCategoryBreakdown}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={categoryChartMode === "donut" ? 62 : 0}
                      outerRadius={92}
                      paddingAngle={animatedCategoryBreakdown.length > 1 ? 3 : 0}
                      stroke="rgba(255,255,255,0.92)"
                      strokeWidth={2}
                    >
                      {animatedCategoryBreakdown.map((entry) => (
                        <Cell
                          key={entry.label}
                          fill={CATEGORY_SWATCH_COLORS[entry.colorClass]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>

                {categoryChartMode === "donut" ? (
                  <div className="category-breakdown-card__donut-center">
                    <strong>{formatCompactCurrency(totalInventoryValue)}</strong>
                    <span>Value</span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="category-breakdown-card__legend">
              {animatedCategoryBreakdown.map((entry) => (
                <div key={entry.label} className="category-breakdown-card__legend-item">
                  <span className={`category-breakdown__swatch ${entry.colorClass}`} />
                  <span className="category-breakdown-card__legend-label">{entry.label}</span>
                  <strong>{Math.round(entry.share)}%</strong>
                </div>
              ))}
            </div>
          </div>

          {categoryError ? (
            <p className="movement-chart__status movement-chart__status--error">
              Category breakdown is currently unavailable: {categoryError}
            </p>
          ) : null}

          {!categoryLoading && categoryBreakdown.length === 0 ? (
            <p className="movement-chart__status">
              Add products with categories and inventory to populate the valuation breakdown.
            </p>
          ) : null}
        </section>
      </section>

      <div className="table-card">
        <div className="table-card__header">
          <span>Product Name</span>
          <span>SKU</span>
          <span>Category</span>
          <span>Stock Level</span>
          <span>Total Value</span>
          <span>Threshold</span>
        </div>

        {displayedDashboardRows.length > 0 ? (
          displayedDashboardRows.map((row) => {
            const quantityClassName =
              row.quantity <= criticalStockThreshold
                ? "danger-text"
                : row.quantity <= lowStockThreshold
                  ? "warning-text"
                  : "success-text";

            return (
              <div key={row.productId} className="table-card__row">
                <span>{row.productName}</span>
                <span>{row.sku}</span>
                <span>{row.categoryName}</span>
                <span className={quantityClassName}>{formatWholeNumber(row.quantity)}</span>
                <span>{formatCompactCurrency(row.valuation)}</span>
                <span>{formatWholeNumber(row.threshold)}</span>
              </div>
            );
          })
        ) : (
          <div className="table-card__row">
            <span>
              {allDashboardRows.length === 0
                ? "No products available yet"
                : "No products match the current dashboard filters"}
            </span>
            <span>-</span>
            <span>-</span>
            <span>0</span>
            <span>$0.00</span>
            <span>-</span>
          </div>
        )}
      </div>

      {showDashboardFilterModal ? (
        <div
          className="dashboard-filter-backdrop"
          onClick={() => setShowDashboardFilterModal(false)}
        >
          <div
            className="dashboard-filter-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="dashboard-filter-sheet__header">
              <div>
                <h3>Dashboard Filters</h3>
                <p>Refine the summary table by category, stock state, and ordering.</p>
              </div>
              <button
                type="button"
                className="dashboard-filter-sheet__close"
                onClick={() => setShowDashboardFilterModal(false)}
                aria-label="Close dashboard filters"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="dashboard-filter-sheet__body">
              <div className="dashboard-filter-group">
                <label htmlFor="dashboard-stock-state">Stock State</label>
                <select
                  id="dashboard-stock-state"
                  value={dashboardStockState}
                  onChange={(event) =>
                    setDashboardStockState(
                      event.target.value as StockStateFilter,
                    )
                  }
                >
                  <option value="all">All stock states</option>
                  <option value="critical">Critical only</option>
                  <option value="low">Low stock only</option>
                  <option value="healthy">Healthy stock only</option>
                </select>
              </div>

              <div className="dashboard-filter-group">
                <label htmlFor="dashboard-sort-option">Sort By</label>
                <select
                  id="dashboard-sort-option"
                  value={dashboardSortOption}
                  onChange={(event) =>
                    setDashboardSortOption(
                      event.target.value as InventorySortOption,
                    )
                  }
                >
                  <option value="stock-asc">Stock lowest first</option>
                  <option value="stock-desc">Stock highest first</option>
                  <option value="value-desc">Value highest first</option>
                  <option value="value-asc">Value lowest first</option>
                  <option value="name-asc">Name A-Z</option>
                  <option value="name-desc">Name Z-A</option>
                </select>
              </div>

              <div className="dashboard-filter-group">
                <label>Categories</label>
                <div className="dashboard-filter-pills">
                  {dashboardCategoryOptions.map((category) => {
                    const isActive = dashboardCategoryIds.includes(category.id);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        className={`dashboard-filter-pill ${
                          isActive ? "dashboard-filter-pill--active" : ""
                        }`}
                        onClick={() => toggleDashboardCategory(category.id)}
                      >
                        {category.name}
                      </button>
                    );
                  })}
                  {dashboardCategoryOptions.length === 0 ? (
                    <span className="dashboard-filter-empty">
                      No categories available yet.
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="dashboard-filter-sheet__footer">
              <button
                type="button"
                className="secondary-btn"
                onClick={resetDashboardFilters}
              >
                Reset
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={() => setShowDashboardFilterModal(false)}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}


type AppLayoutProps = {
  account?: BackendAuthAccount | null;
  userEmail?: string;
  onSignOut?: () => void;
  onAccountUpdate?: (account: BackendAuthAccount) => void;
};

function formatOrganizationLabel(
  account?: BackendAuthAccount | null,
  organization?: OrganizationSummary | null,
): string {
  if (organization?.name?.trim()) {
    return organization.name;
  }

  if (!account?.orgId) {
    return "Workspace";
  }

  return `Org ${account.orgId.slice(0, 8)}`;
}

export default function AppLayout({
  account = null,
  userEmail = "",
  onSignOut,
  onAccountUpdate,
}: AppLayoutProps) {
  const [activePage, setActivePage] = useState<PageName>("Dashboard");
  const [openProductCreateRequestKey, setOpenProductCreateRequestKey] = useState(0);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) !== "true";
  });
  const [onboardingStepIndex, setOnboardingStepIndex] = useState(0);
  const [organization, setOrganization] = useState<OrganizationSummary | null>(
    () => getStoredOrganizationSummary(),
  );
  const [alertToasts, setAlertToasts] = useState<AlertToast[]>([]);
  const knownAlertIdsRef = useRef<Set<string>>(new Set());
  const hasPrimedAlertPollRef = useRef(false);
  const toastTimeoutsRef = useRef<Map<string, number>>(new Map());
  const criticalStockThreshold =
    organization?.criticalStockThreshold ?? DEFAULT_CRITICAL_STOCK_THRESHOLD;
  const lowStockThreshold =
    organization?.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
  const organizationLabel = formatOrganizationLabel(account, organization);
  const operatorLabel = userEmail || account?.username || "Authenticated user";
  const headerTitle =
    activePage === "Dashboard" ? "Inventory Overview" : activePage;
  const onboardingStep = ONBOARDING_STEPS[onboardingStepIndex];

  const closeOnboarding = (persist = true) => {
    setShowOnboarding(false);
    if (persist && typeof window !== "undefined") {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    }
  };

  const openOnboarding = () => {
    setOnboardingStepIndex(0);
    setShowOnboarding(true);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadCurrentOrganization() {
      if (!account) {
        setOrganization(null);
        return;
      }

      try {
        const payload = await getMyOrganization();

        if (!cancelled) {
          setOrganization(payload.organization);
          cacheOrganizationSummary(payload.organization);
        }
      } catch {
        if (!cancelled) {
          setOrganization(null);
          cacheOrganizationSummary(null);
        }
      }
    }

    void loadCurrentOrganization();

    return () => {
      cancelled = true;
    };
  }, [account?.id, account?.orgId]);

  useEffect(() => {
    return () => {
      for (const timeoutId of toastTimeoutsRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      toastTimeoutsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!account?.id || !account?.orgId) {
      knownAlertIdsRef.current.clear();
      hasPrimedAlertPollRef.current = false;
      setAlertToasts([]);
      return;
    }

    let cancelled = false;

    const dismissToast = (toastId: string) => {
      setAlertToasts((current) => current.filter((toast) => toast.id !== toastId));
      const timeoutId = toastTimeoutsRef.current.get(toastId);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        toastTimeoutsRef.current.delete(toastId);
      }
    };

    const queueToast = (toast: AlertToast) => {
      setAlertToasts((current) => {
        if (current.some((entry) => entry.id === toast.id)) {
          return current;
        }

        return [toast, ...current].slice(0, 4);
      });

      if (toast.tone !== "critical") {
        const existingTimeoutId = toastTimeoutsRef.current.get(toast.id);
        if (existingTimeoutId) {
          window.clearTimeout(existingTimeoutId);
        }

        const timeoutId = window.setTimeout(() => {
          dismissToast(toast.id);
        }, 8000);

        toastTimeoutsRef.current.set(toast.id, timeoutId);
      }
    };

    async function pollAlerts() {
      try {
        const payload = await listAlerts("status=active&limit=20&offset=0");

        if (cancelled) {
          return;
        }

        const activeIds = new Set(payload.alerts.map((alert) => alert.id));

        if (!hasPrimedAlertPollRef.current) {
          knownAlertIdsRef.current = activeIds;
          hasPrimedAlertPollRef.current = true;
          return;
        }

        for (const alert of payload.alerts) {
          if (!knownAlertIdsRef.current.has(alert.id)) {
            queueToast(buildAlertToast(alert));
          }
        }

        knownAlertIdsRef.current = activeIds;
      } catch {
        if (!cancelled) {
          hasPrimedAlertPollRef.current = true;
        }
      }
    }

    void pollAlerts();
    const intervalId = window.setInterval(() => {
      void pollAlerts();
    }, ALERT_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [account?.id, account?.orgId]);

  const pageContent = useMemo(() => {
    switch (activePage) {
      case "Dashboard":
        return (
          <DashboardContent
            criticalStockThreshold={criticalStockThreshold}
            lowStockThreshold={lowStockThreshold}
            onAddProduct={() => {
              setActivePage("Products");
              setOpenProductCreateRequestKey((current) => current + 1);
            }}
          />
        );
      case "Products":
        return (
          <ProductsPage
            criticalThreshold={criticalStockThreshold}
            lowThreshold={lowStockThreshold}
            openCreateRequestKey={openProductCreateRequestKey}
          />
        );
      case "Inventory Operations":
        return <InventoryOperationsPage />;
      case "Movement Logs":
        return <MovementLogsPage />;
      case "Inventory Adjustment":
        return <InventoryAdjustmentPage />;
      case "Metrics":
        return (
          <MetricsPage
            criticalThreshold={criticalStockThreshold}
            lowThreshold={lowStockThreshold}
          />
        );
      case "Alerts":
        return <AlertsPage />;
      case "Organization":
        return (
          <OrganizationPage
            organization={organization}
            onOrganizationUpdate={(updatedOrganization) => {
              setOrganization(updatedOrganization);
              cacheOrganizationSummary(updatedOrganization);
            }}
            onAccountUpdate={onAccountUpdate}
            onOrganizationDelete={() => {
              setOrganization(null);
              cacheOrganizationSummary(null);
            }}
          />
        );
      case "User Management":
        return <UserManagementPage />;
      case "Profile":
        return (
          <ProfilePage
            account={account}
            userEmail={userEmail}
            onAccountUpdate={onAccountUpdate}
            onSignOut={onSignOut}
          />
        );
      case "Settings":
        return <SettingsPage onSignOut={onSignOut} />;
      default:
        return null;
    }
  }, [
    account,
    activePage,
    criticalStockThreshold,
    lowStockThreshold,
    onAccountUpdate,
    organization,
    userEmail,
  ]);

  return (
    <div className="app-shell">
      <Sidebar
        activeItem={activePage}
        onSelect={setActivePage}
        onSignOut={onSignOut}
      />

      <main className="app-main">
        <header className="app-header">
          <div className="app-header__copy">
            <div className="app-header__title-row">
              <button
                type="button"
                className="app-header__help-btn"
                onClick={openOnboarding}
                aria-label="Open guide"
                title="Open guide"
              >
                ?
              </button>
              <h1>{headerTitle}</h1>
            </div>
          </div>

          <div className="app-header__meta">
            <div className="app-header__pills">
              <span className="app-header__pill app-header__pill--org">
                {organizationLabel}
              </span>
              <span className="app-header__pill">{operatorLabel}</span>
            </div>

            <div className="app-header__search">
              <input type="text" placeholder="Search products, SKUs, categories..." />
            </div>
          </div>
        </header>

        <Suspense fallback={<PageSuspenseFallback />}>
          {pageContent}
        </Suspense>
      </main>

      {showOnboarding ? (
        <div className="onboarding-overlay" role="presentation">
          <section
            className="onboarding-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Product guide"
          >
            <div className="onboarding-panel__header">
              <div>
                <span className="onboarding-panel__eyebrow">
                  Step {onboardingStepIndex + 1} of {ONBOARDING_STEPS.length}
                </span>
                <h2>{onboardingStep.title}</h2>
              </div>
              <button
                type="button"
                className="onboarding-panel__close"
                onClick={() => closeOnboarding(true)}
                aria-label="Close onboarding"
              >
                ×
              </button>
            </div>

            <div className="onboarding-panel__body">
              <p>{onboardingStep.body}</p>
              <div className="onboarding-panel__hint">
                <strong>Recommended</strong>
                <span>{onboardingStep.hint}</span>
              </div>
            </div>

            <div className="onboarding-panel__footer">
              <button
                type="button"
                className="secondary-btn"
                onClick={() =>
                  setOnboardingStepIndex((current) => Math.max(0, current - 1))
                }
                disabled={onboardingStepIndex === 0}
              >
                Back
              </button>
              <div className="onboarding-panel__actions">
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => closeOnboarding(true)}
                >
                  Skip
                </button>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => {
                    if (onboardingStepIndex === ONBOARDING_STEPS.length - 1) {
                      closeOnboarding(true);
                      return;
                    }

                    setOnboardingStepIndex((current) => current + 1);
                  }}
                >
                  {onboardingStepIndex === ONBOARDING_STEPS.length - 1
                    ? "Finish"
                    : "Next"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {alertToasts.length > 0 ? (
        <div className="page-toast-stack">
          {alertToasts.map((toast) => (
            <div
              key={toast.id}
              className={`page-toast page-toast--alert page-toast--${toast.tone}`}
              role="alert"
            >
              <div className="page-toast__content">
                <strong>{toast.title}</strong>
                <span>{toast.message}</span>
                <div className="page-toast__actions">
                  <button
                    type="button"
                    className="page-toast__action"
                    onClick={() => {
                      setActivePage("Alerts");
                      setAlertToasts((current) =>
                        current.filter((entry) => entry.id !== toast.id),
                      );
                      const timeoutId = toastTimeoutsRef.current.get(toast.id);
                      if (timeoutId) {
                        window.clearTimeout(timeoutId);
                        toastTimeoutsRef.current.delete(toast.id);
                      }
                    }}
                  >
                    View
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="page-toast__dismiss"
                onClick={() => {
                  setAlertToasts((current) =>
                    current.filter((entry) => entry.id !== toast.id),
                  );
                  const timeoutId = toastTimeoutsRef.current.get(toast.id);
                  if (timeoutId) {
                    window.clearTimeout(timeoutId);
                    toastTimeoutsRef.current.delete(toast.id);
                  }
                }}
                aria-label="Dismiss alert notification"
              >
                ×
              </button>
              {toast.tone !== "critical" ? (
                <div className="page-toast__progress" aria-hidden="true" />
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
