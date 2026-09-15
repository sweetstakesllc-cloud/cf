-- Existing certificates remain the first unit, retaining their number and URL.
ALTER TABLE authenticity_certificates
  ADD COLUMN unit_number integer NOT NULL DEFAULT 1 CHECK (unit_number > 0);
ALTER TABLE authenticity_certificates
  DROP CONSTRAINT authenticity_certificates_shopify_order_id_line_item_id_key;
ALTER TABLE authenticity_certificates
  ADD UNIQUE (shopify_order_id, line_item_id, unit_number);
