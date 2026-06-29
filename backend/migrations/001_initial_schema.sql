-- Initial schema for ClaritX

CREATE TABLE IF NOT EXISTS stock_analyses (
    id UUID PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL,
    status VARCHAR(20),
    analysis_data JSONB,
    user_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_stock_analyses_symbol_user ON stock_analyses(symbol, user_id);
CREATE INDEX IF NOT EXISTS idx_stock_analyses_created_at ON stock_analyses(created_at);

CREATE TABLE IF NOT EXISTS batch_job_prompts (
    id UUID PRIMARY KEY,
    batch_id VARCHAR(255) NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    prompt_json TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_batch_job_prompts_batch_id ON batch_job_prompts(batch_id);

CREATE TABLE IF NOT EXISTS batch_jobs (
    id VARCHAR(255) PRIMARY KEY,
    status VARCHAR(50) NOT NULL,
    gcs_input_uri TEXT,
    gcs_output_uri TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    item_count INTEGER DEFAULT 0,
    target_count INTEGER DEFAULT 0,
    asset_type VARCHAR(20)
);

CREATE TABLE IF NOT EXISTS api_rate_limits (
    key VARCHAR(50) PRIMARY KEY,
    window_start TIMESTAMP NOT NULL,
    request_count INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS screener_cache (
    symbol VARCHAR(10) PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_clients_manager_id ON clients(manager_id);

CREATE TABLE IF NOT EXISTS client_risk_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID UNIQUE NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    overall_score INTEGER,
    risk_tolerance VARCHAR(50),
    answers JSONB,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_assessment_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_risk_links_token ON risk_assessment_links(token);

CREATE TABLE IF NOT EXISTS portfolios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    cash_balance NUMERIC DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_portfolios_client_id ON portfolios(client_id);

CREATE TABLE IF NOT EXISTS portfolio_holdings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    shares NUMERIC NOT NULL,
    average_cost NUMERIC,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP,
    UNIQUE(portfolio_id, symbol)
);
CREATE INDEX IF NOT EXISTS idx_holdings_portfolio_id ON portfolio_holdings(portfolio_id);
