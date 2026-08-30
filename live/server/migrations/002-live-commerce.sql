CREATE TABLE streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('live','ended')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE TABLE stream_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES streams(id),
  position int NOT NULL,
  title text NOT NULL,
  image_url text,
  mode text NOT NULL CHECK (mode IN ('auction','buy_now')),
  starting_bid_ore int,
  min_increment_ore int NOT NULL DEFAULT 10000,
  buy_now_price_ore int,
  state text NOT NULL DEFAULT 'queued'
    CHECK (state IN ('queued','pinned','auction_open','won','charged','payment_failed','passed')),
  current_bid_ore int,
  current_bidder_id uuid REFERENCES customers(id),
  ends_at timestamptz,
  winner_id uuid REFERENCES customers(id),
  winning_amount_ore int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stream_items_stream_idx ON stream_items (stream_id, position);
CREATE INDEX stream_items_due_idx ON stream_items (state, ends_at);

CREATE TABLE bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES stream_items(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  amount_ore int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bids_item_idx ON bids (item_id, amount_ore DESC, created_at ASC);

CREATE TABLE charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES stream_items(id),
  customer_id uuid NOT NULL REFERENCES customers(id),
  amount_ore int NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  gateway_payment_intent_id text,
  status text NOT NULL CHECK (status IN ('succeeded','failed')),
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id bigserial PRIMARY KEY,
  stream_id uuid REFERENCES streams(id),
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
