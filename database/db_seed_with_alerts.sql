BEGIN;

-- Sample seed for the alert-enabled inventory schema.
-- Run this after applying database/db_schema_with_alerts.sql.
--
-- Dataset size:
-- - 5 organizations
-- - 25 roles
-- - 25 accounts
-- - 25 categories
-- - 100 products
-- - 100 inventory rows
-- - 200 stock movement rows
-- - 20 alert rows

-- Clear existing data in dependency-safe order before reseeding.
DELETE FROM inventory.alerts;
DELETE FROM inventory.stock_movements;
DELETE FROM inventory.inventory;
DELETE FROM inventory.products;
DELETE FROM inventory.categories;
DELETE FROM analytics.alert_definitions;
DELETE FROM analytics.metric_definitions;
DELETE FROM auth.accounts;
DELETE FROM auth.role_permissions;
DELETE FROM auth.roles;
DELETE FROM auth.organizations;

-- Temporary seed tables keep generated UUIDs consistent across related inserts.
CREATE TEMP TABLE seed_organizations
(
    org_number integer PRIMARY KEY,
    id uuid NOT NULL,
    code text NOT NULL,
    join_key text NOT NULL,
    name text NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE seed_roles
(
    id uuid NOT NULL,
    org_id uuid NOT NULL,
    org_code text NOT NULL,
    role_name text NOT NULL,
    level smallint NOT NULL,
    created_at timestamp without time zone NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE seed_accounts
(
    id uuid NOT NULL,
    org_id uuid NOT NULL,
    org_code text NOT NULL,
    role_name text NOT NULL,
    account_slot integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    username text NOT NULL,
    profile_url text NOT NULL,
    profile_object_key text,
    auth_provider text NOT NULL,
    cognito_sub text,
    password_hash text,
    role_id uuid NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE seed_products
(
    id uuid NOT NULL,
    owner_id uuid NOT NULL,
    product_category_id uuid NOT NULL,
    org_code text NOT NULL,
    org_number integer NOT NULL,
    product_number integer NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    sku text NOT NULL,
    image_url text NOT NULL,
    image_object_key text,
    unit_cost numeric(12,2) NOT NULL,
    current_quantity integer NOT NULL,
    threshold_quantity integer NOT NULL,
    outbound_quantity integer NOT NULL,
    deleted_at timestamp without time zone,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE seed_categories
(
    id uuid NOT NULL,
    org_id uuid NOT NULL,
    org_code text NOT NULL,
    category_number integer NOT NULL,
    name text NOT NULL,
    parent_id uuid,
    created_at timestamp without time zone NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE seed_movements
(
    id uuid NOT NULL,
    owner_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    product_id uuid NOT NULL,
    product_name text NOT NULL,
    movement_kind text NOT NULL,
    type text NOT NULL,
    quantity integer NOT NULL,
    reason text,
    created_at timestamp without time zone NOT NULL
) ON COMMIT DROP;

-- ---------------------------------------------------------------------------
-- Auth domain seed data
-- ---------------------------------------------------------------------------
-- auth.accounts supports either:
-- - backend auth: auth_provider='backend' and password_hash IS NOT NULL
-- - Cognito auth: auth_provider='cognito' and cognito_sub IS NOT NULL
-- This seed currently inserts backend-auth sample accounts only.

INSERT INTO seed_organizations (org_number, id, code, join_key, name)
VALUES
    (1, gen_random_uuid(), 'NMB', 'NMB10001', 'Nimbus Retail'),
    (2, gen_random_uuid(), 'ATL', 'ATL20001', 'Atlas Supplies'),
    (3, gen_random_uuid(), 'VRT', 'VRT30001', 'Vertex Goods'),
    (4, gen_random_uuid(), 'ORN', 'ORN40001', 'Orion Traders'),
    (5, gen_random_uuid(), 'PLR', 'PLR50001', 'Polar Distribution');

INSERT INTO auth.organizations (id, name, join_key)
SELECT id, name, join_key
FROM seed_organizations
ORDER BY org_number;

INSERT INTO seed_roles (id, org_id, org_code, role_name, level, created_at)
SELECT
    gen_random_uuid(),
    o.id,
    o.code,
    r.role_name,
    r.level,
    TIMESTAMP '2026-03-01 09:00:00' + make_interval(mins => ((o.org_number - 1) * 15) + r.role_order * 5)
FROM seed_organizations o
CROSS JOIN (
    VALUES
        ('owner', 255, 0),
        ('admin', 220, 1),
        ('manager', 160, 2),
        ('staff', 80, 3),
        ('member', 20, 4)
) AS r(role_name, level, role_order);

INSERT INTO auth.roles (id, org_id, name, level, created_at)
SELECT id, org_id, role_name, level, created_at
FROM seed_roles
ORDER BY org_code, role_name;

INSERT INTO auth.role_permissions (role_id, permission)
SELECT r.id, p.permission
FROM seed_roles r
JOIN (
    VALUES
        ('owner', 'organization:read'),
        ('owner', 'organization:update'),
        ('owner', 'organization:members:read'),
        ('owner', 'organization:members:invite'),
        ('owner', 'organization:members:manage'),
        ('owner', 'organization:manage'),
        ('owner', 'category:create'),
        ('owner', 'category:read'),
        ('owner', 'category:update'),
        ('owner', 'category:delete'),
        ('owner', 'product:create'),
        ('owner', 'product:read'),
        ('owner', 'product:update'),
        ('owner', 'product:delete'),
        ('owner', 'inventory:read'),
        ('owner', 'inventory:update'),
        ('owner', 'stockmovement:read'),
        ('owner', 'stockmovement:create'),
        ('owner', 'alert:manage'),
        ('owner', 'auth:read'),
        ('owner', 'auth:update'),
        ('owner', 'auth:link'),
        ('owner', 'auth:manage'),
        ('admin', 'organization:read'),
        ('admin', 'organization:update'),
        ('admin', 'organization:members:read'),
        ('admin', 'organization:members:invite'),
        ('admin', 'organization:members:manage'),
        ('admin', 'organization:manage'),
        ('admin', 'product:create'),
        ('admin', 'product:read'),
        ('admin', 'product:delete'),
        ('admin', 'category:create'),
        ('admin', 'category:read'),
        ('admin', 'category:update'),
        ('admin', 'category:delete'),
        ('admin', 'product:update'),
        ('admin', 'inventory:read'),
        ('admin', 'inventory:update'),
        ('admin', 'stockmovement:read'),
        ('admin', 'stockmovement:create'),
        ('admin', 'alert:manage'),
        ('manager', 'organization:read'),
        ('manager', 'organization:update'),
        ('manager', 'organization:members:read'),
        ('manager', 'category:read'),
        ('manager', 'category:update'),
        ('manager', 'product:read'),
        ('manager', 'product:update'),
        ('manager', 'inventory:read'),
        ('manager', 'inventory:update'),
        ('manager', 'stockmovement:read'),
        ('manager', 'stockmovement:create'),
        ('manager', 'alert:manage'),
        ('staff', 'organization:read'),
        ('staff', 'category:read'),
        ('staff', 'product:read'),
        ('staff', 'inventory:read'),
        ('staff', 'inventory:update'),
        ('staff', 'stockmovement:read'),
        ('staff', 'stockmovement:create'),
        ('member', 'organization:read'),
        ('member', 'category:read'),
        ('member', 'product:read'),
        ('member', 'inventory:read'),
        ('member', 'stockmovement:read')
) AS p(role_name, permission)
    ON p.role_name = r.role_name
ORDER BY r.org_code, r.role_name, p.permission;

INSERT INTO seed_accounts
    (id, org_id, org_code, role_name, account_slot, name, email, username, profile_url, profile_object_key, auth_provider, cognito_sub, password_hash, role_id, created_at, updated_at)
SELECT
    gen_random_uuid(),
    o.id,
    o.code,
    a.role_name,
    a.account_slot,
    CONCAT(o.name, ' ', a.display_name),
    LOWER(CONCAT(a.username_prefix, a.account_slot, '.', o.code, '@example.com')),
    LOWER(CONCAT(o.code, '_', a.username_prefix, a.account_slot)),
    CONCAT('https://example.com/profiles/', LOWER(o.code), '-', a.username_prefix, a.account_slot, '.png'),
    NULL,
    'backend',
    NULL,
    CONCAT('$2b$10$', LOWER(o.code), a.username_prefix, a.account_slot, 'placeholderhashvalue000000000000000000'),
    r.id,
    TIMESTAMP '2026-03-01 10:00:00' + make_interval(mins => ((o.org_number - 1) * 12) + a.account_slot * 3),
    TIMESTAMP '2026-03-01 10:00:00' + make_interval(mins => ((o.org_number - 1) * 12) + a.account_slot * 3)
FROM seed_organizations o
JOIN (
    VALUES
        ('owner', 1, 'Owner', 'owner'),
        ('admin', 1, 'Admin', 'admin'),
        ('manager', 1, 'Manager', 'manager'),
        ('staff', 1, 'Staff', 'staff'),
        ('member', 1, 'Member', 'member')
) AS a(role_name, account_slot, display_name, username_prefix)
    ON TRUE
JOIN seed_roles r
    ON r.org_id = o.id
   AND r.role_name = a.role_name;

INSERT INTO auth.accounts
    (id, org_id, profile_url, profile_object_key, name, email, username, auth_provider, cognito_sub, password_hash, role_id, created_at, updated_at)
SELECT
    id,
    org_id,
    profile_url,
    profile_object_key,
    name,
    email,
    username,
    auth_provider,
    cognito_sub,
    password_hash,
    role_id,
    created_at,
    updated_at
FROM seed_accounts
ORDER BY org_code, role_name, account_slot;

-- ---------------------------------------------------------------------------
-- Inventory domain seed data
-- ---------------------------------------------------------------------------

INSERT INTO seed_categories
    (id, org_id, org_code, category_number, name, parent_id, created_at)
SELECT
    gen_random_uuid(),
    o.id,
    o.code,
    c.category_number,
    c.name,
    NULL,
    TIMESTAMP '2026-03-02 07:00:00' + make_interval(mins => ((o.org_number - 1) * 20) + c.category_number)
FROM seed_organizations o
JOIN (
    VALUES
        (1, 'General'),
        (2, 'Electronics'),
        (3, 'Office'),
        (4, 'Storage'),
        (5, 'Safety')
) AS c(category_number, name)
    ON TRUE;

INSERT INTO inventory.categories
    (id, org_id, name, parent_id, created_at)
SELECT
    id,
    org_id,
    name,
    parent_id,
    created_at
FROM seed_categories
ORDER BY org_code, category_number;

INSERT INTO seed_products
    (id, owner_id, product_category_id, org_code, org_number, product_number, name, description, sku, image_url, image_object_key, unit_cost, current_quantity, threshold_quantity, outbound_quantity, deleted_at, created_at, updated_at)
SELECT
    gen_random_uuid(),
    o.id,
    c.id,
    o.code,
    o.org_number,
    gs.product_number,
    CONCAT(o.name, ' Item ', LPAD(gs.product_number::text, 3, '0')),
    CONCAT('Sample inventory item ', LPAD(gs.product_number::text, 3, '0'), ' for ', o.name),
    CONCAT(o.code, '-', LPAD(gs.product_number::text, 4, '0')),
    CONCAT('https://example.com/products/', LOWER(o.code), '/', LPAD(gs.product_number::text, 4, '0'), '.jpg'),
    NULL,
    ROUND((8 + (o.org_number * 2) + (gs.product_number * 1.75))::numeric, 2),
    CASE
        WHEN gs.product_number % 5 = 0 THEN 1 + ((o.org_number + gs.product_number) % 4)
        ELSE 18 + ((o.org_number * gs.product_number) % 23)
    END,
    CASE
        WHEN gs.product_number % 5 = 0 THEN 5
        ELSE 10
    END,
    CASE
        WHEN gs.product_number % 5 = 0 THEN 20 + ((o.org_number + gs.product_number) % 8)
        ELSE 6 + ((o.org_number + gs.product_number) % 10)
    END,
    NULL,
    TIMESTAMP '2026-03-02 08:00:00' + make_interval(mins => ((o.org_number - 1) * 40) + gs.product_number),
    TIMESTAMP '2026-03-24 09:00:00' + make_interval(mins => ((o.org_number - 1) * 40) + gs.product_number)
FROM seed_organizations o
JOIN generate_series(1, 20) AS gs(product_number)
    ON TRUE
JOIN seed_categories c
    ON c.org_id = o.id
   AND c.category_number = ((gs.product_number - 1) % 5) + 1;

INSERT INTO inventory.products
    (id, owner_id, product_category_id, name, description, sku, image_url, image_object_key, unit_cost, deleted_at, created_at, updated_at)
SELECT
    id,
    owner_id,
    product_category_id,
    name,
    description,
    sku,
    image_url,
    image_object_key,
    unit_cost,
    deleted_at,
    created_at,
    updated_at
FROM seed_products
ORDER BY org_code, product_number;

INSERT INTO inventory.inventory
    (product_id, quantity, created_at, updated_at)
SELECT
    id,
    current_quantity,
    created_at + INTERVAL '30 minutes',
    updated_at
FROM seed_products
ORDER BY org_code, product_number;

INSERT INTO seed_movements
    (id, owner_id, actor_id, product_id, product_name, movement_kind, type, quantity, reason, created_at)
SELECT
    gen_random_uuid(),
    p.owner_id,
    a.id,
    p.id,
    p.name,
    'stock_in',
    'stock_in',
    p.current_quantity + p.outbound_quantity,
    'Initial stock receipt during seed setup',
    p.created_at + INTERVAL '1 hour'
FROM seed_products p
JOIN seed_accounts a
    ON a.org_id = p.owner_id
   AND a.role_name = 'admin'
   AND a.account_slot = 1;

INSERT INTO seed_movements
    (id, owner_id, actor_id, product_id, product_name, movement_kind, type, quantity, reason, created_at)
SELECT
    gen_random_uuid(),
    p.owner_id,
    a.id,
    p.id,
    p.name,
    'stock_out',
    'stock_out',
    p.outbound_quantity,
    'Seeded outbound fulfillment activity',
    TIMESTAMP '2026-03-24 09:00:00' + make_interval(mins => ((p.org_number - 1) * 45) + p.product_number)
FROM seed_products p
JOIN seed_accounts a
    ON a.org_id = p.owner_id
   AND a.role_name = 'staff'
   AND a.account_slot = CASE WHEN p.product_number % 2 = 0 THEN 2 ELSE 1 END;

INSERT INTO inventory.stock_movements
    (id, owner_id, actor_id, product_id, product_name, type, quantity, reason, created_at)
SELECT
    id,
    owner_id,
    actor_id,
    product_id,
    product_name,
    type,
    quantity,
    reason,
    created_at
FROM seed_movements
ORDER BY owner_id, product_name, created_at;

INSERT INTO inventory.alerts
    (id, owner_id, product_id, triggered_by_movement_id, type, status, threshold_quantity, current_quantity, message, acknowledged_by, acknowledged_at, created_at)
SELECT
    gen_random_uuid(),
    p.owner_id,
    p.id,
    m.id,
    'low_stock',
    CASE
        WHEN p.product_number % 10 = 0 THEN 'acknowledged'
        ELSE 'active'
    END,
    p.threshold_quantity::double precision,
    p.current_quantity::double precision,
    CONCAT(
        p.name,
        ' has ',
        p.current_quantity,
        ' units remaining, below the threshold of ',
        p.threshold_quantity,
        '.'
    ),
    CASE
        WHEN p.product_number % 10 = 0 THEN ack.id
        ELSE NULL
    END,
    CASE
        WHEN p.product_number % 10 = 0 THEN m.created_at + INTERVAL '20 minutes'
        ELSE NULL
    END,
    m.created_at + INTERVAL '1 minute'
FROM seed_products p
JOIN seed_movements m
    ON m.product_id = p.id
   AND m.movement_kind = 'stock_out'
LEFT JOIN seed_accounts ack
    ON ack.org_id = p.owner_id
   AND ack.role_name = 'manager'
   AND ack.account_slot = 1
WHERE p.current_quantity <= p.threshold_quantity
ORDER BY p.org_code, p.product_number;

COMMIT;
