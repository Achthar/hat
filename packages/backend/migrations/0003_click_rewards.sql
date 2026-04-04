-- Per-click bonus: advertiser sets a USDC reward for clicking through to target
ALTER TABLE ads ADD COLUMN click_reward_usdc REAL NOT NULL DEFAULT 0;

-- Track individual ad clicks
CREATE TABLE IF NOT EXISTS ad_clicks (
  id TEXT PRIMARY KEY,
  user_address TEXT NOT NULL,
  ad_id TEXT NOT NULL,
  session_id TEXT,
  usdc_reward REAL NOT NULL DEFAULT 0,
  hat_reward REAL NOT NULL DEFAULT 0,
  settled INTEGER NOT NULL DEFAULT 0,
  settlement_id TEXT,
  clicked_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_address) REFERENCES users(address),
  FOREIGN KEY (ad_id) REFERENCES ads(id)
);

CREATE INDEX IF NOT EXISTS idx_clicks_unsettled ON ad_clicks(settled) WHERE settled = 0;
CREATE INDEX IF NOT EXISTS idx_clicks_user ON ad_clicks(user_address);
CREATE INDEX IF NOT EXISTS idx_clicks_ad ON ad_clicks(ad_id);
