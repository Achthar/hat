import Database from "better-sqlite3";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATABASE_URL || join(__dirname, "..", "hat.db");

export const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma("journal_mode = WAL");

db.exec(`
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
`);

// Prepared statements for hot paths
export const stmts = {
  upsertUser: db.prepare(`
    INSERT INTO users (address, verified) VALUES (?, 0)
    ON CONFLICT(address) DO NOTHING
  `),
  verifyUser: db.prepare(`
    UPDATE users SET verified = 1, nullifier = ? WHERE address = ?
  `),
  getUser: db.prepare(`SELECT * FROM users WHERE address = ?`),
  getUserByNullifier: db.prepare(`SELECT * FROM users WHERE nullifier = ?`),

  insertSession: db.prepare(`
    INSERT INTO view_sessions (id, user_address, ad_id, started_at)
    VALUES (?, ?, ?, ?)
  `),
  endSession: db.prepare(`
    UPDATE view_sessions SET ended_at = ?, duration_seconds = ?, usdc_earned = ?, hat_earned = ?
    WHERE id = ?
  `),
  getSession: db.prepare(`SELECT * FROM view_sessions WHERE id = ?`),
  getUnsettledSessions: db.prepare(`
    SELECT vs.*, u.verified FROM view_sessions vs
    JOIN users u ON vs.user_address = u.address
    WHERE vs.settled = 0 AND vs.ended_at IS NOT NULL AND u.verified = 1
  `),
  markSettled: db.prepare(`
    UPDATE view_sessions SET settled = 1, settlement_id = ? WHERE id = ?
  `),
  updateUserEarnings: db.prepare(`
    UPDATE users SET total_hat_earned = total_hat_earned + ?, total_usdc_earned = total_usdc_earned + ?
    WHERE address = ?
  `),

  insertAd: db.prepare(`
    INSERT INTO ads (id, advertiser_address, image_url, target_url, title, budget_allocated_usdc)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  getActiveAds: db.prepare(`
    SELECT * FROM ads WHERE active = 1 AND budget_spent_usdc < budget_allocated_usdc
  `),
  getAdsByAdvertiser: db.prepare(`SELECT * FROM ads WHERE advertiser_address = ?`),
  updateAdSpend: db.prepare(`
    UPDATE ads SET budget_spent_usdc = budget_spent_usdc + ? WHERE id = ?
  `),

  insertSettlement: db.prepare(`
    INSERT INTO settlements (id, vault_tx_hash, hat_tx_hash, total_usdc, total_hat, recipient_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  getSettlements: db.prepare(`SELECT * FROM settlements ORDER BY settled_at DESC LIMIT 50`),
};
