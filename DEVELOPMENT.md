# DEVELOPMENT.md

## Prerequisites

- **Node.js 18+** (contracts and frontend both require it)
- **npm** (or yarn — commands below use npm)
- **Python 3.11+** (for the FastAPI backend)
- **MetaMask** or any injected EVM wallet
- **Polygon Amoy testnet MATIC** — get from the [Polygon Faucet](https://faucet.polygon.technology/)
- A **WalletConnect Cloud project ID** — free at [cloud.walletconnect.com](https://cloud.walletconnect.com)
- A **PostgreSQL database** — local, Railway, Supabase, or any provider

---

## Repository layout

```
private-polymarket/
├── app/          ← Next.js frontend
├── backend/      ← FastAPI REST API
├── contracts/    ← Hardhat smart contract project
└── supabase/     ← SQL migration files
```

Each subdirectory is an independent project with its own dependencies.

---

## 1. Smart contract setup

```bash
cd contracts

# Install dependencies
npm install

# Create .env from example
cp .env.example .env
```

Edit `contracts/.env`:

```env
POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology/
PRIVATE_KEY=<your_deployer_wallet_private_key_without_0x>
ETHERSCAN_API_KEY=<your_etherscan_v2_api_key>
```

> **Security**: never commit `contracts/.env`. It contains your private key.

```bash
# Compile the contract
npx hardhat compile

# Run tests against local Hardhat network
npx hardhat test

# Deploy to Polygon Amoy testnet
npx hardhat run scripts/deploy.js --network amoy
```

The deploy script outputs the contract address and attempts Polygonscan verification automatically. Save the deployed address — you'll need it for the frontend env.

The compiled ABI is at `contracts/artifacts/contracts/PrivateMarket.sol/PrivateMarket.json`. Copy it to `app/src/lib/abi/PrivateMarket.json` if you redeploy with contract changes:

```bash
cp contracts/artifacts/contracts/PrivateMarket.sol/PrivateMarket.json \
   app/src/lib/abi/PrivateMarket.json
```

---

## 2. Database setup

The backend needs a PostgreSQL database with the `markets` table.

### Option A — Use Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to SQL Editor → New Query
3. Paste and run the migration:

```bash
cat supabase/migrations/001_create_markets_table.sql
```

> **Note**: The migration SQL is missing several columns added in the backend model (`description`, `side_a_label`, `side_b_label`, `invite_code`, `min_stake`, `max_stake`). You must add them manually or let SQLAlchemy create the table directly (see Option B).

### Option B — Let SQLAlchemy create the schema

Set `DATABASE_URL` in the backend environment and start the server. The `lifespan` startup handler in `main.py` runs `Base.metadata.create_all` which creates the full table from the SQLAlchemy model automatically.

### Option C — Local PostgreSQL

```bash
createdb sidebets
```

Then set `DATABASE_URL=postgresql://localhost/sidebets` in the backend.

---

## 3. Backend setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # on Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variable
export DATABASE_URL="postgresql://user:password@host:5432/dbname"

# Run development server
uvicorn main:app --reload --port 8000
```

The API will be at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

**Available endpoints:**
- `GET /health` — health check
- `GET /markets` — list all markets
- `POST /markets` — create market
- `GET /markets/by-invite/:code` — look up by invite code (must be defined before `GET /markets/:id` in code — already done)
- `GET /markets/:id` — get by UUID
- `PATCH /markets/:id` — update fields
- `DELETE /markets/:id` — delete

---

## 4. Frontend setup

```bash
cd app

# Install dependencies
npm install

# Create .env.local
cp .env.example .env.local  # or create it manually
```

Edit `app/.env.local`:

```env
NEXT_PUBLIC_MARKET_CONTRACT_ADDRESS=0x96f608d53fdfE8D1964C2F2e176dd56B72B87303
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<your_walletconnect_project_id>
```

> Replace the contract address if you deployed a new instance.

```bash
# Start development server
npm run dev
```

Visit `http://localhost:3000`.

---

## Running locally (all three services)

Open three terminals:

```bash
# Terminal 1 — Backend
cd backend && source venv/bin/activate
DATABASE_URL="postgresql://..." uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd app && npm run dev

# Terminal 3 — (optional) Hardhat local node for testing
cd contracts && npx hardhat node
```

---

## Getting test MATIC for Polygon Amoy

1. Go to [faucet.polygon.technology](https://faucet.polygon.technology/)
2. Select **Amoy** network
3. Enter your wallet address
4. Receive 0.5 MATIC per request (enough for many test transactions)

Alternative faucet: [faucet.quicknode.com/polygon/amoy](https://faucet.quicknode.com/polygon/amoy)

---

## Deploying

### Backend — Railway

1. Push `backend/` to a GitHub repo (or the whole monorepo)
2. Create a Railway project, connect the repo, set root directory to `backend/`
3. Add `DATABASE_URL` environment variable in Railway dashboard
4. Railway auto-detects the `railway.toml` / `Procfile` and deploys

The `railway.toml` configures:
- Builder: nixpacks
- Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Health check: `GET /health` (30s timeout)
- Restart policy: on failure

### Frontend — Vercel

```bash
cd app
npx vercel deploy
```

Or connect the GitHub repo to Vercel, set root directory to `app/`, and add the three environment variables in the Vercel dashboard.

### Smart contract — Polygon Amoy (already deployed)

If redeploying:

```bash
cd contracts
npx hardhat run scripts/deploy.js --network amoy
```

Update `NEXT_PUBLIC_MARKET_CONTRACT_ADDRESS` in frontend env after redeployment.

---

## Running contract tests

```bash
cd contracts

# Run all tests
npx hardhat test

# Run with gas reporting
REPORT_GAS=true npx hardhat test
```

Test coverage:
- Market creation with correct metadata
- Adding to existing bet on same side
- Side-switch rejection (`CannotSwitchBetSide`)
- Creator-only resolution + timing enforcement
- Proportional payout split across winners
- Refund when losing pool is zero
- Loser claim rejection

---

## Gotchas and non-obvious setup steps

1. **`contracts/.env` vs `.env.example`**: The actual `.env` file (with real credentials) should not be committed. Check `.gitignore` in the contracts directory.

2. **ABI must be copied manually**: If you modify `PrivateMarket.sol` and redeploy, the ABI in `app/src/lib/abi/PrivateMarket.json` must be updated manually — it is a static copy, not auto-synced.

3. **`chain_market_id` starts at 0**: The contract uses a counter starting at 0. The first market has `marketId = 0`. The frontend uses `Number(chainMarketId) >= 0` check but treats `undefined` as disabled — make sure `chain_market_id` is always a non-negative integer in the database after creation.

4. **Temporary negative `chain_market_id` during creation**: `useCreateMarket` writes a temporary record with a large negative random number as `chain_market_id` before the on-chain tx confirms. If the user closes the browser during this window, the temporary record will remain in the database with a negative ID. The code deletes it on failure but not on browser close.

5. **Gas params are hardcoded**: `maxPriorityFeePerGas: 30 gwei` and `maxFeePerGas: 60 gwei` are set in `useCreateMarket.ts` and `bet/[id]/page.tsx`. These are tuned for Polygon Amoy's current fee market. On mainnet or with network congestion, these may need adjustment.

6. **wagmi `ssr: false`** in `src/lib/config.ts`: RainbowKit/wagmi requires this for Next.js App Router. The `Providers.tsx` component also uses a `mounted` guard for the same reason. Do not add wallet-dependent code to Server Components.

7. **Resolution requires `block.timestamp >= resolutionTime`**: The contract checks `block.timestamp < market.resolutionTime` in `resolveMarket` and reverts with `BettingClosed`. Even if the frontend shows the deadline has passed, the resolver card may appear slightly before block timestamps catch up.

8. **CORS is open**: `backend/main.py` uses `allow_origins=["*"]`. In production, change this to your frontend domain.

9. **No invite code uniqueness check**: The invite code is generated client-side with `Math.random()`. Collisions are possible (probability ~1/2B per code). The database does not enforce uniqueness on `invite_code`.

10. **Mock data always used for user bets on homepage**: `page.tsx` always calls `setUserBets(mockUserBets)` even when the API is online. The personal stats (staked, won, claimable) shown on the dashboard reflect mock data, not real on-chain bets, unless this is fixed.
