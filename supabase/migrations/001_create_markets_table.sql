-- Create markets table for Private Polymarket
-- This table stores the private metadata for prediction markets
-- The blockchain only knows the chain_market_id (uint256)

CREATE TABLE IF NOT EXISTS markets (
    -- Primary key: UUID for frontend routing
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- The question text (private, not on blockchain)
    question_text TEXT NOT NULL,
    
    -- Optional image URL for the market
    image_url TEXT,
    
    -- The on-chain market ID from the smart contract
    chain_market_id BIGINT UNIQUE NOT NULL,
    
    -- Market creator's wallet address
    creator_address TEXT NOT NULL,
    
    -- Resolution timestamp (when betting closes)
    resolution_time TIMESTAMPTZ NOT NULL,
    
    -- Market status
    resolved BOOLEAN DEFAULT FALSE,
    outcome BOOLEAN, -- true = YES wins, false = NO wins
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on chain_market_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_markets_chain_market_id ON markets(chain_market_id);

-- Create index on creator_address for user's markets
CREATE INDEX IF NOT EXISTS idx_markets_creator_address ON markets(creator_address);

-- Create index on resolved status for filtering
CREATE INDEX IF NOT EXISTS idx_markets_resolved ON markets(resolved);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_markets_updated_at BEFORE UPDATE ON markets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE markets IS 'Private metadata for prediction markets - question text and images are NOT stored on blockchain';
COMMENT ON COLUMN markets.id IS 'UUID used in frontend URLs (e.g., /market/uuid)';
COMMENT ON COLUMN markets.chain_market_id IS 'The uint256 market ID from the PrivateMarket smart contract';
COMMENT ON COLUMN markets.question_text IS 'The actual question - kept private, not on blockchain';
COMMENT ON COLUMN markets.image_url IS 'Optional image URL for the market';
