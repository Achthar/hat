# HAT — Human Attention Token

A verified human attention marketplace on **Arc**, Circle's purpose-built L1 blockchain. Users earn **USDC nanopayments** for viewing ads, with bonus **HAT tokens** as an incentive layer on top.

Powered by **Circle Gateway nanopayments**, **World ID 4.0** proof-of-human, and **Arc's USDC-native gas**.

---

## How It Works

```
 Advertiser                    Platform (Arc)                  Viewer
 ──────────                    ──────────────                  ──────
     │                              │                              │
     │  1. Fund Gateway Wallet      │                              │
     │  ───────────────────────►    │                              │
     │  (native USDC on Arc)        │                              │
     │                              │                              │
     │  2. Create Campaign          │                              │
     │  ───────────────────────►    │                              │
     │  (title, banner, budget)     │                              │
     │                              │                              │
     │                              │    3. Verify Humanity        │
     │                              │    ◄─────────────────────    │
     │                              │    (World ID orb proof)      │
     │                              │                              │
     │                              │    4. View Ads (extension)   │
     │                              │    ◄─────────────────────    │
     │                              │    IntersectionObserver +    │
     │                              │    15s heartbeats            │
     │                              │                              │
     │                              │    5. USDC Nanopayment       │
     │                              │    ─────────────────────►    │
     │                              │    EIP-3009 signed offchain  │
     │                              │    (gas-free, via Gateway)   │
     │                              │                              │
     │                              │    6. HAT Bonus Mint         │
     │                              │    ─────────────────────►    │
     │                              │    batchMint on-chain        │
     │                              │    (incentive layer)         │
```

---

## USDC Nanopayment Flow (Circle Gateway)

HAT uses Circle's **x402-based nanopayments** for gas-free USDC micropayments on Arc Testnet.

### 1. Advertiser Deposits USDC

Advertisers send native USDC (Arc's gas token) to the platform's Gateway wallet. This funds the nanopayment pool for their campaigns.

### 2. Offchain Payment Signing (EIP-3009)

When a verified view session ends, the backend signs an **EIP-3009 `TransferWithAuthorization`** — an offchain signature authorizing USDC transfer from the Gateway wallet to the viewer. **Zero gas required.**

```
Platform Wallet  ──[sign offchain]──►  EIP-3009 Authorization
                                           │
                                           ▼
                                    Circle Gateway API
                                    POST /gateway/v1/x402/settle
                                           │
                                           ▼
                                    Funds locked instantly
                                    (viewer credited)
```

### 3. Batched On-Chain Settlement

Circle's Gateway collects signed authorizations and settles them in a **single batched on-chain transaction**. Gas is absorbed by Circle, making the per-payment cost effectively zero.

### 4. HAT Token Bonus (On-Chain)

HAT tokens are minted proportionally to USDC earned:

```
HAT earned = USDC earned × 10,000
```

At $0.0001/sec USDC rate, this equals ~1 HAT/sec — an incentive to keep viewing. HAT is minted via `HATToken.batchMint()` in the same settlement cycle.

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Browser Extension│────▶│  Backend (API)   │────▶│  Arc Chain      │
│ - Ad sidebar     │     │  - World ID v4   │     │  - Gateway      │
│ - Ad replacement │     │  - View metering │     │    nanopayments │
│ - View tracking  │     │  - Nanopayment   │     │  - HATToken     │
│ - Heartbeat      │     │    settlement    │     │  - PayoutVault  │
└─────────────────┘     │  - SQLite DB     │     │    (fallback)   │
                        └──────────────────┘     └─────────────────┘
┌─────────────────┐              │
│ Demo Frontend   │──────────────┘
│ - Wallet connect│
│ - World ID flow │
└─────────────────┘
┌─────────────────┐              │
│ Advertiser UI   │──────────────┘
│ - Gateway fund  │
│ - Campaign mgmt │
└─────────────────┘
```

## Packages

| Package | Tech | Port | Description |
|---|---|---|---|
| `packages/common` | TypeScript | — | Shared types, ABIs, constants, chain config |
| `packages/contracts` | Solidity + Foundry | — | HATToken (batch mint) + PayoutVault (USDC escrow, fallback) |
| `packages/backend` | Hono + Cloudflare Workers + D1 | 3001 | World ID v4, view metering, nanopayment settlement |
| `packages/extension` | TypeScript + Vite (Chrome MV3) | — | Ad sidebar, ad replacement, view tracking w/ heartbeat |
| `packages/web` | React + Vite | 3000 | Demo site + World ID verify page + wallet connect |
| `packages/advertiser` | React + Vite | 3002 | Campaign management + Gateway wallet funding |

## Key Technologies

| Layer | Technology |
|-------|-----------|
| **Payments** | Circle Gateway nanopayments (x402 + EIP-3009) |
| **Blockchain** | Arc Testnet (chain ID 5042002, USDC-native gas) |
| **Identity** | World ID 4.0 (orb-level proof-of-human) |
| **Backend** | Hono on Cloudflare Workers + D1 (SQLite) |
| **Frontend** | React 19 + Vite |
| **Extension** | Chrome Manifest V3 |

## Payment Rates

| Metric | Rate |
|--------|------|
| USDC per second | $0.0001 (~$0.36/hr) |
| HAT per USDC | 10,000 HAT / $1 |
| HAT per second | ~1 HAT/sec (derived from USDC) |
| Platform fee | 2.5% (250 bps) |
| Nanopayment gas cost | $0 (Circle-sponsored batch settlement) |

---

## What's Implemented

- [x] pnpm monorepo with 6 packages
- [x] **Circle Gateway nanopayments** — EIP-3009 offchain signing + batched settlement (gas-free USDC micropayments)
- [x] **HATToken.sol** — ERC-20 with `batchMint()` for gas-efficient multi-recipient minting (incentive layer)
- [x] **PayoutVault.sol** — advertiser USDC escrow, batch distribute (fallback / smart contract prize)
- [x] Foundry tests (5/5 passing) + Arc testnet deploy script
- [x] Backend with D1 persistence — users, view sessions, ads, settlements
- [x] World ID v4 verification with nullifier uniqueness
- [x] Nanopayment settlement — signs EIP-3009 per viewer, submits to Gateway, then batch mints HAT
- [x] Browser extension — ad sidebar, IntersectionObserver tracking, heartbeat, earnings display
- [x] Advertiser Gateway funding flow (native USDC send on Arc)
- [x] Gateway status endpoint (`/api/nanopayments/status`)
- [x] USDC-primary UI — USDC is the main earning metric, HAT shown as bonus
- [x] Dev mode: seed data, mock verification, settlement without on-chain

## What's Left

- [ ] Deploy HATToken contract to Arc testnet
- [ ] Fill contract address in `packages/common/src/constants.ts`
- [ ] Fund platform Gateway wallet with USDC for nanopayment settlement
- [ ] Video demo + architecture diagram for submission

---

## Quick Start

```bash
pnpm install

# Build shared types
pnpm --filter @hat/common build

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

### Environment Variables (backend)

```env
WORLD_ID_RP_ID=app_...
WORLD_ID_SIGNING_KEY=...
DEPLOYER_PRIVATE_KEY=0x...       # For HATToken minting
ARC_RPC_URL=https://testnet-rpc.arc.circle.com
GATEWAY_PRIVATE_KEY=0x...        # Platform wallet for nanopayments
```

### API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/nanopayments/status` | Gateway wallet status + balance |
| `POST /api/settlement/batch` | Trigger nanopayment settlement + HAT mint |
| `GET /api/settlement/history` | Settlement history |
| `POST /api/views/start` | Start ad view session |
| `POST /api/views/end` | End session, calculate USDC + HAT |
| `POST /api/dev/seed` | Seed demo ads |
| `POST /api/dev/mock-verify` | Mock-verify a user (skip World ID) |

---

## Flow

1. **User** connects wallet on demo site, verifies humanity via World ID 4.0
2. **Advertiser** connects wallet, creates campaign, funds Gateway wallet with native USDC on Arc
3. **Extension** fetches active ads, injects sidebar + replaces existing ads, tracks view time via IntersectionObserver + heartbeat
4. **Backend** records view sessions in D1, calculates `usdcEarned` (primary) and `hatEarned = usdcEarned * 10,000` (bonus)
5. **Settlement** signs EIP-3009 nanopayments per viewer (gas-free via Gateway) + batch mints HAT tokens on-chain

---

## Bounty: Best Agentic Economy with Nanopayments ($6,000)

HAT demonstrates:

- **Automated content monetization** — viewers earn $0.0001/sec USDC for verified ad attention
- **Gas-free nanopayments** — EIP-3009 offchain signing + Circle Gateway batch settlement
- **Autonomous agent behavior** — the browser extension acts as an agent: detects ads, tracks attention via IntersectionObserver, triggers payments without human intervention
- **Proof-of-human gating** — World ID 4.0 ensures only verified humans earn, preventing bot fraud
- **Incentive stacking** — HAT bonus tokens on top of USDC create dual incentive alignment
