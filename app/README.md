# Sidebets | Private Prediction Markets

A high-fidelity, decentralized prediction market platform built for private betting with friends. Sidebets combines a professional "Trading Terminal" UI with on-chain transparency and Supabase-powered metadata.

![GitHub License](https://img.shields.io/github/license/ameer-khan-ashraf/private-polymarket)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-blue)
![Wagmi](https://img.shields.io/badge/Wagmi-v2-orange)

## 🚀 Features

### 📈 Betting Dashboard
- **Unified Bets Hub**: Filter through active, locked, and resolved bets.
- **Real-time Stats**: Track your total staked amount, won bets, and active positions at a glance.
- **Mock Mode Fallback**: Robust error handling that switches to a demo mode if the database connection is interrupted.

### 🔐 Secure & Private Betting
- **Invite-Only System**: Each bet generates a unique invite code for sharing with specific friends.
- **Custom Markets**: Define your own questions, descriptions, and binary labels (e.g., "Yes/No", "Will Happen/Won't Happen").
- **Stake Limits**: Set minimum and maximum stake ranges for every market.

### ⛓️ On-Chain Transparency
- **Polygon Amoy Integration**: All bets and resolutions are handled by the `PrivateMarket` smart contract.
- **RainbowKit Wallet**: Seamless connection with MetaMask and other major wallets.
- **Automated Payouts**: Contract-calculated payouts ensure fair distribution of the pot to winning participants.

### 🧭 App Routes
- `/` — My Bets dashboard
- `/create` — Create a private bet
- `/join` — Join with invite code
- `/bet/[id]` — Bet detail, place bet, resolve, and claim

## 🛠️ Technical Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4
- **Web3**: Wagmi v2, Viem v2, RainbowKit
- **Backend**: Supabase (PostgreSQL)
- **Icons**: Lucide React
- **Components**: Radix UI / Shadcn

## 🏁 Getting Started

### 1. Prerequisites
- Node.js 18+
- A Supabase Project
- A Polygon Amoy Wallet with some test MATIC

### 2. Installation
```bash
git clone https://github.com/ameer-khan-ashraf/private-polymarket.git
cd private-polymarket/app
npm install
```

### 3. Environment Setup
Create a `.env.local` file in the `app` directory:
```env
NEXT_PUBLIC_MARKET_CONTRACT_ADDRESS=0x96f608d53fdfE8D1964C2F2e176dd56B72B87303
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_id
```

### 4. Database Schema
Ensure your Supabase `markets` table contains the following columns:
- `id` (uuid)
- `question_text` (text)
- `description` (text)
- `resolution_time` (timestamptz)
- `creator_address` (text)
- `chain_market_id` (bigint)
- `resolved` (boolean)
- `outcome` (boolean)
- `invite_code` (text)

### 5. Development
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the app.

## 🤝 Contributing
Contributions are welcome! Feel free to open an issue or submit a pull request.

## 📄 License
This project is licensed under the MIT License.
