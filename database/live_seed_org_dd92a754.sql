BEGIN;

-- Live-safe seed for org: dd92a754-e8c7-4080-951c-b0899891f35e
-- Scope:
-- - inserts categories if missing
-- - upserts products by (owner_id, sku)
-- - upserts inventory by product_id
-- - does not delete existing data
-- - does not touch auth tables

WITH target_org AS (
    SELECT 'dd92a754-e8c7-4080-951c-b0899891f35e'::uuid AS org_id
),
inserted_categories AS (
    INSERT INTO inventory.categories (id, org_id, name, parent_id, created_at)
    SELECT
        gen_random_uuid(),
        o.org_id,
        c.name,
        NULL,
        now()
    FROM target_org o
    CROSS JOIN (
        VALUES
            ('General'),
            ('Electronics'),
            ('Office'),
            ('Storage'),
            ('Safety')
    ) AS c(name)
    WHERE NOT EXISTS (
        SELECT 1
        FROM inventory.categories existing
        WHERE existing.org_id = o.org_id
          AND existing.name = c.name
          AND existing.parent_id IS NULL
    )
    RETURNING id, org_id, name
),
root_categories AS (
    SELECT id, org_id, name
    FROM inserted_categories
    UNION ALL
    SELECT c.id, c.org_id, c.name
    FROM inventory.categories c
    JOIN target_org o ON o.org_id = c.org_id
    WHERE c.parent_id IS NULL
      AND c.name IN ('General', 'Electronics', 'Office', 'Storage', 'Safety')
),
inserted_subcategories AS (
    INSERT INTO inventory.categories (id, org_id, name, parent_id, created_at)
    SELECT
        gen_random_uuid(),
        rc.org_id,
        s.name,
        rc.id,
        now()
    FROM root_categories rc
    JOIN (
        VALUES
            ('Electronics', 'Scanning Devices'),
            ('Electronics', 'Printing Devices'),
            ('Electronics', 'Power Accessories'),
            ('Office', 'Paper Supplies'),
            ('Office', 'Admin Tools'),
            ('Storage', 'Packing Materials'),
            ('Storage', 'Warehouse Containers'),
            ('Safety', 'PPE'),
            ('Safety', 'Handling Tools'),
            ('General', 'Housekeeping')
    ) AS s(parent_name, name)
      ON s.parent_name = rc.name
    WHERE NOT EXISTS (
        SELECT 1
        FROM inventory.categories existing
        WHERE existing.org_id = rc.org_id
          AND existing.name = s.name
          AND existing.parent_id = rc.id
    )
    RETURNING id, org_id, name, parent_id
),
all_categories AS (
    SELECT DISTINCT ON (c.org_id, c.name)
        c.id,
        c.org_id,
        c.name
    FROM inventory.categories c
    JOIN target_org o ON o.org_id = c.org_id
    WHERE (
            c.parent_id IS NULL
            AND c.name IN ('General', 'Electronics', 'Office', 'Storage', 'Safety')
        )
       OR c.name IN (
            'Scanning Devices',
            'Printing Devices',
            'Power Accessories',
            'Paper Supplies',
            'Admin Tools',
            'Packing Materials',
            'Warehouse Containers',
            'PPE',
            'Handling Tools',
            'Housekeeping'
        )
    ORDER BY c.org_id, c.name, c.created_at, c.id
),
product_seed AS (
    SELECT
        o.org_id AS owner_id,
        p.name,
        p.description,
        p.sku,
        p.unit_cost,
        p.quantity,
        p.category_name
    FROM target_org o
    CROSS JOIN (
        VALUES
            ('Wireless Barcode Scanner', 'Handheld scanner for receiving and cycle counts.', 'LIV-SCN-001', 89.90::numeric(12,2), 18, 'Scanning Devices'),
            ('Thermal Label Printer', 'Desktop label printer for shelf and shipment labels.', 'LIV-PRN-001', 149.50::numeric(12,2), 7, 'Printing Devices'),
            ('Packing Tape Roll', 'Heavy-duty clear packing tape.', 'LIV-PKG-001', 3.25::numeric(12,2), 240, 'Packing Materials'),
            ('Corrugated Shipping Box M', 'Medium corrugated carton for outbound orders.', 'LIV-BOX-001', 1.85::numeric(12,2), 320, 'Packing Materials'),
            ('Safety Gloves', 'General-purpose warehouse safety gloves.', 'LIV-SFT-001', 6.75::numeric(12,2), 64, 'PPE'),
            ('Clipboard Board', 'Warehouse picking and count clipboard.', 'LIV-OFC-001', 4.40::numeric(12,2), 25, 'Admin Tools'),
            ('Inventory Count Sheet Pack', 'Printed stock count sheets for manual audits.', 'LIV-OFC-002', 2.10::numeric(12,2), 90, 'Paper Supplies'),
            ('Utility Cutter', 'Retractable safety cutter for receiving station.', 'LIV-SFT-002', 8.95::numeric(12,2), 16, 'Handling Tools'),
            ('USB Receipt Printer Cable', 'Replacement cable for POS and packing stations.', 'LIV-ELC-002', 12.60::numeric(12,2), 11, 'Power Accessories'),
            ('Miscellaneous Consumables', 'General warehouse consumables and ad hoc supplies.', 'LIV-GEN-001', 14.20::numeric(12,2), 33, 'General'),
            ('A4 Printer Paper Carton', 'Bulk office paper for labels, invoices, and reports.', 'LIV-OFC-003', 28.00::numeric(12,2), 14, 'Paper Supplies'),
            ('Industrial Shelf Bin', 'Plastic storage bin used for fast-pick shelving.', 'LIV-STO-002', 11.40::numeric(12,2), 52, 'Warehouse Containers'),
            ('Reflective Safety Vest', 'High-visibility vest for warehouse floor operations.', 'LIV-SFT-003', 9.80::numeric(12,2), 9, 'PPE'),
            ('Portable Power Bank', 'Rechargeable battery pack for mobile scanning devices.', 'LIV-ELC-003', 34.75::numeric(12,2), 6, 'Power Accessories'),
            ('Cable Ties Pack', 'Multi-purpose pack for cable and carton bundling.', 'LIV-GEN-002', 5.15::numeric(12,2), 120, 'General'),
            ('Document Archive Box', 'Office archive box for storing receiving paperwork.', 'LIV-OFC-004', 3.90::numeric(12,2), 44, 'Admin Tools'),
            ('Warehouse Broom', 'Wide-head broom for loading bay and aisle cleaning.', 'LIV-GEN-003', 16.50::numeric(12,2), 5, 'Housekeeping'),
            ('Heavy Duty Pallet Wrap', 'Stretch wrap for palletized outbound orders.', 'LIV-STO-003', 18.20::numeric(12,2), 22, 'Packing Materials'),
            ('Hand Pallet Jack Wheel Kit', 'Replacement wheel kit for pallet jack maintenance.', 'LIV-STO-004', 42.00::numeric(12,2), 4, 'Warehouse Containers'),
            ('Rechargeable Scanner Battery', 'Hot-swappable battery pack for barcode scanners.', 'LIV-ELC-004', 24.90::numeric(12,2), 13, 'Power Accessories'),
            ('Disposable Face Mask Box', 'Box of disposable masks for visitors and staff.', 'LIV-SFT-004', 7.20::numeric(12,2), 38, 'PPE'),
            ('Cleaning Spray Bottle', 'Refillable spray bottle for surface sanitation.', 'LIV-GEN-004', 4.85::numeric(12,2), 21, 'Housekeeping')
    ) AS p(name, description, sku, unit_cost, quantity, category_name)
),
upserted_products AS (
    INSERT INTO inventory.products (
        owner_id,
        product_category_id,
        name,
        description,
        sku,
        unit_cost,
        deleted_at,
        created_at,
        updated_at
    )
    SELECT
        p.owner_id,
        c.id,
        p.name,
        p.description,
        p.sku,
        p.unit_cost,
        NULL,
        now(),
        now()
    FROM product_seed p
    JOIN all_categories c
      ON c.org_id = p.owner_id
     AND c.name = p.category_name
    ON CONFLICT (owner_id, sku) DO UPDATE
    SET
        product_category_id = EXCLUDED.product_category_id,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        unit_cost = EXCLUDED.unit_cost,
        deleted_at = EXCLUDED.deleted_at,
        updated_at = now()
    RETURNING id, owner_id, sku
)
INSERT INTO inventory.inventory (
    product_id,
    quantity,
    created_at,
    updated_at
)
SELECT
    p.id,
    s.quantity,
    now(),
    now()
FROM upserted_products p
JOIN product_seed s
  ON s.owner_id = p.owner_id
 AND s.sku = p.sku
ON CONFLICT (product_id) DO UPDATE
SET
    quantity = EXCLUDED.quantity,
    updated_at = now();

COMMIT;
