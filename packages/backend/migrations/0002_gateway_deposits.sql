-- Track advertiser USDC deposits into the platform Gateway Wallet.
-- The Gateway Wallet is a single pool; this table tracks per-advertiser accounting.
CREATE TABLE IF NOT EXISTS gateway_deposits (
  id TEXT PRIMARY KEY,
  advertiser_address TEXT NOT NULL,
  amount_usdc REAL NOT NULL,
  tx_hash TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Rename vault_tx_hash → nanopayment_tx_ids in settlements
-- (SQLite doesn't support RENAME COLUMN on older versions, so we keep
--  the column but use it for nanopayment tx IDs going forward)

CREATE INDEX IF NOT EXISTS idx_deposits_advertiser ON gateway_deposits(advertiser_address);
