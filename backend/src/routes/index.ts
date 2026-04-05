import { Router } from "express";

import { authRouter } from "../modules/auth/auth.routes.js";
import { usersRouter } from "../modules/users/users.routes.js";
import { inventoryRouter } from "../modules/inventory/inventory.routes.js";
import { organizationsRouter } from "../modules/organizations/organizations.routes.js";
import { productRouter } from "../modules/products/product.routes.js";
import { categoriesRouter } from "../modules/categories/categories.routes.js";
import { metricsRouter } from "../modules/metrics/metrics.routes.js";
import { alertsRouter } from "../modules/alerts/alerts.routes.js";
import { uploadsRouter } from "../modules/uploads/uploads.routes.js";

const router = Router();

router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/organizations", organizationsRouter);
router.use("/categories", categoriesRouter);
router.use("/inventory", inventoryRouter);
router.use("/products", productRouter);
router.use("/metrics", metricsRouter);
router.use("/alerts", alertsRouter);
router.use("/uploads", uploadsRouter);

export { router };
