CREATE TABLE shopify_webhooks (
  webhook_id text PRIMARY KEY,
  topic text NOT NULL,
  shop_domain text,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  processing_started_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX shopify_webhooks_pending_idx
  ON shopify_webhooks (next_attempt_at, received_at)
  WHERE status IN ('pending','failed');

CREATE TABLE authenticity_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  certificate_number text UNIQUE NOT NULL,
  shopify_order_id text NOT NULL,
  order_name text NOT NULL,
  line_item_id text NOT NULL,
  product_id text,
  customer_email text,
  product_title text NOT NULL,
  brand text NOT NULL DEFAULT '',
  sku text NOT NULL DEFAULT '',
  image_urls jsonb NOT NULL DEFAULT '[]',
  authentication_partner text,
  authentication_report_number text,
  pdf_path text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','revoked')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  emailed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shopify_order_id, line_item_id)
);
CREATE INDEX authenticity_certificates_order_idx
  ON authenticity_certificates (shopify_order_id);
