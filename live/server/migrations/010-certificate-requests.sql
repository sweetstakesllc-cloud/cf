CREATE TABLE certificate_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_name text NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','needs_review','sent','rejected')),
  attempts integer NOT NULL DEFAULT 0,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  processing_started_at timestamptz,
  completed_at timestamptz
);
CREATE INDEX certificate_requests_pending_idx ON certificate_requests(next_attempt_at) WHERE status IN ('pending','processing');
CREATE INDEX certificate_requests_lookup_idx ON certificate_requests(order_name,email,created_at);
CREATE TABLE certificate_request_limits (
  key text NOT NULL,
  bucket date NOT NULL DEFAULT CURRENT_DATE,
  count integer NOT NULL DEFAULT 1,
  PRIMARY KEY(key,bucket)
);
ALTER TABLE certificate_requests ADD COLUMN review_notified_at timestamptz;
ALTER TABLE certificate_requests ADD COLUMN review_notification_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE certificate_requests ADD COLUMN review_next_attempt_at timestamptz NOT NULL DEFAULT now();
