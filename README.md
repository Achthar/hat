# HAT — Human Attention Token

A verified human attention marketplace where users earn USDC micropayments and HAT tokens for viewing ads, powered by World ID 4.0 proof-of-human and Arc chain micropayments.

## Hackathon Bounties

- **Best use of World ID 4.0** ($8k) — World ID is the core constraint: only verified humans earn rewards. Without it, bots farm ad views.
- **Best Smart Contracts on Arc with Advanced Stablecoin Logic** ($3k) — Advertiser USDC escrow → off-chain metering → batch settlement. Conditional escrow with automatic release.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Browser Extension│────▶│  Backend (API)   │────▶│  Arc Chain      │
│ - Ad sidebar     │     │  - World ID v4   │     │  - PayoutVault  │
│ - Ad replacement │     │  - View metering │     │  - HATToken     │
│ - View tracking  │     │  - Settlement    │     │  - USDC escrow  │
│ - Heartbeat      │     │  - SQLite DB     │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
┌─────────────────┐              │
│ Demo Frontend   │──────────────┘
│ - Wallet connect│
│ - World ID flow │
└─────────────────┘
┌─────────────────┐              │
│ Advertiser UI   │──────────────┘
│ - USDC deposit  │
│ - Campaign mgmt │
└─────────────────┘
```

## Packages

| Package | Tech | Port | Description |
|---|---|---|---|
| `packages/common` | TypeScript | — | Shared types, ABIs, constants, chain config |
| `packages/contracts` | Solidity + Foundry | — | PayoutVault (USDC escrow) + HATToken (batch mint) |
| `packages/backend` | Hono + Node + SQLite | 3001 | World ID v4 verify, view metering, settlement |
| `packages/extension` | TypeScript + Vite (Chrome MV3) | — | Ad sidebar, ad replacement, view tracking w/ heartbeat |
| `packages/web` | React + Vite | 3000 | Demo site + World ID verify page + wallet connect |
| `packages/advertiser` | React + Vite | 3002 | Campaign management + USDC deposit on Arc |


## Quick Start

```bash
pnpm install

# Contracts (requires Foundry)
cd packages/contracts
forge install openzeppelin/openzeppelin-contracts foundry-rs/forge-std --no-git
forge test

# Start everything
pnpm dev
# web:        http://localhost:3000
# backend:    http://localhost:3001
# advertiser: http://localhost:3002

# Build extension, then load dist/ as unpacked in chrome://extensions
pnpm --filter @hat/extension build
```

## Flow

1. **User** connects wallet on demo site → verifies humanity via World ID 4.0
2. **Advertiser** connects wallet → creates campaign → approves + deposits USDC into PayoutVault on Arc
3. **Extension** fetches active ads → injects sidebar + replaces existing ads → tracks view time via IntersectionObserver + heartbeat
4. **Backend** records view sessions in SQLite → settlement cron aggregates earnings
5. **Settlement** calls `PayoutVault.distribute()` (USDC from advertiser deposit to viewers) + `HATToken.batchMint()` (reward tokens)
