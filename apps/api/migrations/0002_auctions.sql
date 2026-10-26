CREATE TABLE catalog_items (
 id text PRIMARY KEY, item jsonb NOT NULL, imported_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE auctions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES users(id),
 item jsonb NOT NULL, initial_cents bigint NOT NULL, increment_cents bigint NOT NULL,
 current_cents bigint, leader_id uuid REFERENCES users(id), bid_count integer NOT NULL DEFAULT 0,
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, cancelled_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT auction_dates CHECK (ends_at > starts_at),
 CONSTRAINT auction_money CHECK (initial_cents BETWEEN 1 AND 100000000 AND increment_cents BETWEEN 1 AND 100000000 AND (current_cents IS NULL OR current_cents BETWEEN initial_cents AND 100000000)),
 CONSTRAINT auction_leader CHECK ((leader_id IS NULL AND current_cents IS NULL AND bid_count=0) OR (leader_id IS NOT NULL AND current_cents IS NOT NULL AND bid_count>0)),
 CONSTRAINT auction_cancel CHECK (cancelled_at IS NULL OR bid_count=0)
);
CREATE INDEX auctions_owner_idx ON auctions(owner_id);
CREATE INDEX auctions_ends_idx ON auctions(ends_at);
CREATE TABLE bids (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), auction_id uuid NOT NULL REFERENCES auctions(id),
 bidder_id uuid NOT NULL REFERENCES users(id), amount_cents bigint NOT NULL,
 sequence integer NOT NULL, idempotency_key uuid NOT NULL, created_at timestamptz NOT NULL,
 UNIQUE (auction_id,sequence), UNIQUE (bidder_id,idempotency_key),
 CONSTRAINT bid_money CHECK (amount_cents BETWEEN 1 AND 100000000 AND sequence>0)
);
CREATE INDEX bids_bidder_idx ON bids(bidder_id,auction_id);
