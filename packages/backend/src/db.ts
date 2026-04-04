/// D1 query helpers — all async, take db as first arg

type D1 = D1Database;
type Row = Record<string, unknown>;

export async function upsertUser(db: D1, address: string) {
  await db.prepare("INSERT INTO users (address, verified) VALUES (?, 0) ON CONFLICT(address) DO NOTHING").bind(address).run();
}

export async function verifyUser(db: D1, nullifier: string, address: string) {
  await db.prepare("UPDATE users SET verified = 1, nullifier = ? WHERE address = ?").bind(nullifier, address).run();
}

export async function getUser(db: D1, address: string): Promise<Row | null> {
  return db.prepare("SELECT * FROM users WHERE address = ?").bind(address).first();
}

export async function getUserByNullifier(db: D1, nullifier: string): Promise<Row | null> {
  return db.prepare("SELECT * FROM users WHERE nullifier = ?").bind(nullifier).first();
}

export async function insertSession(db: D1, id: string, userAddress: string, adId: string, startedAt: number) {
  await db.prepare("INSERT INTO view_sessions (id, user_address, ad_id, started_at) VALUES (?, ?, ?, ?)").bind(id, userAddress, adId, startedAt).run();
}

export async function getSession(db: D1, id: string): Promise<Row | null> {
  return db.prepare("SELECT * FROM view_sessions WHERE id = ?").bind(id).first();
}

export async function endSession(db: D1, id: string, endedAt: number, durationSeconds: number, usdcEarned: number, hatEarned: number) {
  await db.prepare("UPDATE view_sessions SET ended_at = ?, duration_seconds = ?, usdc_earned = ?, hat_earned = ? WHERE id = ?").bind(endedAt, durationSeconds, usdcEarned, hatEarned, id).run();
}

export async function getUnsettledSessions(db: D1): Promise<Row[]> {
  const result = await db.prepare(`
    SELECT vs.*, u.verified FROM view_sessions vs
    JOIN users u ON vs.user_address = u.address
    WHERE vs.settled = 0 AND vs.ended_at IS NOT NULL AND u.verified = 1
  `).all();
  return result.results as Row[];
}

export async function markSettled(db: D1, settlementId: string, sessionId: string) {
  await db.prepare("UPDATE view_sessions SET settled = 1, settlement_id = ? WHERE id = ?").bind(settlementId, sessionId).run();
}

export async function updateUserEarnings(db: D1, hat: number, usdc: number, address: string) {
  await db.prepare("UPDATE users SET total_hat_earned = total_hat_earned + ?, total_usdc_earned = total_usdc_earned + ? WHERE address = ?").bind(hat, usdc, address).run();
}

export async function insertAd(db: D1, id: string, advertiserAddress: string, imageUrl: string, targetUrl: string, title: string, budgetUsdc: number, imageWide?: string, imageTall?: string) {
  await db.prepare("INSERT INTO ads (id, advertiser_address, image_url, target_url, title, budget_allocated_usdc, image_wide, image_tall) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(id, advertiserAddress, imageUrl, targetUrl, title, budgetUsdc, imageWide ?? null, imageTall ?? null).run();
}

export async function getActiveAds(db: D1): Promise<Row[]> {
  const result = await db.prepare("SELECT * FROM ads WHERE active = 1 AND budget_spent_usdc < budget_allocated_usdc").all();
  return result.results as Row[];
}

export async function getAdsByAdvertiser(db: D1, address: string): Promise<Row[]> {
  const result = await db.prepare("SELECT * FROM ads WHERE advertiser_address = ?").bind(address).all();
  return result.results as Row[];
}

export async function updateAdSpend(db: D1, amount: number, adId: string) {
  await db.prepare("UPDATE ads SET budget_spent_usdc = budget_spent_usdc + ? WHERE id = ?").bind(amount, adId).run();
}

export async function getAdAdvertiser(db: D1, adId: string): Promise<Row | null> {
  return db.prepare("SELECT advertiser_address FROM ads WHERE id = ?").bind(adId).first();
}

export async function insertSettlement(db: D1, id: string, vaultTxHash: string | null, hatTxHash: string | null, totalUsdc: number, totalHat: number, recipientCount: number) {
  await db.prepare("INSERT INTO settlements (id, vault_tx_hash, hat_tx_hash, total_usdc, total_hat, recipient_count) VALUES (?, ?, ?, ?, ?, ?)").bind(id, vaultTxHash, hatTxHash, totalUsdc, totalHat, recipientCount).run();
}

export async function getSettlements(db: D1): Promise<Row[]> {
  const result = await db.prepare("SELECT * FROM settlements ORDER BY settled_at DESC LIMIT 50").all();
  return result.results as Row[];
}

// ── Gateway deposit tracking ────────────────────────────────────

export async function insertGatewayDeposit(db: D1, id: string, advertiserAddress: string, amountUsdc: number, txHash: string | null) {
  await db.prepare("INSERT INTO gateway_deposits (id, advertiser_address, amount_usdc, tx_hash) VALUES (?, ?, ?, ?)").bind(id, advertiserAddress, amountUsdc, txHash).run();
}

export async function getAdvertiserDeposits(db: D1, advertiserAddress: string): Promise<Row[]> {
  const result = await db.prepare("SELECT * FROM gateway_deposits WHERE advertiser_address = ? ORDER BY created_at DESC").bind(advertiserAddress).all();
  return result.results as Row[];
}

export async function getAdvertiserTotalDeposited(db: D1, advertiserAddress: string): Promise<number> {
  const result = await db.prepare("SELECT COALESCE(SUM(amount_usdc), 0) as total FROM gateway_deposits WHERE advertiser_address = ?").bind(advertiserAddress).first();
  return (result?.total as number) ?? 0;
}

export async function getAdvertiserTotalSpent(db: D1, advertiserAddress: string): Promise<number> {
  const result = await db.prepare("SELECT COALESCE(SUM(budget_spent_usdc), 0) as total FROM ads WHERE advertiser_address = ?").bind(advertiserAddress).first();
  return (result?.total as number) ?? 0;
}

// Live accrued USDC: unsettled sessions still accumulating against this advertiser's ads
export async function getAdvertiserAccruedUsdc(db: D1, advertiserAddress: string): Promise<number> {
  const result = await db.prepare(`
    SELECT COALESCE(SUM(vs.usdc_earned), 0) as accrued
    FROM view_sessions vs
    JOIN ads a ON vs.ad_id = a.id
    WHERE a.advertiser_address = ? AND vs.settled = 0 AND vs.ended_at IS NOT NULL
  `).bind(advertiserAddress).first();
  return (result?.accrued as number) ?? 0;
}

// Active (in-progress) session count + estimated live USDC for sessions not yet ended
export async function getAdvertiserActiveSessions(db: D1, advertiserAddress: string): Promise<{ count: number; oldestStartedAt: number | null }> {
  const result = await db.prepare(`
    SELECT COUNT(*) as cnt, MIN(vs.started_at) as oldest
    FROM view_sessions vs
    JOIN ads a ON vs.ad_id = a.id
    WHERE a.advertiser_address = ? AND vs.ended_at IS NULL
  `).bind(advertiserAddress).first();
  return { count: (result?.cnt as number) ?? 0, oldestStartedAt: (result?.oldest as number) ?? null };
}

// ── Click tracking ──────────────────────────────────────────────

export async function getAd(db: D1, adId: string): Promise<Row | null> {
  return db.prepare("SELECT * FROM ads WHERE id = ?").bind(adId).first();
}

export async function insertClick(db: D1, id: string, userAddress: string, adId: string, sessionId: string | null, usdcReward: number, hatReward: number) {
  await db.prepare("INSERT INTO ad_clicks (id, user_address, ad_id, session_id, usdc_reward, hat_reward) VALUES (?, ?, ?, ?, ?, ?)").bind(id, userAddress, adId, sessionId ?? null, usdcReward, hatReward).run();
}

export async function getUnsettledClicks(db: D1): Promise<Row[]> {
  const result = await db.prepare(`
    SELECT c.*, u.verified FROM ad_clicks c
    JOIN users u ON c.user_address = u.address
    WHERE c.settled = 0 AND u.verified = 1
  `).all();
  return result.results as Row[];
}

export async function markClickSettled(db: D1, settlementId: string, clickId: string) {
  await db.prepare("UPDATE ad_clicks SET settled = 1, settlement_id = ? WHERE id = ?").bind(settlementId, clickId).run();
}

export async function getClicksByAd(db: D1, adId: string): Promise<Row[]> {
  const result = await db.prepare("SELECT * FROM ad_clicks WHERE ad_id = ? ORDER BY clicked_at DESC LIMIT 100").bind(adId).all();
  return result.results as Row[];
}

export async function getClickCountByAd(db: D1, adId: string): Promise<number> {
  const result = await db.prepare("SELECT COUNT(*) as cnt FROM ad_clicks WHERE ad_id = ?").bind(adId).first();
  return (result?.cnt as number) ?? 0;
}

export async function deactivateAd(db: D1, adId: string, advertiserAddress: string) {
  await db.prepare("UPDATE ads SET active = 0 WHERE id = ? AND advertiser_address = ?").bind(adId, advertiserAddress).run();
}

export async function activateAd(db: D1, adId: string, advertiserAddress: string) {
  await db.prepare("UPDATE ads SET active = 1 WHERE id = ? AND advertiser_address = ?").bind(adId, advertiserAddress).run();
}
