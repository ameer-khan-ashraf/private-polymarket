// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/**
 * @title PrivateMarket
 * @notice Parimutuel betting contract for private prediction markets
 * @dev Markets are identified only by uint256 IDs - question text stored off-chain in Supabase
 */
contract PrivateMarket {
    // ============ Structs ============

    struct Market {
        uint256 marketId;
        address creator;
        uint256 totalYesBets;
        uint256 totalNoBets;
        uint256 createdAt;
        uint256 resolutionTime;
        bool resolved;
        bool outcome; // true = YES wins, false = NO wins
        bool exists;
    }

    struct Bet {
        uint256 amount;
        bool isYes; // true = bet on YES, false = bet on NO
        bool claimed;
    }

    // ============ State Variables ============

    uint256 public nextMarketId;

    // marketId => Market
    mapping(uint256 => Market) public markets;

    // marketId => user => Bet
    mapping(uint256 => mapping(address => Bet)) public bets;

    // ============ Events ============

    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        uint256 resolutionTime
    );

    event BetPlaced(
        uint256 indexed marketId,
        address indexed bettor,
        uint256 amount,
        bool isYes
    );

    event MarketResolved(
        uint256 indexed marketId,
        bool outcome
    );

    event WinningsClaimed(
        uint256 indexed marketId,
        address indexed winner,
        uint256 amount
    );

    event RefundClaimed(
        uint256 indexed marketId,
        address indexed bettor,
        uint256 amount
    );

    // ============ Errors ============

    error MarketDoesNotExist();
    error MarketAlreadyResolved();
    error MarketNotResolved();
    error BettingClosed();
    error InvalidBetAmount();
    error NoBetFound();
    error AlreadyClaimed();
    error NotMarketCreator();
    error InvalidResolutionTime();
    error LoserCannotClaim();
    error CannotSwitchBetSide();

    // ============ Modifiers ============

    modifier marketExists(uint256 _marketId) {
        if (!markets[_marketId].exists) revert MarketDoesNotExist();
        _;
    }

    modifier notResolved(uint256 _marketId) {
        if (markets[_marketId].resolved) revert MarketAlreadyResolved();
        _;
    }

    modifier isResolved(uint256 _marketId) {
        if (!markets[_marketId].resolved) revert MarketNotResolved();
        _;
    }

    // ============ Functions ============

    /**
     * @notice Create a new prediction market
     * @param _resolutionTime Timestamp when betting closes and market can be resolved
     * @return marketId The ID of the newly created market
     */
    function createMarket(uint256 _resolutionTime) external returns (uint256) {
        if (_resolutionTime <= block.timestamp) revert InvalidResolutionTime();

        uint256 marketId = nextMarketId++;

        markets[marketId] = Market({
            marketId: marketId,
            creator: msg.sender,
            totalYesBets: 0,
            totalNoBets: 0,
            createdAt: block.timestamp,
            resolutionTime: _resolutionTime,
            resolved: false,
            outcome: false,
            exists: true
        });

        emit MarketCreated(marketId, msg.sender, _resolutionTime);

        return marketId;
    }

    /**
     * @notice Place a bet on YES or NO
     * @param _marketId The market to bet on
     * @param _isYes true to bet on YES, false to bet on NO
     */
    function placeBet(uint256 _marketId, bool _isYes)
        external
        payable
        marketExists(_marketId)
        notResolved(_marketId)
    {
        if (msg.value == 0) revert InvalidBetAmount();
        if (block.timestamp >= markets[_marketId].resolutionTime) revert BettingClosed();

        Market storage market = markets[_marketId];
        Bet storage userBet = bets[_marketId][msg.sender];

        // Users can add to an existing position, but cannot switch sides mid-market.
        // This preserves pool accounting integrity and prevents insolvency exploits.
        if (userBet.amount > 0 && userBet.isYes != _isYes) revert CannotSwitchBetSide();

        // Add to existing bet or create new one
        userBet.amount += msg.value;
        userBet.isYes = _isYes;

        // Update market totals
        if (_isYes) {
            market.totalYesBets += msg.value;
        } else {
            market.totalNoBets += msg.value;
        }

        emit BetPlaced(_marketId, msg.sender, msg.value, _isYes);
    }

    /**
     * @notice Resolve a market with the final outcome
     * @param _marketId The market to resolve
     * @param _outcome true if YES wins, false if NO wins
     */
    function resolveMarket(uint256 _marketId, bool _outcome)
        external
        marketExists(_marketId)
        notResolved(_marketId)
    {
        Market storage market = markets[_marketId];

        if (msg.sender != market.creator) revert NotMarketCreator();
        if (block.timestamp < market.resolutionTime) revert BettingClosed();

        market.resolved = true;
        market.outcome = _outcome;

        emit MarketResolved(_marketId, _outcome);
    }

    /**
     * @notice Claim winnings or refund after market resolution
     * @dev CRITICAL: If losing pool is 0, winners get refunded their original bet
     * @param _marketId The market to claim from
     */
    function claimWinnings(uint256 _marketId)
        external
        marketExists(_marketId)
        isResolved(_marketId)
    {
        Bet storage userBet = bets[_marketId][msg.sender];

        if (userBet.amount == 0) revert NoBetFound();
        if (userBet.claimed) revert AlreadyClaimed();

        Market storage market = markets[_marketId];

        // Check if user bet on the winning side
        bool userBetOnWinningSide = userBet.isYes == market.outcome;

        if (!userBetOnWinningSide) revert LoserCannotClaim();

        uint256 payout;

        // Get winning and losing pool totals
        uint256 winningPool = market.outcome ? market.totalYesBets : market.totalNoBets;
        uint256 losingPool = market.outcome ? market.totalNoBets : market.totalYesBets;

        // CRITICAL EDGE CASE: If losing pool is 0, refund the winner's original bet
        if (losingPool == 0) {
            payout = userBet.amount;
            emit RefundClaimed(_marketId, msg.sender, payout);
        } else {
            // Parimutuel calculation: (userBet / winningPool) * (winningPool + losingPool)
            // Simplified: userBet + (userBet * losingPool / winningPool)
            payout = userBet.amount + (userBet.amount * losingPool) / winningPool;
            emit WinningsClaimed(_marketId, msg.sender, payout);
        }

        userBet.claimed = true;

        (bool success, ) = payable(msg.sender).call{value: payout}("");
        require(success, "Transfer failed");
    }

    // ============ View Functions ============

    /**
     * @notice Get market details
     * @param _marketId The market ID
     * @return Market struct
     */
    function getMarket(uint256 _marketId)
        external
        view
        marketExists(_marketId)
        returns (Market memory)
    {
        return markets[_marketId];
    }

    /**
     * @notice Get user's bet details
     * @param _marketId The market ID
     * @param _user The user address
     * @return Bet struct
     */
    function getUserBet(uint256 _marketId, address _user)
        external
        view
        marketExists(_marketId)
        returns (Bet memory)
    {
        return bets[_marketId][_user];
    }

    /**
     * @notice Calculate potential payout for a user
     * @param _marketId The market ID
     * @param _user The user address
     * @return Potential payout amount (0 if market not resolved or user lost)
     */
    function calculatePayout(uint256 _marketId, address _user)
        external
        view
        marketExists(_marketId)
        returns (uint256)
    {
        Market storage market = markets[_marketId];

        if (!market.resolved) return 0;

        Bet storage userBet = bets[_marketId][_user];

        if (userBet.amount == 0 || userBet.claimed) return 0;

        // Check if user bet on winning side
        bool userBetOnWinningSide = userBet.isYes == market.outcome;

        if (!userBetOnWinningSide) return 0;

        uint256 winningPool = market.outcome ? market.totalYesBets : market.totalNoBets;
        uint256 losingPool = market.outcome ? market.totalNoBets : market.totalYesBets;

        // CRITICAL: Refund if no one took the other side
        if (losingPool == 0) {
            return userBet.amount;
        }

        // Parimutuel payout
        return userBet.amount + (userBet.amount * losingPool) / winningPool;
    }

    /**
     * @notice Get total value locked in a market
     * @param _marketId The market ID
     * @return Total ETH locked in the market
     */
    function getTotalValueLocked(uint256 _marketId)
        external
        view
        marketExists(_marketId)
        returns (uint256)
    {
        Market storage market = markets[_marketId];
        return market.totalYesBets + market.totalNoBets;
    }
}
