# Sidebets — Private Prediction Markets

A social betting app for friend groups. Create binary YES/NO markets on any life event, share invite codes, place MATIC stakes on-chain, and let the creator resolve the outcome for parimutuel payouts.

## Architecture

### Hybrid data model

- **Smart contract (on-chain)**: Pool accounting, bet placement, resolution enforcement, payout math, MATIC transfers
- **FastAPI + PostgreSQL (off-chain)**: Private market metadata — question text, invite codes, side labels, creator address
- **Frontend**: Reads metadata from FastAPI, reads/writes market state from the contract via wagmi

### Tech stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 16 (App Router), Tailwind CSS v4, shadcn/ui |
| Web3 | RainbowKit + Wagmi, viem, ethers.js |
| Backend | FastAPI (Python), SQLAlchemy async, asyncpg |
| Database | PostgreSQL (hosted on Neon) |
| Smart contract | Solidity 0.8.20 on Polygon Amoy Testnet |
| Backend hosting | Render |
| Frontend hosting | Vercel |

## Project structure

```
private-polymarket/
├── app/                        # Next.js 16 frontend
│   ├── src/app/
│   │   ├── page.tsx            # Dashboard — My Bets
│   │   ├── create/page.tsx     # Create bet (2-step form)
│   │   ├── join/page.tsx       # Join by invite code
│   │   └── bet/[id]/page.tsx   # Bet detail, place/resolve/claim
│   ├── src/components/         # UI components
│   ├── src/hooks/              # useCreateMarket, useCountdown
│   └── src/lib/
│       ├── apiClient.ts        # Typed fetch wrapper for FastAPI
│       ├── wallet-context.tsx  # Wagmi wrapper (isConnected, address, balance)
│       ├── config.ts           # Wagmi + RainbowKit config
│       └── abi/PrivateMarket.json
├── backend/                    # FastAPI REST API
│   ├── main.py                 # CRUD routes for markets
│   ├── models.py               # SQLAlchemy ORM model
│   ├── schemas.py              # Pydantic schemas
│   ├── database.py             # Async engine + session
│   ├── requirements.txt
│   ├── render.yaml             # Render deploy config
│   └── Procfile
├── contracts/                  # Hardhat project
│   ├── contracts/PrivateMarket.sol
│   ├── scripts/deploy.js
│   └── test/PrivateMarket.js
└── supabase/migrations/        # Initial schema reference (not actively used)
```

## Getting started

### Prerequisites

- Node.js 18+
- Python 3.11+
- MetaMask or compatible Web3 wallet
- Polygon Amoy testnet MATIC ([faucet](https://faucet.polygon.technology/))

### 1. Smart contract

```bash
cd contracts
npm install
cp .env.example .env
# Fill in POLYGON_AMOY_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY

npx hardhat compile
npx hardhat run scripts/deploy.js --network amoy
# Note the deployed contract address
```

### 2. Database (Neon)

1. Create a free project at [neon.tech](https://neon.tech)
2. Copy the `postgresql://...` connection string

The FastAPI backend creates the `markets` table automatically on first startup via SQLAlchemy's `create_all`.

### 3. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Create backend/.env
echo 'DATABASE_URL=postgresql://user:pass@host/dbname' > .env

uvicorn main:app --reload
# API running at http://localhost:8000
```

### 4. Frontend

```bash
cd app
npm install

# Create app/.env.local
NEXT_PUBLIC_MARKET_CONTRACT_ADDRESS=<deployed_contract_address>
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<walletconnect_project_id>
NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev
# App running at http://localhost:3000
```

## Deployment

### Backend → Render

1. Push `backend/` to GitHub
2. New Web Service on [render.com](https://render.com) → connect repo → root directory: `backend`
3. Render auto-detects `render.yaml`
4. Set `DATABASE_URL` in the Render environment tab

### Frontend → Vercel

1. Import repo on [vercel.com](https://vercel.com) → set root directory to `app`
2. Add env vars:
   - `NEXT_PUBLIC_MARKET_CONTRACT_ADDRESS`
   - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
   - `NEXT_PUBLIC_API_URL` = your Render backend URL

## Parimutuel payout formula

```
If losingPool == 0:
    payout = originalBet  (full refund — no one took the other side)
Else:
    payout = originalBet + (originalBet * losingPool / winningPool)
```

## Smart contract — key functions

| Function | Description |
|----------|-------------|
| `createMarket(uint256 resolutionTime)` | Creates market, returns `marketId` |
| `placeBet(uint256 marketId, bool isYes) payable` | Stakes MATIC on YES or NO |
| `resolveMarket(uint256 marketId, bool outcome)` | Creator-only, after deadline |
| `claimWinnings(uint256 marketId)` | Winners claim payout; refund if losing pool = 0 |
| `getMarket(uint256)` | Full market state |
| `getUserBet(uint256, address)` | User's bet amount, side, claimed status |
| `calculatePayout(uint256, address)` | Pre-claim payout estimate |

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/markets` | List all markets |
| POST | `/markets` | Create market |
| GET | `/markets/{id}` | Get market by UUID |
| GET | `/markets/by-invite/{code}` | Look up market by invite code |
| PATCH | `/markets/{id}` | Update market fields |
| DELETE | `/markets/{id}` | Delete market (cleanup on failed tx) |

## Testing contracts

```bash
cd contracts
npx hardhat test
REPORT_GAS=true npx hardhat test
```

## License

MIT
