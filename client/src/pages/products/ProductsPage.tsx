/**
 * Product catalog workspace with filtering, category management, image upload,
 * and create/edit flows.
 */
import { useEffect, useState, useMemo, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import GlassDialog from "../../components/GlassDialog";
import {
  listProducts,
  listInventory,
  listCategories,
  createCategory,
  createProductImageUploadPresign,
  createProduct,
  updateProduct,
  type Product,
  type InventorySummary,
  type Category,
} from "../../services/api.service";
import "./products-page.css";

type ProductsPageProps = {
  criticalThreshold?: number;
  lowThreshold?: number;
  openCreateRequestKey?: number;
};

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  imageUrl: string | null;
  categoryId: string | null;
  category: string;
  quantity: number;
  unitCost: number;
  valuation: number;
  threshold: number;
};

type StockStateFilter = "all" | "critical" | "low" | "healthy";
type ProductSortOption =
  | "name-asc"
  | "name-desc"
  | "stock-desc"
  | "stock-asc"
  | "value-desc"
  | "value-asc";

function formatProductValue(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

/**
 * Displays the product catalog and owns the modal workflows for product and
 * category creation.
 */
export default function ProductsPage({
  criticalThreshold = 10,
  lowThreshold = 25,
  openCreateRequestKey = 0,
}: ProductsPageProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventorySummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [stockStateFilter, setStockStateFilter] =
    useState<StockStateFilter>("all");
  const [sortOption, setSortOption] =
    useState<ProductSortOption>("name-asc");

  // Embla setup
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 6000, stopOnInteraction: true })]);

  // Form state
  const [formName, setFormName] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formUnitCost, setFormUnitCost] = useState(0);
  const [formDescription, setFormDescription] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [formImagePreviewUrl, setFormImagePreviewUrl] = useState<string | null>(
    null,
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [dialogMessage, setDialogMessage] = useState<string | null>(null);

  const onSelect = useCallback((emblaApi: any) => {
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect(emblaApi);
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
  }, [emblaApi, onSelect]);

  const scrollTo = useCallback((index: number) => emblaApi && emblaApi.scrollTo(index), [emblaApi]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, invRes, catRes] = await Promise.all([
        listProducts("limit=200"),
        listInventory(),
        listCategories(),
      ]);
      setProducts(prodRes.products);
      setInventory(invRes.inventory);
      setCategories(catRes.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (openCreateRequestKey > 0) {
      handleOpenCreate();
    }
  }, [openCreateRequestKey]);

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
    return () => {
      if (formImagePreviewUrl) {
        URL.revokeObjectURL(formImagePreviewUrl);
      }
    };
  }, [formImagePreviewUrl]);

  const productRows = useMemo(() => {
    const invMap = new Map(inventory.map((item) => [item.productId, item]));
    const catMap = new Map(categories.map((cat) => [cat.id, cat.name]));

    return products.map((p): ProductRow => {
      const inv = invMap.get(p.id);
      return {
        id: p.id,
        name: p.name,
        sku: p.sku || "N/A",
        imageUrl: p.imageUrl,
        categoryId: p.productCategoryId || null,
        category: p.productCategoryId ? catMap.get(p.productCategoryId) || "Unknown" : "Uncategorized",
        quantity: inv?.quantity || 0,
        unitCost: p.unitCost,
        valuation: inv?.valuation || 0,
        threshold:
          inv?.quantity && inv.quantity <= criticalThreshold
            ? criticalThreshold
            : lowThreshold,
      };
    });
  }, [categories, criticalThreshold, inventory, lowThreshold, products]);

  const filteredProductRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const rows = productRows.filter((row) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        row.name.toLowerCase().includes(normalizedSearch) ||
        row.sku.toLowerCase().includes(normalizedSearch) ||
        row.category.toLowerCase().includes(normalizedSearch);

      const matchesCategory =
        selectedCategoryIds.length === 0 ||
        (row.categoryId ? selectedCategoryIds.includes(row.categoryId) : false);

      const matchesStockState =
        stockStateFilter === "all" ||
        (stockStateFilter === "critical" && row.quantity <= criticalThreshold) ||
        (stockStateFilter === "low" &&
          row.quantity > criticalThreshold &&
          row.quantity <= lowThreshold) ||
        (stockStateFilter === "healthy" && row.quantity > lowThreshold);

      return matchesSearch && matchesCategory && matchesStockState;
    });

    return [...rows].sort((left, right) => {
      switch (sortOption) {
        case "name-desc":
          return right.name.localeCompare(left.name);
        case "stock-desc":
          return right.quantity - left.quantity;
        case "stock-asc":
          return left.quantity - right.quantity;
        case "value-desc":
          return right.valuation - left.valuation;
        case "value-asc":
          return left.valuation - right.valuation;
        case "name-asc":
        default:
          return left.name.localeCompare(right.name);
      }
    });
  }, [
    criticalThreshold,
    lowThreshold,
    productRows,
    searchTerm,
    selectedCategoryIds,
    sortOption,
    stockStateFilter,
  ]);

  const stats = useMemo(() => {
    const totalSku = filteredProductRows.length;
    const critical = filteredProductRows.filter((r) => r.quantity <= criticalThreshold).length;
    const low = filteredProductRows.filter((r) => r.quantity > criticalThreshold && r.quantity <= lowThreshold).length;
    const totalValue = filteredProductRows.reduce((sum, r) => sum + r.valuation, 0);

    return { totalSku, critical, low, totalValue };
  }, [criticalThreshold, filteredProductRows, lowThreshold]);

  const activeFilterCount = [
    searchTerm.trim().length > 0,
    selectedCategoryIds.length > 0,
    stockStateFilter !== "all",
    sortOption !== "name-asc",
  ].filter(Boolean).length;

  const categoryOptions = useMemo(
    () => [...categories].sort((left, right) => left.name.localeCompare(right.name)),
    [categories],
  );

  const closeProductModal = () => {
    setShowModal(false);
    setFormImageFile(null);
    if (formImagePreviewUrl) {
      URL.revokeObjectURL(formImagePreviewUrl);
    }
    setFormImagePreviewUrl(null);
  };

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setFormName("");
    setFormSku("");
    setFormImageUrl("");
    setFormImageFile(null);
    if (formImagePreviewUrl) {
      URL.revokeObjectURL(formImagePreviewUrl);
    }
    setFormImagePreviewUrl(null);
    setFormCategoryId("");
    setFormUnitCost(0);
    setFormDescription("");
    setShowCreateCategory(false);
    setCategoryName("");
    setShowModal(true);
  };

  const toggleCategoryFilter = (categoryId: string) => {
    setSelectedCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSelectedCategoryIds([]);
    setStockStateFilter("all");
    setSortOption("name-asc");
  };

  const handleOpenEdit = (product: ProductRow) => {
    const original = products.find((p) => p.id === product.id);
    if (!original) return;
    setEditingProduct(original);
    setFormName(original.name);
    setFormSku(original.sku || "");
    setFormImageUrl(original.imageUrl || "");
    setFormImageFile(null);
    if (formImagePreviewUrl) {
      URL.revokeObjectURL(formImagePreviewUrl);
    }
    setFormImagePreviewUrl(null);
    setFormCategoryId(original.productCategoryId || "");
    setFormUnitCost(original.unitCost);
    setFormDescription(original.description || "");
    setShowCreateCategory(false);
    setCategoryName("");
    setShowModal(true);
  };

  const handleCreateCategory = async () => {
    if (!categoryName.trim()) {
      setError("Category name is required");
      return;
    }

    setCreatingCategory(true);

    try {
      const response = await createCategory({
        name: categoryName.trim(),
        parentId: null,
      });

      setCategories((current) => [...current, response.category]);
      setFormCategoryId(response.category.id);
      setCategoryName("");
      setShowCreateCategory(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create category");
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUploadingImage(Boolean(formImageFile));

      let imageObjectKey: string | null | undefined;

      if (formImageFile) {
        const presignedUpload = await createProductImageUploadPresign({
          filename: formImageFile.name,
          contentType: formImageFile.type,
        });

        const uploadResponse = await fetch(presignedUpload.uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": formImageFile.type,
          },
          body: formImageFile,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload product image");
        }

        imageObjectKey = presignedUpload.objectKey;
      } else if (!editingProduct) {
        imageObjectKey = null;
      } else if (!formImageUrl) {
        imageObjectKey = null;
      }

      const payload = {
        name: formName,
        sku: formSku || null,
        imageObjectKey,
        productCategoryId: formCategoryId || null,
        unitCost: Number(formUnitCost),
        description: formDescription || null,
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, payload);
      } else {
        await createProduct(payload);
      }
      closeProductModal();
      setFormImageUrl("");
      loadData();
    } catch (err) {
      setDialogMessage(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setUploadingImage(false);
    }
  };

  const hints = [
    {
      title: "Stock Optimization Hint",
      text: "Your Photography category shows high turnover. Consider increasing the default threshold for 'Lens' items to 40 units.",
      icon: "insights"
    },
    {
      title: "Value Distribution Insight",
      text: "Electronics currently represent 64% of your total inventory value. Review high-cost items for potential insurance adjustment.",
      icon: "account_balance"
    },
    {
      title: "Logistics Optimization",
      text: "Outbound movements peaked on Thursday. Plan for extra staffing during mid-week cycles to ensure zero fulfillment delay.",
      icon: "local_shipping"
    }
  ];

  if (loading && products.length === 0) {
    return (
      <div className="page-panel">
        <div className="products-loading-card">
          <div className="products-loading-card__dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <h3>Loading catalog</h3>
          <p>
            Fetching products, categories, and current inventory balances.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-panel products-page-container">
      {/* Header Section */}
      <header className="products-page-header">
        <div className="products-page-header__title">
          <h2>Catalog Management</h2>
          <p>Manage products, categories, stock position, and inventory value.</p>
        </div>
        <div className="products-page-actions">
          <button className="btn-filter" type="button" onClick={() => setShowFilterModal(true)}>
            <span className="material-symbols-outlined">filter_list</span>
            Filters
            {activeFilterCount > 0 ? (
              <span className="btn-filter__count">{activeFilterCount}</span>
            ) : null}
          </button>
          <button className="btn-add-product" type="button" onClick={handleOpenCreate}>
            <span className="material-symbols-outlined">add</span>
            Add Product
          </button>
        </div>
      </header>

      {/* Stats Section */}
      <div className="products-stats-grid">
        <div className="product-stat-card">
          <div className="product-stat-card__eyebrow">Total SKU</div>
          <div className="product-stat-card__value">{stats.totalSku}</div>
          <div className="product-stat-card__note" style={{ color: "#059669" }}>
            <span className="material-symbols-outlined text-sm">trending_up</span>
            +2.4% vs last month
          </div>
        </div>
        <div className="product-stat-card">
          <div className="product-stat-card__eyebrow">Critical Stock</div>
          <div className="product-stat-card__value" style={{ color: "#dc2626" }}>{stats.critical}</div>
          <div className="product-stat-card__note" style={{ color: "#dc2626" }}>
            <span className="material-symbols-outlined text-sm">warning</span>
            Needs immediate attention
          </div>
        </div>
        <div className="product-stat-card">
          <div className="product-stat-card__eyebrow">Low Stock</div>
          <div className="product-stat-card__value" style={{ color: "#d97706" }}>{stats.low}</div>
          <div className="product-stat-card__note" style={{ color: "#d97706" }}>
            <span className="material-symbols-outlined text-sm">schedule</span>
            Reorder suggested
          </div>
        </div>
        <div className="product-stat-card">
          <div className="product-stat-card__eyebrow">Inventory Value</div>
          <div className="product-stat-card__value">
            ${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(stats.totalValue)}
          </div>
          <div className="product-stat-card__note" style={{ color: "#64748b" }}>
            <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
            Live calculation
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="product-table-wrapper">
        <table className="product-table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Stock Level</th>
              <th>Total Value</th>
              <th>Threshold</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProductRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="product-info">
                    <div className="product-image-container">
                      {row.imageUrl ? (
                        <img
                          src={row.imageUrl}
                          alt={row.name}
                          className="product-image-container__image"
                        />
                      ) : (
                        <span className="material-symbols-outlined" style={{ color: "#94a3b8" }}>image</span>
                      )}
                    </div>
                    <div className="product-name-stack">
                      <span className="name">{row.name}</span>
                      <span className="category-label">{row.category}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className="product-sku">{row.sku}</span>
                </td>
                <td>
                  <span className="product-category">{row.category}</span>
                </td>
                <td>
                  <div className="status-indicator">
                    <div className={`status-dot-ring ${
                      row.quantity <= criticalThreshold ? "status-dot-ring--error" :
                      row.quantity <= lowThreshold ? "status-dot-ring--warning" :
                      "status-dot-ring--success"
                    }`} />
                    <span className="text-sm font-bold" style={{ color: 
                      row.quantity <= criticalThreshold ? "#dc2626" :
                      row.quantity <= lowThreshold ? "#d97706" :
                      "#059669"
                    }}>{row.quantity}</span>
                    <span className={`status-pill-small ${
                      row.quantity <= criticalThreshold ? "status-pill-small--error" :
                      row.quantity <= lowThreshold ? "status-pill-small--warning" :
                      "status-pill-small--success"
                    }`}>
                      {row.quantity <= criticalThreshold ? "Critical" : 
                       row.quantity <= lowThreshold ? "Low" : "In Stock"}
                    </span>
                  </div>
                </td>
                <td>
                  <span className="text-sm font-bold" style={{ color: "#1e1b4b" }}>
                    {formatProductValue(row.valuation)}
                  </span>
                </td>
                <td>
                  <span className="text-sm text-slate-500 font-medium">{row.threshold}</span>
                </td>
                <td>
                  <div className="action-btns-hidden">
                    <button className="btn-table-action" onClick={() => handleOpenEdit(row)}>
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                    <button className="btn-table-action btn-table-action--danger">
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredProductRows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: "64px", color: "#64748b" }}>
                  <div className="flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined text-4xl opacity-20">inventory_2</span>
                    <p className="font-medium text-slate-500">
                      {products.length === 0
                        ? "There is no product available"
                        : "No products match the current search and filter combination"}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Insights Bento Row */}
      <div className="secondary-bento">
        <div className="insight-banner flex-col items-stretch">
          <div className="embla" ref={emblaRef}>
            <div className="embla__container">
              {hints.map((hint, index) => (
                <div className="embla__slide" key={index}>
                  <div className="insight-banner__icon">
                    <span className="material-symbols-outlined text-3xl">{hint.icon}</span>
                  </div>
                  <div className="insight-banner__content">
                    <h4>{hint.title}</h4>
                    <p>{hint.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="carousel-dots">
            {hints.map((_, index) => (
              <button
                key={index}
                className={`carousel-dot ${index === selectedIndex ? "carousel-dot--active" : ""}`}
                onClick={() => scrollTo(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="report-card-indigo group">
          <h4>Generate Report</h4>
          <p>Export full catalog data in CSV or PDF formats for the quarterly audit.</p>
          <button className="btn-export-white hover:scale-105 transition-transform active:scale-95">
            Export Now
          </button>
          <span className="material-symbols-outlined bg-icon group-hover:scale-110 transition-transform duration-500">
            file_download
          </span>
        </div>
      </div>

      {/* Modal / Forms */}
      {showFilterModal && (
        <div className="modal-backdrop" onClick={() => setShowFilterModal(false)}>
          <div className="modal-content filter-modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <div className="modal-header__title">
                <h3>Product Filters</h3>
                <p>Refine the catalog table by category, stock state, and sort order.</p>
              </div>
              <button className="btn-close" type="button" onClick={() => setShowFilterModal(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <div className="modal-form">
              <div className="form-group">
                <label className="form-label">Search</label>
                <div className="input-wrapper">
                  <span className="material-symbols-outlined input-icon">search</span>
                  <input
                    type="search"
                    className="form-input form-input--icon"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Find by product, SKU, or category"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Stock State</label>
                <select
                  className="form-select"
                  value={stockStateFilter}
                  onChange={(event) =>
                    setStockStateFilter(event.target.value as StockStateFilter)
                  }
                >
                  <option value="all">All stock states</option>
                  <option value="critical">Critical only</option>
                  <option value="low">Low stock only</option>
                  <option value="healthy">Healthy stock only</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Sort By</label>
                <select
                  className="form-select"
                  value={sortOption}
                  onChange={(event) =>
                    setSortOption(event.target.value as ProductSortOption)
                  }
                >
                  <option value="name-asc">Name A-Z</option>
                  <option value="name-desc">Name Z-A</option>
                  <option value="stock-desc">Stock highest first</option>
                  <option value="stock-asc">Stock lowest first</option>
                  <option value="value-desc">Value highest first</option>
                  <option value="value-asc">Value lowest first</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Categories</label>
                <div className="filter-pill-grid">
                  {categoryOptions.map((category) => {
                    const isActive = selectedCategoryIds.includes(category.id);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        className={`filter-pill ${isActive ? "filter-pill--active" : ""}`}
                        onClick={() => toggleCategoryFilter(category.id)}
                      >
                        {category.name}
                      </button>
                    );
                  })}
                  {categoryOptions.length === 0 ? (
                    <span className="filter-empty-copy">No categories available yet.</span>
                  ) : null}
                </div>
              </div>
            </div>

            <footer className="modal-footer">
              <button type="button" className="btn-cancel" onClick={resetFilters}>
                Reset
              </button>
              <button
                type="button"
                className="btn-submit"
                onClick={() => setShowFilterModal(false)}
              >
                Apply Filters
              </button>
            </footer>
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-backdrop" onClick={closeProductModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <div className="modal-header__title">
                <h3>{editingProduct ? "Edit Product" : "Create New Product"}</h3>
                <p>{editingProduct ? "Modify existing catalog item details." : "Add a new item to your enterprise catalog."}</p>
              </div>
              <button className="btn-close" onClick={closeProductModal}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </header>

            <form onSubmit={handleSubmit}>
              <div className="modal-form">
                <div className="form-group">
                  <label className="form-label">Product Name</label>
                  <div className="input-wrapper">
                    <span className="material-symbols-outlined input-icon">inventory_2</span>
                    <input 
                      type="text" 
                      className="form-input form-input--icon"
                      placeholder="e.g. Lumix Pro 50mm Lens"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">SKU</label>
                    <div className="input-wrapper">
                      <span className="material-symbols-outlined input-icon">qr_code</span>
                      <input 
                        type="text" 
                        className="form-input form-input--icon"
                        placeholder="OPT-LMX-50"
                        value={formSku}
                        onChange={(e) => setFormSku(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Unit Cost (USD)</label>
                    <div className="input-wrapper">
                      <span className="material-symbols-outlined input-icon">payments</span>
                      <input 
                        type="number" 
                        step="0.01"
                        className="form-input form-input--icon"
                        placeholder="0.00"
                        value={formUnitCost}
                        onChange={(e) => setFormUnitCost(Number(e.target.value))}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <div className="category-field-stack">
                    <div className="category-field-row">
                      <select 
                        className="form-select"
                        value={formCategoryId}
                        onChange={(e) => setFormCategoryId(e.target.value)}
                      >
                        <option value="">Uncategorized</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-category-inline"
                        onClick={() => setShowCreateCategory((current) => !current)}
                      >
                        <span className="material-symbols-outlined">add</span>
                        Create category
                      </button>
                    </div>
                    {showCreateCategory ? (
                      <div className="category-inline-creator">
                        <div className="input-wrapper">
                          <span className="material-symbols-outlined input-icon">category</span>
                          <input
                            type="text"
                            className="form-input form-input--icon"
                            placeholder="e.g. Optics"
                            value={categoryName}
                            onChange={(e) => setCategoryName(e.target.value)}
                          />
                        </div>
                        <div className="category-inline-creator__actions">
                          <button
                            type="button"
                            className="btn-cancel btn-cancel--small"
                            onClick={() => {
                              setShowCreateCategory(false);
                              setCategoryName("");
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn-submit btn-submit--small"
                            onClick={handleCreateCategory}
                            disabled={creatingCategory || !categoryName.trim()}
                          >
                            {creatingCategory ? "Creating..." : "Save category"}
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea 
                    className="form-textarea"
                    placeholder="Enter detailed product specifications..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Product Image</label>
                  <div className="product-image-upload">
                    <div className="product-image-upload__preview">
                      {formImagePreviewUrl || formImageUrl ? (
                        <img
                          src={formImagePreviewUrl ?? formImageUrl}
                          alt={formName || "Product preview"}
                          className="product-image-upload__preview-image"
                        />
                      ) : (
                        <span className="material-symbols-outlined">image</span>
                      )}
                    </div>
                    <div className="product-image-upload__controls">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          setFormImageFile(file);

                          if (formImagePreviewUrl) {
                            URL.revokeObjectURL(formImagePreviewUrl);
                          }

                          if (file) {
                            setFormImagePreviewUrl(URL.createObjectURL(file));
                          } else {
                            setFormImagePreviewUrl(null);
                          }
                        }}
                      />
                      <p className="product-image-upload__hint">
                        PNG, JPG, WEBP, or GIF. The file uploads to S3 when you save the product.
                      </p>
                      {formImageUrl && !formImageFile ? (
                        <button
                          type="button"
                          className="btn-category-inline"
                          onClick={() => {
                            setFormImageUrl("");
                          }}
                        >
                          <span className="material-symbols-outlined">delete</span>
                          Remove current image
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <footer className="modal-footer">
                <button 
                  type="button" 
                  className="btn-cancel"
                  onClick={closeProductModal}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-submit"
                  disabled={uploadingImage}
                >
                  {uploadingImage
                    ? "Uploading..."
                    : editingProduct
                      ? "Save Changes"
                      : "Create Product"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="page-toast-stack">
          <div className="page-toast page-toast--error" role="alert">
            <div className="page-toast__content">
              <strong>Unable to load products</strong>
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

      <GlassDialog
        open={dialogMessage !== null}
        title="Product Save Failed"
        message={dialogMessage ?? ""}
        confirmLabel="Close"
        showCancel={false}
        onConfirm={() => setDialogMessage(null)}
        onCancel={() => setDialogMessage(null)}
      />
    </div>
  );
}
