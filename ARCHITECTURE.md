# ARCHITECTURE.md

## System architecture

```mermaid
graph TB
    subgraph Client ["Browser (Next.js 16 App Router)"]
        UI["Pages & Components"]
        WC["WalletContext\n(wagmi wrapper)"]
        AC["apiClient.ts\nfetch wrapper"]
        ABI["PrivateMarket.json\n(ABI)"]
        RK["RainbowKit\nWallet Modal"]
    end

    subgraph Backend ["FastAPI Backend (Railway)"]
        API["FastAPI\nmain.py"]
        ORM["SQLAlchemy\nmodels.py"]
        DB[("PostgreSQL\nmarkets table")]
    end

    subgraph Chain ["Polygon Amoy Testnet (chainId: 80002)"]
        SC["PrivateMarket.sol\n0x96f608d53f..."]
    end

    UI --> AC
    UI --> WC
    UI --> RK
    WC --> |wagmi hooks| SC
    AC --> |HTTP REST| API
    API --> ORM --> DB
    UI --> |useReadContract\nuseWriteContract| SC
    ABI --> UI
```

---

## Data model — what lives where

```mermaid
graph LR
    subgraph Supabase ["PostgreSQL (FastAPI backend)"]
        M["markets\n---\nid (UUID, PK, route key)\nquestion_text\ndescription\nside_a_label\nside_b_label\ninvite_code\ncreator_address\nresolution_time\nresolved (mirror)\noutcome (mirror)\nmin_stake / max_stake\nchain_market_id (FK→chain)\ncreated_at / updated_at"]
    end

    subgraph Chain ["PrivateMarket.sol (Polygon Amoy)"]
        CM["markets mapping\n---\nmarketId (uint256)\ncreator (address)\ntotalYesBets (uint256)\ntotalNoBets (uint256)\nresolutionTime (uint256)\nresolved (bool)\noutcome (bool)\ncreatedAt (uint256)"]
        CB["bets mapping\n---\nmarketId → address →\n  amount (uint256)\n  isYes (bool)\n  claimed (bool)"]
    end

    M -->|chain_market_id links to| CM
    CM --- CB
```

**Privacy model**: The contract stores only numeric IDs and MATIC amounts. The question text, descriptions, side labels, and invite codes are private — accessible only through the API, not discoverable on-chain.

---

## Sequence: Create market

```mermaid
sequenceDiagram
    actor User
    participant Form as create/page.tsx
    participant Hook as useCreateMarket
    participant API as FastAPI /markets
    participant Wallet as MetaMask/RainbowKit
    participant Contract as PrivateMarket.sol

    User->>Form: Fill question, sides, deadline, click "Create Bet"
    Form->>Hook: createMarket(params)
    Hook->>API: POST /markets {question_text, resolution_time, creator_address, chain_market_id: -random}
    API-->>Hook: { id: uuid, ... }
    Hook->>Wallet: writeContractAsync(createMarket, [resolutionTimestamp])
    Wallet-->>User: Confirm transaction popup
    User-->>Wallet: Confirm
    Wallet->>Contract: createMarket(resolutionTimestamp)
    Contract-->>Wallet: tx hash
    Hook->>Contract: waitForTransactionReceipt(hash)
    Contract-->>Hook: receipt with MarketCreated event
    Hook->>Hook: decodeEventLog → extract marketId (uint256)
    Hook->>API: PATCH /markets/:uuid { chain_market_id: realId }
    API-->>Hook: updated market
    Hook-->>Form: { success: true, marketId, supabaseId }
    Form->>User: Show invite code + "View Bet" button
```

---

## Sequence: Join market

```mermaid
sequenceDiagram
    actor User
    participant Join as join/page.tsx
    participant API as FastAPI /markets

    User->>Join: Enter invite code (or open /join?code=XXXXXX)
    Join->>API: GET /markets/by-invite/:code
    API-->>Join: { id: uuid, ... }
    Join->>User: redirect to /bet/:uuid
```

---

## Sequence: Place bet

```mermaid
sequenceDiagram
    actor User
    participant Page as bet/[id]/page.tsx
    participant API as FastAPI /markets
    participant Contract as PrivateMarket.sol

    User->>Page: Open /bet/:uuid
    Page->>API: GET /markets/:uuid
    API-->>Page: market metadata (question, chain_market_id, ...)
    Page->>Contract: getMarket(chain_market_id) [read]
    Contract-->>Page: { totalYesBets, totalNoBets, resolved, ... }
    Page->>Contract: getUserBet(chain_market_id, userAddress) [read]
    Contract-->>Page: { amount, isYes, claimed }
    User->>Page: Select side A or B, adjust stake slider
    User->>Page: Click "Join for X MATIC"
    Page->>Contract: placeBet(marketId, isYes) payable {value: stakeAmount}
    Contract-->>Page: tx hash
    Page->>Contract: wait for confirmation
    Contract-->>Page: confirmed
    Page->>Contract: refetch getMarket, getUserBet, calculatePayout
    Page->>User: Show "You're in!" confirmation card
```

---

## Sequence: Resolve market

```mermaid
sequenceDiagram
    actor Creator
    participant Page as bet/[id]/page.tsx
    participant Contract as PrivateMarket.sol
    participant API as FastAPI /markets

    Note over Creator,Page: Visible only after deadline AND user is creator
    Creator->>Page: Click "Side A Wins" or "Side B Wins"
    Page->>Contract: resolveMarket(marketId, outcome)
    Contract-->>Page: tx submitted
    Note over Contract: Validates: creator only, after resolutionTime
    Contract-->>Page: tx confirmed (onSuccess callback)
    Page->>API: PATCH /markets/:uuid { resolved: true, outcome }
    API-->>Page: updated
    Page->>Contract: refetch contract state
    Page->>Creator: Winners see "Claim" button
```

---

## Sequence: Claim winnings

```mermaid
sequenceDiagram
    actor Winner
    participant Page as bet/[id]/page.tsx
    participant Contract as PrivateMarket.sol

    Note over Winner,Contract: Visible when: resolved=true, user bet on winning side, calculatePayout > 0, not yet claimed
    Winner->>Page: Click "Claim"
    Page->>Contract: claimWinnings(marketId)
    Note over Contract: Calculates payout:\nIf losingPool == 0: refund original bet\nElse: bet + (bet * losingPool / winningPool)
    Contract-->>Winner: MATIC transfer
    Contract-->>Page: WinningsClaimed or RefundClaimed event
    Page->>Contract: refetch calculatePayout (now 0)
    Page->>Winner: Claim button disappears
```

---

## Parimutuel payout formula

```
If losingPool == 0:
    payout = originalBet   ← full refund

Else:
    payout = originalBet + (originalBet × losingPool / winningPool)
           = originalBet × (winningPool + losingPool) / winningPool
           = originalBet × totalPot / winningPool
```

**Example** — YES wins, YES pool: 2 ETH (Alice 1 ETH, Bob 1 ETH), NO pool: 2 ETH:
- Alice payout: `1 + (1 × 2 / 2)` = 2 ETH
- Bob payout: `1 + (1 × 2 / 2)` = 2 ETH
- Carol (NO): 0 (cannot claim)
