CREATE TABLE IF NOT EXISTS users (
  address TEXT PRIMARY KEY,
  nullifier TEXT UNIQUE,
  verified INTEGER NOT NULL DEFAULT 0,
  total_hat_earned REAL NOT NULL DEFAULT 0,
  total_usdc_earned REAL NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS view_sessions (
  id TEXT PRIMARY KEY,
  user_address TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  usdc_earned REAL NOT NULL DEFAULT 0,
  hat_earned REAL NOT NULL DEFAULT 0,
  settled INTEGER NOT NULL DEFAULT 0,
  settlement_id TEXT,
  FOREIGN KEY (user_address) REFERENCES users(address)
);

CREATE TABLE IF NOT EXISTS ads (
  id TEXT PRIMARY KEY,
  advertiser_address TEXT NOT NULL,
  image_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  title TEXT NOT NULL,
  budget_allocated_usdc REAL NOT NULL DEFAULT 0,
  budget_spent_usdc REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  vault_tx_hash TEXT,
  hat_tx_hash TEXT,
  total_usdc REAL NOT NULL DEFAULT 0,
  total_hat REAL NOT NULL DEFAULT 0,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  settled_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_sessions_unsettled ON view_sessions(settled) WHERE settled = 0;
CREATE INDEX IF NOT EXISTS idx_sessions_user ON view_sessions(user_address);
CREATE INDEX IF NOT EXISTS idx_ads_active ON ads(active) WHERE active = 1;
