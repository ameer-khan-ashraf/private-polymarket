# CLAUDE.md

## Memory maintenance rules

These rules apply to every agent session working on this codebase. Follow them to keep context lean and avoid re-deriving state that was already known.

### After any code change, update CLAUDE.md immediately if:
- A new file or directory is added → update **Project structure**
- A dependency is added/removed/upgraded → update **Tech stack**
- A new route is added or an existing route changes behavior → update **App routes**
- A new env var is required → update **Environment variables**
- A bug from **Known issues / tech debt** is fixed → remove that item
- A new pattern is established (new hook, new util, new data-fetch pattern) → update **Common patterns**
- The smart contract is redeployed → update the address in **Smart contract**
- The database schema changes → update **Database schema**

### After any code change, update ARCHITECTURE.md if:
- The data flow changes (e.g., new API call added to a sequence)
- A new service or integration is introduced
- The on-chain vs off-chain data split changes

### After any code change, update DEVELOPMENT.md if:
- A new env var is required for local setup
- A new service must be run locally
- A gotcha is discovered or resolved
- Deploy steps change

### General rules
- Never let CLAUDE.md describe code that no longer exists.
- Never leave a known issue in the list after it has been fixed.
- When a section becomes stale (references a file path or function that was renamed/deleted), fix it in the same PR/commit as the code change.
- Do not add boilerplate or filler. Every line in these docs must reflect actual current code.

---

## Project overview

Sidebets is a private prediction market app for friend groups. Users connect a Web3 wallet, create binary (YES/NO) bets on any life event, share invite codes with friends, place MATIC stakes on-chain, and the market creator resolves the outcome after the deadline — triggering parimutuel payouts via smart contract. The app uses a hybrid architecture: bet question text and social metadata live in a FastAPI/PostgreSQL backend (private, off-chain), while stakes, pools, resolution, and payouts are handled entirely on the PrivateMarket Solidity contract on Polygon Amoy testnet.

---

## Tech stack

### Framework & runtime
- **Next.js 16.1.1** — App Router, React Server Components, SSR disabled for Web3 components
- **React 19.2.3** — UI rendering
- **TypeScript 5** — strict mode enabled
- **Node.js 18+** — required runtime

### UI & styling
- **Tailwind CSS v4** — utility-first styling via `@tailwindcss/postcss` plugin
- **shadcn/ui** — component library built on Radix UI primitives (see `src/components/ui/`)
- **Radix UI** — accessible headless component primitives (accordion, dialog, dropdown, etc.)
- **Lucide React 0.562** — icon set
- **next-themes 0.4.6** — dark/light mode (app is hardcoded dark in `layout.tsx`)
- **Geist / Geist Mono** — fonts loaded via `next/font/google`
- **tw-animate-css** — animation utilities
- **class-variance-authority + clsx + tailwind-merge** — conditional class utilities (`cn()`)

### Web3 & blockchain
- **wagmi 2.19.5** — React hooks for EVM contract reads/writes
- **viem 2.44.1** — low-level EVM types and utilities (`parseEther`, `formatEther`, `parseGwei`, `decodeEventLog`)
- **RainbowKit 2.2.10** — wallet connection UI modal
- **ethers 6.16** — included as dependency but wagmi/viem handle all contract interactions
- **@tanstack/react-query 5.90** — data caching layer required by wagmi

### Backend & data
- **FastAPI 0.115.6** (Python) — REST API server (`backend/`)
- **SQLAlchemy 2.0.36 + asyncpg 0.30** — async PostgreSQL ORM
- **Pydantic 2.10.3** — request/response validation schemas
- **PostgreSQL** — hosted database (Railway or Supabase)
- **Supabase migration SQL** — `supabase/migrations/001_create_markets_table.sql` (initial schema, fewer columns than current model)

### Dev tooling
- **Hardhat** + `@nomicfoundation/hardhat-toolbox` — Solidity compilation, testing, deployment
- **ESLint 9** + `eslint-config-next` — linting
- **Railway** — backend deployment (`backend/railway.toml`, `Procfile`)
- **Vercel** — frontend deployment (implied; `@vercel/analytics` in deps, commented out)

---

## Project structure

```
private-polymarket/
├── README.md                          # High-level overview + getting started guide
├── CLAUDE.md                          # This file
├── ARCHITECTURE.md                    # Mermaid diagrams and data model
├── DEVELOPMENT.md                     # Setup and deployment guide
│
├── app/                               # Next.js 16 frontend
│   ├── next.config.ts                 # Allows remote images from any host
│   ├── package.json                   # Frontend dependencies
│   ├── postcss.config.mjs             # Tailwind CSS v4 PostCSS plugin config
│   ├── tsconfig.json                  # Strict TS, path alias @/* → src/*
│   └── src/
│       ├── app/                       # App Router pages
│       │   ├── layout.tsx             # Root layout: Providers, Header, dark class
│       │   ├── globals.css            # Tailwind base styles and CSS custom properties
│       │   ├── page.tsx               # "/" — My Bets dashboard with filter tabs + stats
│       │   ├── create/page.tsx        # "/create" — 2-step form to create a new market
│       │   ├── join/page.tsx          # "/join" — invite code lookup → redirect to bet page
│       │   └── bet/[id]/page.tsx      # "/bet/[id]" — bet detail, place/resolve/claim
│       ├── components/
│       │   ├── Providers.tsx          # Wagmi + QueryClient + RainbowKit + WalletProvider tree
│       │   ├── header.tsx             # Sticky nav: logo, My Bets/Join/Create links, ConnectButton
│       │   ├── bet-card.tsx           # Card component for the dashboard bet list
│       │   ├── TugOfWar.tsx           # YES/NO pool percentage bar (not currently used in routing pages)
│       │   ├── theme-provider.tsx     # next-themes wrapper (currently unused — layout hardcodes dark)
│       │   └── ui/                    # shadcn/ui components (accordion, button, card, dialog, etc.)
│       ├── hooks/
│       │   ├── useCreateMarket.ts     # Orchestrates 3-step market creation: API → contract → API link
│       │   ├── use-countdown.ts       # Live countdown timer for bet deadlines
│       │   ├── use-mobile.ts          # Viewport breakpoint hook
│       │   └── use-toast.ts           # Toast notification hook (duplicate of ui/use-toast.ts)
│       └── lib/
│           ├── config.ts              # wagmi/RainbowKit config — Polygon Amoy chain, WalletConnect ID
│           ├── wallet-context.tsx     # WalletContext: isConnected, address, balance, connect, disconnect
│           ├── apiClient.ts           # Typed fetch wrapper for the FastAPI backend
│           ├── mock-data.ts           # Fallback mock bets/users + Bet/UserBet TypeScript types
│           ├── utils.ts               # cn() utility function
│           └── abi/
│               └── PrivateMarket.json # Contract ABI (copied from contracts/artifacts)
│
├── backend/                           # FastAPI Python REST API
│   ├── main.py                        # FastAPI app: CRUD routes for markets
│   ├── models.py                      # SQLAlchemy ORM model for the markets table
│   ├── schemas.py                     # Pydantic request/response schemas
│   ├── database.py                    # Async SQLAlchemy engine + session factory
│   ├── requirements.txt               # Python deps: fastapi, sqlalchemy, asyncpg, pydantic
│   ├── Procfile                       # Railway/Heroku start command
│   └── railway.toml                   # Railway deployment config with health check
│
├── contracts/                         # Hardhat project
│   ├── contracts/
│   │   └── PrivateMarket.sol          # Parimutuel betting contract (Solidity 0.8.20)
│   ├── scripts/
│   │   └── deploy.js                  # Deploy + verify on Polygon Amoy
│   ├── test/
│   │   └── PrivateMarket.js           # Hardhat tests (6 test cases)
│   ├── artifacts/contracts/PrivateMarket.sol/
│   │   └── PrivateMarket.json         # Compiled ABI + bytecode
│   ├── hardhat.config.js              # Hardhat config: amoy network, etherscan verification
│   ├── .env.example                   # Template for contract deployment secrets
│   └── ignition/modules/Counter.ts    # Leftover Hardhat template stub — not used
│
└── supabase/
    └── migrations/
        └── 001_create_markets_table.sql  # Initial schema (subset of current model columns)
```

---

## Architecture

### How a market gets created

1. User fills in the 2-step create form (`/create`) and clicks "Create Bet"
2. `useCreateMarket` hook runs:
   a. **Step 1 — API first**: `POST /markets` to FastAPI with `question_text`, `resolution_time`, `creator_address`, and a temporary negative `chain_market_id` placeholder. Returns a Supabase-style UUID (`supabaseId`).
   b. **Step 2 — Contract tx**: calls `createMarket(resolutionTimestamp)` on the PrivateMarket contract. User confirms in wallet.
   c. **Step 3 — Link**: parses the `MarketCreated` event from the tx receipt to extract the real `marketId` (uint256). Calls `PATCH /markets/:supabaseId` to update `chain_market_id` with the real on-chain ID.
3. On success, the invite code and Supabase UUID are shown. Invite link format: `/join?code=XXXXXX`.

> **Known gap**: The `api.markets.create` call in `useCreateMarket.ts:47` only sends `question_text`, `resolution_time`, `creator_address`, and `chain_market_id`. The `description`, `sideALabel`, `sideBLabel`, `inviteCode`, `minStake`, `maxStake` fields from the form are **not sent** to the API. They are captured in form state but dropped during creation.

### How a bet gets placed

1. User opens `/bet/[id]` — the page fetches market metadata from `GET /markets/:id` (FastAPI).
2. The `chain_market_id` from the response enables wagmi `useReadContract` calls to `getMarket`, `getUserBet`, and `calculatePayout`.
3. User selects a side (A = YES, B = NO), adjusts stake with the slider, clicks "Join for X MATIC".
4. `handlePlaceBet` calls `placeBet(marketId, isYes)` payable with the stake amount as `value`.
5. Gas params are hardcoded: `maxPriorityFeePerGas = 30 gwei`, `maxFeePerGas = 60 gwei`.
6. On confirmation, contract reads are refetched.

### How resolution works

1. After the deadline passes, the bet page shows a "You are the resolver" card to the creator.
2. Creator clicks "Side A Wins" or "Side B Wins" → `handleResolve(bool)` calls `resolveMarket(marketId, outcome)` on-chain.
3. On `onSuccess` callback, `PATCH /markets/:id` updates `{ resolved: true, outcome }` in the backend.
4. Pool data re-reads from chain. Winners see a "Claim" button.

### How claiming works

- `handleClaim` calls `claimWinnings(marketId)` on-chain.
- Contract computes payout: `originalBet + (originalBet * losingPool / winningPool)`.
- Edge case: if `losingPool == 0`, winners receive a full refund of their original bet.
- Losers receive nothing (contract reverts with `LoserCannotClaim`).

### How the invite/join system works

- Invite code is a 6-character alphanumeric string generated client-side in `create/page.tsx:87` using `Math.random()`.
- The invite code is stored in the backend `markets.invite_code` column.
- `GET /markets/by-invite/:code` (FastAPI) looks up the market and returns its UUID.
- `/join?code=XXXXXX` auto-submits the code via `useSearchParams` and redirects to `/bet/:uuid`.

### What data lives where

| Data | Location |
|------|----------|
| Question text | FastAPI PostgreSQL (`question_text`) |
| Description, side labels, invite code | FastAPI PostgreSQL |
| Min/max stake (display only) | FastAPI PostgreSQL |
| Creator wallet address | FastAPI PostgreSQL |
| Resolution timestamp | Both (FastAPI + on-chain) |
| Resolved status + outcome | Both (FastAPI + on-chain, synced on resolve) |
| YES/NO pool totals | On-chain only (`totalYesBets`, `totalNoBets`) |
| Individual bet amounts | On-chain only (`bets` mapping) |
| Claim status | On-chain only (`bet.claimed`) |
| Payout calculation | On-chain only (`calculatePayout`) |

---

## Smart contract

**Network**: Polygon Amoy Testnet (chainId: 80002)  
**Deployed address**: `0x96f608d53fdfE8D1964C2F2e176dd56B72B87303` (from `contracts/.env`)  
**ABI location**: `app/src/lib/abi/PrivateMarket.json` (copy of `contracts/artifacts/contracts/PrivateMarket.sol/PrivateMarket.json`)  
**Source**: `contracts/contracts/PrivateMarket.sol`

### Write functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `createMarket` | `(uint256 _resolutionTime) → uint256` | Creates a market, returns `marketId`. Reverts if `_resolutionTime <= block.timestamp`. |
| `placeBet` | `(uint256 _marketId, bool _isYes) payable` | Places bet with `msg.value` as stake. Reverts if betting closed, market resolved, or user tries to switch sides. |
| `resolveMarket` | `(uint256 _marketId, bool _outcome)` | Creator-only. Must be called after `resolutionTime`. |
| `claimWinnings` | `(uint256 _marketId)` | Winners claim payout. Handles refund if losing pool is zero. |

### View functions

| Function | Returns | Description |
|----------|---------|-------------|
| `getMarket(uint256)` | `Market` struct | Full market state including pools, resolution status, outcome |
| `getUserBet(uint256, address)` | `Bet` struct | `{amount, isYes, claimed}` for a specific user |
| `calculatePayout(uint256, address)` | `uint256` | Pre-claim payout estimate; 0 if not resolved, user lost, or already claimed |
| `getTotalValueLocked(uint256)` | `uint256` | `totalYesBets + totalNoBets` |
| `nextMarketId()` | `uint256` | Next market ID counter |

### Events

- `MarketCreated(uint256 indexed marketId, address indexed creator, uint256 resolutionTime)`
- `BetPlaced(uint256 indexed marketId, address indexed bettor, uint256 amount, bool isYes)`
- `MarketResolved(uint256 indexed marketId, bool outcome)`
- `WinningsClaimed(uint256 indexed marketId, address indexed winner, uint256 amount)`
- `RefundClaimed(uint256 indexed marketId, address indexed bettor, uint256 amount)`

### Custom errors

`MarketDoesNotExist`, `MarketAlreadyResolved`, `MarketNotResolved`, `BettingClosed`, `InvalidBetAmount`, `NoBetFound`, `AlreadyClaimed`, `NotMarketCreator`, `InvalidResolutionTime`, `LoserCannotClaim`, `CannotSwitchBetSide`

### What the contract handles vs Supabase/backend

**Contract handles**: Pool accounting, bet placement, resolution enforcement, payout math, MATIC transfers  
**Backend handles**: Question text, descriptions, side labels, invite codes, stake display hints, creator address display, resolved status mirror (for UI without requiring an RPC read)

---

## Database schema

The backend uses SQLAlchemy against PostgreSQL. The actual model (`backend/models.py`) has more columns than the initial Supabase migration (`001_create_markets_table.sql`).

### `markets` table

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | No (PK) | Frontend route key — used in `/bet/:id` URLs |
| `question_text` | TEXT | No | The question (private, not on-chain) |
| `description` | TEXT | Yes | Optional extra context for the bet |
| `image_url` | TEXT | Yes | Optional market cover image |
| `chain_market_id` | BIGINT | No (unique) | On-chain market ID from `createMarket()` |
| `creator_address` | VARCHAR(42) | No | Creator's wallet address (checksummed) |
| `resolution_time` | TIMESTAMPTZ | No | Deadline — when betting closes |
| `resolved` | BOOLEAN | Yes | Mirrors on-chain resolved state |
| `outcome` | BOOLEAN | Yes | `true` = Side A wins, `false` = Side B wins |
| `side_a_label` | VARCHAR(100) | Yes | Custom label for YES side |
| `side_b_label` | VARCHAR(100) | Yes | Custom label for NO side |
| `invite_code` | VARCHAR(20) | Yes | 6-char invite code, indexed |
| `min_stake` | FLOAT | Yes | Min stake hint (display only, not enforced on-chain) |
| `max_stake` | FLOAT | Yes | Max stake hint (display only) |
| `created_at` | TIMESTAMPTZ | Yes | Auto-set on insert |
| `updated_at` | TIMESTAMPTZ | Yes | Auto-updated on change |

**Indexes** (from migration): `chain_market_id`, `creator_address`, `resolved`, `invite_code`

---

## Key components

### `Providers` (`src/components/Providers.tsx`)
Wraps the app in `WagmiProvider` → `QueryClientProvider` → `RainbowKitProvider` → `WalletProvider`. Uses a `mounted` guard to prevent SSR hydration issues with wallet state. RainbowKit theme: yellow accent (`#F0B90B`), black foreground.

### `Header` (`src/components/header.tsx`)
Sticky header with logo, three nav links (My Bets `/`, Join Bet `/join`, New Bet `/create`), and RainbowKit `ConnectButton` (avatar + chain icon, no balance display). Active state highlights via `pathname` match.

### `BetCard` (`src/components/bet-card.tsx`)
Props: `bet: Bet`, `userBet?: UserBet`. Renders a clickable card linking to `/bet/:id`. Shows: question, status indicator (countdown / locked / settled), side A and B participant stacks, pot distribution bar (primary vs orange), total pot in MATIC, user's stake. Won bets get a Trophy ribbon. Lost bets are dimmed.

### `TugOfWar` (`src/components/TugOfWar.tsx`)
Props: `yesPool: bigint`, `noPool: bigint`. Renders a horizontal split bar showing YES% / NO% with ETH pool amounts. Uses CSS custom properties (`--color-Buy`, `--color-Sell`, `--color-RedGreenBgText`) that must be defined in `globals.css` — **these are referenced but their definition is not visible in the standard Tailwind setup and may be missing**.

### `WalletProvider` / `useWallet` (`src/lib/wallet-context.tsx`)
Thin wrapper around wagmi's `useAccount`, `useBalance`, `useConnect`, `useDisconnect`. Exposes `{ isConnected, address, balance, connect, disconnect }`. `connect()` uses the first available connector. Used throughout pages to gate wallet-required UI.

### `useCreateMarket` (`src/hooks/useCreateMarket.ts`)
State: `isLoading`, `status` (string progress message), `error`. Orchestrates the 3-step flow: POST to API → `writeContractAsync` → wait for receipt → decode `MarketCreated` event → PATCH API. On failure, cleans up by deleting the temporary API record.

### `BetDetailPage` (`src/app/bet/[id]/page.tsx`)
Fetches market metadata via `api.markets.get(id)`. Reads on-chain state via three `useReadContract` calls (`getMarket`, `getUserBet`, `calculatePayout`). Write actions: `handlePlaceBet`, `handleClaim`, `handleResolve`. Gas hardcoded to 30/60 gwei. Uses `useCountdown` for live deadline display.

---

## App routes

| Route | Page | What the user can do |
|-------|------|----------------------|
| `/` | `app/page.tsx` | View all markets fetched from API; filter by All/Open/Locked/Settled; see personal stats (active count, staked, won, claimable); navigate to create or join |
| `/create` | `app/create/page.tsx` | 2-step form: Step 1 (question, description, side labels); Step 2 (deadline, stake range); Step 3 (success — copy invite link) |
| `/join` | `app/join/page.tsx` | Enter a 6-char invite code (or auto-read from `?code=` query param); redirects to `/bet/:uuid` on match |
| `/bet/[id]` | `app/bet/[id]/page.tsx` | View question, pool state, countdown; select side + stake + place bet; see joined status; claim winnings; resolve market (creator only after deadline) |

---

## Environment variables

### Frontend (`app/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_MARKET_CONTRACT_ADDRESS` | Yes | Deployed PrivateMarket contract address on Polygon Amoy |
| `NEXT_PUBLIC_API_URL` | Yes | FastAPI backend base URL (e.g., `https://your-app.railway.app`) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Yes | WalletConnect Cloud project ID — get from cloud.walletconnect.com |

> Note: There is **no** `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` used in the current code. The app talks to the FastAPI backend, not Supabase directly. The README is outdated on this point.

### Backend (`backend/.env` or Railway environment)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (e.g., `postgresql://user:pass@host/db`). The backend normalizes it to `asyncpg` scheme automatically. |

### Contracts (`contracts/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `POLYGON_AMOY_RPC_URL` | Yes | RPC endpoint for Polygon Amoy (default: `https://rpc-amoy.polygon.technology/`) |
| `PRIVATE_KEY` | Yes | Deployer wallet private key (no `0x` prefix) |
| `ETHERSCAN_API_KEY` | For verification | Etherscan V2 API key (also works for Polygonscan) |

---

## Common patterns

### API calls (`src/lib/apiClient.ts`)
All requests go through the `request<T>()` function which wraps `fetch` and always returns `{ data: T | null, error: { message: string } | null }`. Never throws — callers check `error` field. The `api` object provides namespaced methods: `api.markets.list()`, `api.markets.get(id)`, `api.markets.getByInviteCode(code)`, `api.markets.create(body)`, `api.markets.update(id, body)`, `api.markets.delete(id)`.

### Web3 interactions
- **Reads**: `useReadContract` from wagmi with `query: { enabled: ... }` guard to prevent calls before `chainMarketId` is available.
- **Writes**: `useWriteContract` for fire-and-forget transactions; `useWriteContractAsync` in `useCreateMarket` for sequential async flow. All writes use hardcoded `maxPriorityFeePerGas: 30 gwei` / `maxFeePerGas: 60 gwei` for Polygon Amoy compatibility.
- **Transaction waiting**: `useWaitForTransactionReceipt({ hash })` for reactive confirmation; `publicClient.waitForTransactionReceipt({ hash })` in async context.
- All contract addresses are cast as `` `0x${string}` ``.

### Error handling
Pages catch API errors and fall back to `mockBets`/`mockUserBets` from `src/lib/mock-data.ts`. The homepage tracks `dbStatus: "online" | "offline"` shown as a Live/Mock Mode badge. Inline form errors are shown via `errors` state objects. Web3 errors surface via `status` string state.

### Loading/empty states
- Spinner (`<Loader2 className="animate-spin" />`) during data fetch and tx confirmation.
- Empty state card with icon + CTA buttons when no bets match a filter.
- All pages gate wallet-required actions behind `if (!isConnected)` checks showing a "Connect Wallet" screen.

### State management
No global state library. Each page manages its own `useState` for UI state. Web3 state comes from wagmi hooks. Shared wallet state via `WalletContext` (thin wagmi wrapper). No Zustand/Redux/Jotai.

---

## Known issues / tech debt

1. **`useCreateMarket.ts:47`** — The `api.markets.create` call only sends `question_text`, `resolution_time`, `creator_address`, `chain_market_id`. The form fields `description`, `sideALabel`, `sideBLabel`, `inviteCode`, `minStake`, `maxStake` are **captured but never sent** to the API during creation. These fields will always be null in the database.

2. **`contracts/.env` contains real secrets** — The file `contracts/.env` (not `.env.example`) is committed or present locally with a real `PRIVATE_KEY` and `ETHERSCAN_API_KEY`. This file should be in `.gitignore` and never committed.

3. **Supabase migration out of sync with model** — `supabase/migrations/001_create_markets_table.sql` is missing the columns `description`, `side_a_label`, `side_b_label`, `invite_code`, `min_stake`, `max_stake` that exist in `backend/models.py`. Running this migration against a new database will result in a schema mismatch.

4. **`TugOfWar.tsx` references undefined CSS vars** — Uses `--color-Buy`, `--color-Sell`, `--color-RedGreenBgText` which are not defined in `globals.css`. The component will render with fallback/transparent colors.

5. **`theme-provider.tsx` is unused** — `src/components/theme-provider.tsx` exists but is never imported. The layout uses `className="dark"` directly.

6. **Duplicate hook files** — `src/hooks/use-toast.ts` and `src/components/ui/use-toast.ts` appear to be the same file. Same for `src/hooks/use-mobile.ts` and `src/components/ui/use-mobile.tsx`.

7. **`contracts/ignition/modules/Counter.ts`** — Leftover Hardhat Ignition template stub. Not related to the project.

8. **CORS is open** — `backend/main.py:27` has `allow_origins=["*"]`. Should be restricted to the frontend domain in production.

9. **No Supabase RLS** — The README notes Row Level Security is not implemented. Anyone with the API URL can read/write any market record.

10. **`mockUserBets` is always used for user bets** — Even when the API is online, `setUserBets(mockUserBets)` is called with hardcoded data (`page.tsx:89`). The user's actual bet history is never fetched from the backend.

11. **`@vercel/analytics` commented out** — Imported in `package.json` but the `<Analytics />` component is commented out in `layout.tsx`.

12. **`invite_code` generated client-side with `Math.random()`** — Not cryptographically secure. Collisions are possible (1 in 36^6 ≈ 2 billion). No server-side uniqueness check before creation.
