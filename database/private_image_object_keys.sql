ALTER TABLE auth.accounts
  ADD COLUMN IF NOT EXISTS profile_object_key text;

ALTER TABLE inventory.products
  ADD COLUMN IF NOT EXISTS image_object_key text;
