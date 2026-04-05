# HAT — Human Attention Token

**The middleman-free ad network where advertisers pay humans directly for their attention.**

No ad networks. No upfront budgets. No bots. Just verified humans earning USDC micropayments for every second of attention — settled gaslessly on Arc.

---

## The Problem

Online advertising is broken:

- **Advertisers** overpay for impressions that are 40%+ bots, with ad networks taking 30-70% as middlemen
- **Users** get tracked, profiled, and shown irrelevant ads with zero compensation
- **Publishers** depend on opaque ad networks that dictate rates and delay payments

## The Solution

HAT removes the middleman entirely. Advertisers deposit USDC and set their own rates. Verified humans earn micropayments directly — per second of attention, per click-through. No minimums, no invoicing, no fraud.

| Traditional Ads | HAT |
|---|---|
| Pay ad network upfront | Pay per second/click as it happens |
| 40%+ bot traffic | World ID proof-of-human, zero bots |
| Ad network takes 30-70% | Direct advertiser → viewer payments |
| Monthly invoices, NET-30 | Gas-free USDC nanopayments, settled every 2 minutes |
| Users get nothing | Users earn USDC + HAT tokens |

---

## How It Works

### For Viewers

1. **Install** the HAT browser extension
2. **Verify humanity** with World ID (one-time orb scan)
3. **Browse normally** — the extension shows relevant ads in a sidebar and replaces existing ads
4. **Earn USDC** for every second of verified attention + bonus HAT tokens
5. Payments settle automatically — no claiming, no gas fees

### For Advertisers

1. **Connect wallet** on the advertiser dashboard
2. **Create a campaign** — set a banner, target URL, budget, and your own rates:
   - View rate (USDC per second of attention)
   - Click-through bonus (USDC per click)
3. **Deposit USDC** on Arc — funds the nanopayment pool
4. **Track performance** in real-time — views, clicks, CTR, spend breakdown per campaign
5. **Pause, resume, or withdraw** remaining funds at any time

### Settlement

Every 2 minutes, the platform settles all accrued earnings:

```
Viewer watches ad for 60 seconds at $0.0001/sec
  → Earns $0.006 USDC (gasless nanopayment)
  → Earns 60 HAT bonus tokens

Viewer clicks through to advertiser's site
  → Earns click bonus (set by advertiser, e.g. $0.01)
  → Earns 100 HAT bonus tokens
```

Payments are signed offchain (EIP-3009) and batched by Circle's Gateway — **zero gas cost per payment**.

---

## Key Design Principles

### No Middlemen

Advertisers create campaigns and fund them directly. Viewers earn directly. There is no ad network taking a cut, no auction system inflating prices, no opaque algorithms deciding who sees what.

### No Upfront Commitment

Micropayments mean advertisers pay exactly for what they get — $0.0001 per second of verified human attention. No minimum spend, no prepaid blocks of impressions, no wasted budget on unverified traffic.

### No Bots

Every viewer must verify their humanity through **World ID 4.0** (orb-level biometric verification). The nullifier system ensures one person = one account. Bot farms can't fake orb scans.

### No Gas Fees

Arc is Circle's L1 where **USDC is the native gas token**. Combined with Circle Gateway's batched settlement, individual micropayments cost $0 in gas. Circle absorbs all settlement costs.

---

## Architecture

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ Browser Extension │────▶│  Backend (API)   │────▶│  Arc Blockchain  │
│                  │     │                  │     │                  │
│ Ad sidebar       │     │ World ID v4      │     │ USDC nanopayments│
│ Ad replacement   │     │ View metering    │     │ (Circle Gateway) │
│ View tracking    │     │ Click tracking   │     │                  │
│ Click reporting  │     │ Settlement cron  │     │ HATToken ERC-20  │
│ Earnings display │     │ Analytics        │     │ (batch mint)     │
└──────────────────┘     │ D1 (SQLite)      │     │                  │
                         └──────────────────┘     └──────────────────┘
┌──────────────────┐              │
│ Viewer Frontend  │──────────────┘
│ World ID verify  │
│ Earnings stats   │
└──────────────────┘
┌──────────────────┐              │
│ Advertiser UI    │──────────────┘
│ Campaign CRUD    │
│ Deposit/Withdraw │
│ Live analytics   │
└──────────────────┘
```

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Payments** | Circle Gateway nanopayments (EIP-3009) | Gas-free USDC micropayments, batched settlement |
| **Blockchain** | Arc Testnet (chain 5042002) | USDC-native gas, sub-second finality |
| **Identity** | World ID 4.0 (orb verification) | Proof-of-human, prevents bot fraud |
| **Backend** | Hono + Cloudflare Workers + D1 | Edge-deployed, auto-scaling, cron settlement |
| **Extension** | Chrome Manifest V3 | Ad detection, view tracking, earnings display |
| **Frontend** | React 19 + Vite | Viewer dashboard + advertiser console |
| **Contracts** | Solidity + Foundry | HATToken ERC-20 with batch mint |

---

## Nanopayment Flow

```
Advertiser deposits USDC on Arc
        │
        ▼
Viewer watches ad (tracked by extension)
        │
        ▼
Backend calculates: $0.0001/sec × duration + click bonus
        │
        ▼
Platform signs EIP-3009 TransferWithAuthorization (offchain, $0 gas)
        │
        ▼
Submitted to Circle Gateway settle API
        │
        ▼
Circle batches all payments into 1 on-chain tx (Circle pays gas)
        │
        ▼
Viewer receives USDC + HAT tokens minted as bonus
```

## Advertiser Analytics

Each campaign tracks in real-time:
- **Views** / **Unique viewers** / **Average view duration**
- **Clicks** / **CTR%**
- **Spend breakdown**: view attention USDC vs click-through USDC
- **Cost metrics**: per view, per click, per unique viewer, per second

Advertisers can pause/resume campaigns and withdraw unspent USDC at any time.

---

## Quick Start

```bash
pnpm install
pnpm --filter @hat/common build

# Start locally
pnpm dev
# web:        http://localhost:3000
# backend:    http://localhost:3001
# advertiser: http://localhost:3002

# Build + load extension in chrome://extensions
pnpm --filter @hat/extension build
```

### Environment

```env
# Backend (Cloudflare Workers secrets)
WORLD_ID_RP_ID=rp_...
WORLD_ID_APP_ID=app_...
WORLD_ID_SIGNING_KEY=0x...
GATEWAY_PRIVATE_KEY=0x...
GATEWAY_WALLET_ADDRESS=0x0077777d7EBA4688BDeF3E311b846F25870A19B9

# Frontend
VITE_WORLD_ID_APP_ID=app_...
```

---

## Packages

| Package | Description |
|---|---|
| `packages/common` | Shared types, ABIs, constants |
| `packages/contracts` | HATToken + PayoutVault (Solidity/Foundry) |
| `packages/backend` | API server, settlement, nanopayments (Cloudflare Workers) |
| `packages/web` | Viewer site — World ID verify, earnings dashboard |
| `packages/advertiser` | Advertiser console — campaigns, deposits, analytics |
| `packages/extension` | Chrome extension — ad sidebar, view tracking, earnings |

---

*Built for the Arc hackathon — Best Agentic Economy with Nanopayments*
