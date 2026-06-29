-- Migration to add features from Supabase project

-- Market Movers Cache
CREATE TABLE IF NOT EXISTS market_movers_cache (
    id TEXT PRIMARY KEY DEFAULT 'latest',
    data JSONB NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Market Opportunities
CREATE TABLE IF NOT EXISTS market_opportunities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunities JSONB NOT NULL DEFAULT '[]'::JSONB,
    scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '12 hours')
);

-- User Credits
CREATE TABLE IF NOT EXISTS user_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL UNIQUE,
    subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
    monthly_credits INTEGER NOT NULL DEFAULT 3,
    bonus_credits INTEGER NOT NULL DEFAULT 0,
    credits_used_this_period INTEGER NOT NULL DEFAULT 0,
    period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Credit Transactions
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    amount INTEGER NOT NULL,
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);

-- Deep Search Jobs
CREATE TABLE IF NOT EXISTS deep_search_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic TEXT NOT NULL,
    goals JSONB NOT NULL,
    outline JSONB,
    status TEXT NOT NULL DEFAULT 'pending',
    progress_pct INTEGER DEFAULT 0,
    progress_logs JSONB DEFAULT '[]'::JSONB,
    current_step INTEGER DEFAULT 0,
    findings JSONB DEFAULT '[]'::JSONB,
    result JSONB,
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255),
    type VARCHAR(50) NOT NULL,
    category VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    duration INTEGER,
    status INTEGER,
    request_body JSONB,
    response_preview TEXT,
    correlation_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_session_id ON activity_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- Published Blogs
CREATE TABLE IF NOT EXISTS published_blogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT 'ClaritX Research Team',
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_time INTEGER NOT NULL DEFAULT 5,
    tags TEXT[] NOT NULL DEFAULT '{}',
    image_url TEXT,
    meta_description TEXT NOT NULL,
    sources JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_published_blogs_slug ON published_blogs(slug);
CREATE INDEX IF NOT EXISTS idx_published_blogs_published_at ON published_blogs(published_at DESC);

-- User Roles
CREATE TABLE IF NOT EXISTS user_roles (
    user_id VARCHAR(255) PRIMARY KEY,
    role TEXT NOT NULL DEFAULT 'investor',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
