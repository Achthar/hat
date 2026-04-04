-- Per-ad view rate: advertiser sets USDC per second of attention (overrides global default)
ALTER TABLE ads ADD COLUMN view_reward_per_second REAL NOT NULL DEFAULT 0.0001;
