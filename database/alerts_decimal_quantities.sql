ALTER TABLE inventory.alerts
  ALTER COLUMN threshold_quantity TYPE double precision USING threshold_quantity::double precision,
  ALTER COLUMN current_quantity TYPE double precision USING current_quantity::double precision;
