-- Stock Analyses Table for Async Processing and Caching
-- Run this in PostgreSQL to create the table

CREATE TABLE IF NOT EXISTS stock_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(10) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending', 'processing', 'complete', 'error'
    
    -- Analysis results (JSON)
    analysis_data JSONB,
    
    -- Metadata
    user_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    error_message TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_analyses_symbol_created ON stock_analyses(symbol, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_analyses_status ON stock_analyses(status);
CREATE INDEX IF NOT EXISTS idx_stock_analyses_user_symbol ON stock_analyses(user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_stock_analyses_id ON stock_analyses(id);
