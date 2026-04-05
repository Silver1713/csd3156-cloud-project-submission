-- auth.accounts supports either:
-- - backend auth: auth_provider='backend' and password_hash IS NOT NULL
-- - Cognito auth: auth_provider='cognito' and cognito_sub IS NOT NULL
-- This seed currently inserts a backend-auth sample account only.

INSERT INTO auth.organizations (id, name)
  VALUES ('11111111-1111-1111-1111-111111111111', 'Acme Widgets');

  INSERT INTO auth.roles (id, org_id, name, created_at)
  VALUES ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Admin', NOW());

  INSERT INTO auth.role_permissions (role_id, permission) VALUES
    ('22222222-2222-2222-2222-222222222222', 'organization:read'),
    ('22222222-2222-2222-2222-222222222222', 'organization:update'),
    ('22222222-2222-2222-2222-222222222222', 'organization:members:read'),
    ('22222222-2222-2222-2222-222222222222', 'organization:members:invite'),
    ('22222222-2222-2222-2222-222222222222', 'organization:members:manage'),
    ('22222222-2222-2222-2222-222222222222', 'organization:manage'),
    ('22222222-2222-2222-2222-222222222222', 'category:create'),
    ('22222222-2222-2222-2222-222222222222', 'category:read'),
    ('22222222-2222-2222-2222-222222222222', 'category:update'),
    ('22222222-2222-2222-2222-222222222222', 'category:delete'),
    ('22222222-2222-2222-2222-222222222222', 'product:create'),
    ('22222222-2222-2222-2222-222222222222', 'product:read'),
    ('22222222-2222-2222-2222-222222222222', 'product:update'),
    ('22222222-2222-2222-2222-222222222222', 'product:delete'),
    ('22222222-2222-2222-2222-222222222222', 'inventory:read'),
    ('22222222-2222-2222-2222-222222222222', 'inventory:update'),
    ('22222222-2222-2222-2222-222222222222', 'stockmovement:read'),
    ('22222222-2222-2222-2222-222222222222', 'stockmovement:create'),
    ('22222222-2222-2222-2222-222222222222', 'alert:manage');

  INSERT INTO auth.accounts (
    id, org_id, role_id, name, email, username, auth_provider, cognito_sub, password_hash, created_at, updated_at
  ) VALUES (
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    'Neo Hui Zong',
    'neo@example.com',
    'neo_admin',
    'backend',
    NULL,
    '$2b$10$abcdefghijklmnopqrstuv',
    NOW(),
    NOW()
  );

  INSERT INTO inventory.products (
    id, owner_id, name, description, sku, unit_cost, deleted_at, created_at, updated_at
  ) VALUES (
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'Bluetooth Barcode Scanner',
    'Handheld scanner used for stock counts',
    'SCN-001',
    89.90,
    NULL,
    NOW(),
    NOW()
  );

  INSERT INTO inventory.inventory (product_id, quantity, created_at, updated_at)
  VALUES ('44444444-4444-4444-4444-444444444444', 12, NOW(), NOW());

  INSERT INTO inventory.stock_movements (
      id, owner_id, actor_id, product_id, product_name, type, quantity, reason, created_at
    ) VALUES (
      '55555555-5555-5555-5555-555555555555',
      '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333333',
    '44444444-4444-4444-4444-444444444444',
      'Bluetooth Barcode Scanner',
      'stock_in',
      12,
      'Initial stock receipt for seed data',
      NOW()
    );

  INSERT INTO inventory.alerts (
    id, owner_id, product_id, triggered_by_movement_id, type, status,
    threshold_quantity, current_quantity, message, created_at
  ) VALUES (
    '66666666-6666-6666-6666-666666666666',
    '11111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555',
    'low_stock',
    'active',
    10,
    12,
    'Scanner stock is near minimum threshold',
    NOW()
  );
