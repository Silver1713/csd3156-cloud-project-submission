BEGIN;

-- Live-safe seed for org:   0ebd27f0-b670-4731-9239-0a160443dec5
-- Acting account id:        9aa03751-8def-4e26-8461-a409c3e714ed
--
-- Scope:
-- - inserts categories if missing
-- - upserts products by (owner_id, sku)
-- - upserts inventory by product_id
-- - inserts stock movements using the provided actor_id
-- - does not delete existing data
-- - does not modify auth tables

WITH target_context AS (
    SELECT
        '0ebd27f0-b670-4731-9239-0a160443dec5'::uuid AS org_id,
        '9aa03751-8def-4e26-8461-a409c3e714ed'::uuid AS actor_id
),
validated_context AS (
    SELECT tc.org_id, tc.actor_id
    FROM target_context tc
    JOIN auth.accounts a
      ON a.id = tc.actor_id
     AND a.org_id = tc.org_id
),
inserted_categories AS (
    INSERT INTO inventory.categories (id, org_id, name, parent_id, created_at)
    SELECT
        gen_random_uuid(),
        vc.org_id,
        c.name,
        NULL,
        now()
    FROM validated_context vc
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
        WHERE existing.org_id = vc.org_id
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
    JOIN validated_context vc ON vc.org_id = c.org_id
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
    SELECT id, org_id, name
    FROM root_categories
    UNION ALL
    SELECT c.id, c.org_id, c.name
    FROM inventory.categories c
    JOIN validated_context vc ON vc.org_id = c.org_id
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
),
product_seed AS (
    SELECT
        vc.org_id AS owner_id,
        p.name,
        p.description,
        p.sku,
        p.unit_cost,
        p.quantity,
        p.category_name
    FROM validated_context vc
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
    RETURNING id, owner_id, sku, name
),
inventory_upsert AS (
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
        updated_at = now()
    RETURNING product_id
)
INSERT INTO inventory.stock_movements (
      id,
      owner_id,
      actor_id,
      product_id,
      product_name,
      type,
      quantity,
      reason,
      created_at
  )
  SELECT
    gen_random_uuid(),
    vc.org_id,
    vc.actor_id,
      p.id,
      p.name,
      m.type,
      m.quantity,
      CASE
          WHEN m.type = 'STOCK_IN' THEN 'Live seed stock receipt'
          WHEN m.type = 'STOCK_OUT' THEN 'Live seed outbound fulfillment'
          WHEN m.type = 'TRANSFER_IN' THEN 'Live seed transfer received'
          WHEN m.type = 'TRANSFER_OUT' THEN 'Live seed transfer dispatched'
          WHEN m.type = 'ADJUSTMENT_INCREASE' THEN 'Live seed cycle count increase'
          WHEN m.type = 'ADJUSTMENT_DECREASE' THEN 'Live seed shrinkage adjustment'
          ELSE NULL
      END,
      now() - m.created_offset
  FROM validated_context vc
JOIN upserted_products p
  ON p.owner_id = vc.org_id
JOIN (
    VALUES
        ('LIV-SCN-001', 'STOCK_IN', 18, INTERVAL '6 days'),
        ('LIV-PRN-001', 'STOCK_IN', 7, INTERVAL '5 days'),
        ('LIV-PKG-001', 'STOCK_IN', 240, INTERVAL '4 days'),
        ('LIV-BOX-001', 'STOCK_IN', 320, INTERVAL '4 days'),
        ('LIV-SFT-001', 'STOCK_IN', 64, INTERVAL '3 days'),
        ('LIV-OFC-001', 'STOCK_IN', 25, INTERVAL '3 days'),
        ('LIV-OFC-002', 'STOCK_IN', 90, INTERVAL '2 days'),
        ('LIV-SFT-002', 'STOCK_IN', 16, INTERVAL '2 days'),
        ('LIV-ELC-002', 'STOCK_IN', 11, INTERVAL '1 day'),
        ('LIV-GEN-001', 'STOCK_IN', 33, INTERVAL '1 day'),
        ('LIV-SCN-001', 'STOCK_OUT', 3, INTERVAL '18 hours'),
        ('LIV-PKG-001', 'STOCK_OUT', 24, INTERVAL '16 hours'),
        ('LIV-BOX-001', 'STOCK_OUT', 40, INTERVAL '14 hours'),
        ('LIV-SFT-001', 'STOCK_OUT', 8, INTERVAL '12 hours'),
        ('LIV-OFC-002', 'STOCK_OUT', 15, INTERVAL '10 hours'),
        ('LIV-GEN-001', 'ADJUSTMENT_INCREASE', 4, INTERVAL '8 hours'),
        ('LIV-ELC-002', 'ADJUSTMENT_DECREASE', 2, INTERVAL '6 hours'),
        ('LIV-SFT-002', 'TRANSFER_OUT', 1, INTERVAL '4 hours'),
        ('LIV-SFT-002', 'TRANSFER_IN', 1, INTERVAL '2 hours'),
        ('LIV-OFC-003', 'STOCK_IN', 14, INTERVAL '6 days'),
        ('LIV-STO-002', 'STOCK_IN', 52, INTERVAL '5 days'),
        ('LIV-SFT-003', 'STOCK_IN', 9, INTERVAL '4 days'),
        ('LIV-ELC-003', 'STOCK_IN', 6, INTERVAL '3 days'),
        ('LIV-GEN-002', 'STOCK_IN', 120, INTERVAL '2 days'),
        ('LIV-OFC-004', 'STOCK_IN', 44, INTERVAL '36 hours'),
        ('LIV-GEN-003', 'STOCK_IN', 5, INTERVAL '30 hours'),
        ('LIV-STO-003', 'STOCK_IN', 22, INTERVAL '24 hours'),
        ('LIV-OFC-003', 'STOCK_OUT', 4, INTERVAL '20 hours'),
        ('LIV-STO-002', 'STOCK_OUT', 7, INTERVAL '18 hours'),
        ('LIV-SFT-003', 'STOCK_OUT', 3, INTERVAL '15 hours'),
        ('LIV-ELC-003', 'STOCK_OUT', 2, INTERVAL '11 hours'),
        ('LIV-GEN-002', 'STOCK_OUT', 18, INTERVAL '9 hours'),
        ('LIV-OFC-004', 'ADJUSTMENT_DECREASE', 2, INTERVAL '7 hours'),
        ('LIV-GEN-003', 'ADJUSTMENT_INCREASE', 1, INTERVAL '5 hours'),
        ('LIV-STO-003', 'TRANSFER_OUT', 2, INTERVAL '3 hours'),
        ('LIV-STO-003', 'TRANSFER_IN', 2, INTERVAL '1 hour'),
        ('LIV-STO-004', 'STOCK_IN', 4, INTERVAL '42 hours'),
        ('LIV-ELC-004', 'STOCK_IN', 13, INTERVAL '40 hours'),
        ('LIV-SFT-004', 'STOCK_IN', 38, INTERVAL '34 hours'),
        ('LIV-GEN-004', 'STOCK_IN', 21, INTERVAL '28 hours'),
        ('LIV-STO-004', 'ADJUSTMENT_DECREASE', 1, INTERVAL '13 hours'),
        ('LIV-ELC-004', 'STOCK_OUT', 2, INTERVAL '12 hours'),
        ('LIV-SFT-004', 'STOCK_OUT', 6, INTERVAL '8 hours'),
        ('LIV-GEN-004', 'ADJUSTMENT_INCREASE', 3, INTERVAL '90 minutes'),
        ('LIV-OFC-001', 'TRANSFER_OUT', 2, INTERVAL '75 minutes'),
        ('LIV-OFC-001', 'TRANSFER_IN', 2, INTERVAL '45 minutes')
) AS m(sku, type, quantity, created_offset)
  ON m.sku = p.sku
WHERE NOT EXISTS (
    SELECT 1
    FROM inventory.stock_movements existing
    WHERE existing.owner_id = vc.org_id
      AND existing.actor_id = vc.actor_id
      AND existing.product_id = p.id
      AND existing.type = m.type
      AND existing.quantity = m.quantity
      AND existing.created_at >= now() - INTERVAL '7 days'
);

COMMIT;
