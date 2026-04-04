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

## What's Implemented

- [x] pnpm monorepo with 6 packages
- [x] **PayoutVault.sol** — advertiser USDC escrow, batch distribute to viewers, configurable platform fee (2.5%)
- [x] **HATToken.sol** — ERC-20 with `batchMint()` for gas-efficient multi-recipient minting
- [x] Foundry tests (5/5 passing) + Arc testnet deploy script
- [x] Backend with SQLite persistence — users, view sessions, ads, settlements
- [x] World ID v4 verification endpoint with nullifier uniqueness check
- [x] Settlement service — aggregates unsettled sessions, calls `distribute()` + `batchMint()`
- [x] Browser extension — ad sidebar injection, IntersectionObserver tracking, heartbeat loop, earnings display
- [x] Wallet connection (MetaMask) on both frontends
- [x] Advertiser USDC approve → deposit flow (with Arc testnet chain switching)
- [x] Demo frontend with live stats from backend

- [x] IDKit widget integrated for World ID verification (with RP signing backend)
- [x] Dev mode: seed data, mock verification, settlement without on-chain (graceful fallback)
- [x] Extension popup with live earnings refresh from backend
- [x] End-to-end flow verified: seed ads → verify user → view ad → end session → settle → earnings update

## What's Left

- [ ] Deploy contracts to Arc testnet (need funded deployer key + USDC address)
- [ ] Fill contract addresses in `packages/common/src/constants.ts` after deploy

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

# Seed demo ads for local testing
curl -X POST http://localhost:3001/api/dev/seed

# Build extension, then load dist/ as unpacked in chrome://extensions
pnpm --filter @hat/extension build
```

### Dev API Endpoints

| Endpoint | Description |
|---|---|
| `POST /api/dev/seed` | Seed 3 demo ads |
| `POST /api/dev/mock-verify` | Mock-verify a user (skip World ID) |
| `POST /api/dev/reset` | Clear all data |
| `GET /api/dev/stats` | Dashboard stats |
| `POST /api/settlement/batch` | Trigger settlement batch |

## Flow

1. **User** connects wallet on demo site → verifies humanity via World ID 4.0
2. **Advertiser** connects wallet → creates campaign → approves + deposits USDC into PayoutVault on Arc
3. **Extension** fetches active ads → injects sidebar + replaces existing ads → tracks view time via IntersectionObserver + heartbeat
4. **Backend** records view sessions in SQLite → settlement cron aggregates earnings
5. **Settlement** calls `PayoutVault.distribute()` (USDC from advertiser deposit to viewers) + `HATToken.batchMint()` (reward tokens)
