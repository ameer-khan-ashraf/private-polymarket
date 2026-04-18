# Private Polymarket

A private social betting app for friends, built with Next.js 16, shadcn/ui, Solidity smart contracts on Polygon Amoy, and Supabase for private metadata.

## 🏗️ Architecture

### Hybrid Data Model

The platform uses a **hybrid privacy architecture**:

- **Smart Contract (On-Chain)**: Handles pooled betting, resolution, and claims by `marketId`
- **Supabase (Off-Chain)**: Stores private market metadata, invite codes, labels, and creator mappings
- **Frontend**: Uses Supabase data for UX and contract reads/writes for market state and payouts
- **Fallback Mode**: Uses local mock data when Supabase is unavailable

### Tech Stack

- **Frontend**: Next.js 16 (App Router), Tailwind CSS v4, shadcn/ui, Lucide React
- **Web3**: RainbowKit + Wagmi (wallet connection), ethers.js
- **Smart Contract**: Solidity 0.8.20 on Polygon Amoy Testnet
- **Backend**: Supabase (PostgreSQL)

## 📁 Project Structure

```
private-polymarket/
├── app/                    # Next.js frontend
│   ├── src/app/            # App Router pages
│   │   ├── page.tsx        # Dashboard ("My Bets")
│   │   ├── create/page.tsx # Create bet flow
│   │   ├── join/page.tsx   # Join by invite code
│   │   └── bet/[id]/page.tsx # Bet detail + trading/resolution
│   ├── src/components/     # UI and feature components
│   └── src/lib/            # Utilities, wallet context, supabase, mock data
├── contracts/             # Hardhat smart contract project
│   ├── contracts/        # Solidity contracts
│   │   └── PrivateMarket.sol
│   ├── scripts/          # Deployment scripts
│   ├── test/             # Contract tests
│   └── hardhat.config.js
└── supabase/             # Database migrations
    └── migrations/
        └── 001_create_markets_table.sql
```

## 🎯 Core Logic: Parimutuel Betting

### How It Works

1. **Users bet on YES or NO** - No fixed odds
2. **Winners split the losing pool** proportionally to their bet
3. **Critical Edge Case**: If losing pool = $0 (no one took the other side), winners get **REFUNDED** their original bet

### Payout Formula

```
If losingPool == 0:
    payout = originalBet (REFUND)
Else:
    payout = originalBet + (originalBet * losingPool / winningPool)
```

### Example

**Scenario 1: Normal Case**
- YES pool: $100 (Alice: $60, Bob: $40)
- NO pool: $50
- Outcome: YES wins
- Alice gets: $60 + ($60 * $50 / $100) = $90
- Bob gets: $40 + ($40 * $50 / $100) = $60

**Scenario 2: Edge Case (Refund)**
- YES pool: $100 (Alice: $60, Bob: $40)
- NO pool: $0 (no one bet NO)
- Outcome: YES wins
- Alice gets: $60 (REFUND)
- Bob gets: $40 (REFUND)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- MetaMask or compatible Web3 wallet
- Polygon Amoy testnet MATIC (get from [faucet](https://faucet.polygon.technology/))

### 1. Smart Contract Setup

```bash
cd contracts

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env and add:
# - POLYGON_AMOY_RPC_URL
# - PRIVATE_KEY (your wallet private key)
# - ETHERSCAN_API_KEY (Etherscan V2 key, used for Polygonscan verification)

# Compile contracts
npx hardhat compile

# Deploy to Polygon Amoy
npx hardhat run scripts/deploy.js --network amoy

# Save the deployed contract address!
```

### 2. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor
3. Run the migration file: `supabase/migrations/001_create_markets_table.sql`
4. Save your Supabase URL and anon key

### 3. Frontend Setup

```bash
cd app

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Add to .env.local:
# NEXT_PUBLIC_MARKET_CONTRACT_ADDRESS=<your_deployed_contract_address>
# NEXT_PUBLIC_SUPABASE_URL=<your_supabase_url>
# NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_supabase_anon_key>
# NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<your_walletconnect_project_id>

# Run development server
npm run dev
```

Visit `http://localhost:3000`

### Main Routes

- `/` - My Bets dashboard, filters, wallet state, fallback status
- `/create` - Create a new bet
- `/join` - Join with invite code
- `/bet/[id]` - Bet detail, pool state, place bet, resolve, and claim

## 📝 Smart Contract API

### Key Functions

#### `createMarket(uint256 _resolutionTime) → uint256`
Creates a new prediction market
- `_resolutionTime`: Unix timestamp when betting closes
- Returns: `marketId`

#### `placeBet(uint256 _marketId, bool _isYes) payable`
Place a bet on a market
- `_marketId`: Market to bet on
- `_isYes`: true for YES, false for NO
- Send ETH/MATIC with transaction

#### `resolveMarket(uint256 _marketId, bool _outcome)`
Resolve a market (only creator)
- `_marketId`: Market to resolve
- `_outcome`: true if YES wins, false if NO wins

#### `claimWinnings(uint256 _marketId)`
Claim winnings or refund after resolution
- Automatically handles refund if losing pool = 0

#### View Functions
- `getMarket(uint256 _marketId)` - Get market details
- `getUserBet(uint256 _marketId, address _user)` - Get user's bet
- `calculatePayout(uint256 _marketId, address _user)` - Calculate potential payout
- `getTotalValueLocked(uint256 _marketId)` - Get total ETH in market

## 🗄️ Database Schema

### `markets` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key for frontend URLs |
| `question_text` | TEXT | The actual question (private) |
| `image_url` | TEXT | Optional market image |
| `chain_market_id` | BIGINT | On-chain market ID (unique) |
| `creator_address` | TEXT | Wallet address of creator |
| `resolution_time` | TIMESTAMPTZ | When betting closes |
| `resolved` | BOOLEAN | Market resolution status |
| `outcome` | BOOLEAN | true = YES wins, false = NO wins |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

## ✅ Current Feature Status

- Wallet connection via RainbowKit + Wagmi
- Dashboard with:
  - Active/open/resolved bet filters
  - User-level summary stats (active, staked, won, claimable/balance)
  - Supabase online/offline badge
- Supabase-backed bet metadata with mock data fallback
- Bet detail page with:
  - Live on-chain pool reads and payout estimates
  - Bet placement (`placeBet`)
  - Creator-only resolution controls (`resolveMarket`)
  - Winner/refund claiming (`claimWinnings`)
  - Invite link copy/share flow
- Create and Join routes for friend-based private bet flow
- Contract-level edge case support for refund when losing pool is zero
- Contract tests for:
  - market creation
  - betting and side-switch protection
  - resolution constraints (creator-only + timing)
  - normal winnings distribution
  - refund edge case
  - loser claim rejection

## 🔐 Security Considerations

1. **Private Key Management**: Never commit `.env` files
2. **Smart Contract Auditing**: Get contract audited before mainnet deployment
3. **Supabase RLS**: Implement Row Level Security policies for production
4. **Frontend Validation**: Always validate user inputs
5. **Testnet First**: Thoroughly test on Polygon Amoy before mainnet

## 🧪 Testing

```bash
cd contracts

# Run tests
npx hardhat test

# Run with gas reporting
REPORT_GAS=true npx hardhat test
```

## 📦 Deployment Checklist

- [ ] Deploy smart contract to Polygon Amoy
- [ ] Verify contract on Polygonscan
- [ ] Set up Supabase project and run migrations
- [ ] Configure environment variables
- [ ] Test market creation flow
- [ ] Test betting flow
- [ ] Test resolution and claiming
- [ ] Test edge case (refund when losing pool = 0)

## 🛠️ Next Steps

1. **Product**:
   - Add historical charting from on-chain events
   - Add richer participant activity timelines
   - Add private group-level leaderboards

2. **Backend**:
   - Add Row Level Security policies for production
   - Add server-side invite validation and rate limits
   - Add reconciliation jobs for Supabase and chain state

## 📄 License

MIT

## 🤝 Contributing

This is a private project for friends. Feel free to fork and customize!

---

**Built with ❤️ for private prediction markets among friends**
