ALTER TABLE auctions ADD COLUMN settled_at timestamptz;
-- Existing histories are imported once with an explicit legacy baseline; never claim retroactive authenticity.
ALTER TABLE auctions ADD COLUMN audit_version integer NOT NULL DEFAULT 0;
ALTER TABLE auctions ALTER COLUMN audit_version SET DEFAULT 1;
CREATE INDEX auctions_pending_settlement_idx ON auctions(ends_at) WHERE settled_at IS NULL AND cancelled_at IS NULL;
ALTER TABLE wallet_entries ADD COLUMN auction_id uuid REFERENCES auctions(id);
ALTER TABLE wallet_entries DROP CONSTRAINT wallet_entries_amount_cents_check;
ALTER TABLE wallet_entries DROP CONSTRAINT wallet_entries_kind_check;
ALTER TABLE wallet_entries ADD CONSTRAINT wallet_entries_amount_cents_check CHECK (
 (kind='PURCHASE' AND amount_cents<0) OR (kind IN ('DEPOSIT','SALE') AND amount_cents>0)
);
ALTER TABLE wallet_entries ADD CONSTRAINT wallet_entries_kind_check CHECK (
 (kind='DEPOSIT' AND auction_id IS NULL) OR (kind IN ('PURCHASE','SALE') AND auction_id IS NOT NULL)
);
ALTER TABLE wallet_entries ADD UNIQUE (auction_id,kind);
CREATE TABLE audit_records (
 auction_id uuid NOT NULL REFERENCES auctions(id) ON DELETE CASCADE, sequence integer NOT NULL CHECK(sequence>=0),
 previous_hash text NOT NULL, payload jsonb NOT NULL, hash text NOT NULL, signature text NOT NULL,
 published_at timestamptz, UNIQUE(auction_id,sequence)
);
CREATE TABLE receipts (
 id uuid PRIMARY KEY, auction_id uuid NOT NULL UNIQUE REFERENCES auctions(id) ON DELETE CASCADE,
 winner_id uuid NOT NULL REFERENCES users(id), winner_public_id uuid NOT NULL, item jsonb NOT NULL,
 amount_cents bigint NOT NULL CHECK(amount_cents BETWEEN 1 AND 100000000), ended_at timestamptz NOT NULL, settled_at timestamptz NOT NULL
);
