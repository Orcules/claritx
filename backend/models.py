from pydantic import BaseModel
from typing import Optional, Dict, List, Any
from datetime import datetime

# --- Stock Analysis ---
class StockAnalysisRequest(BaseModel):
    symbol: str
    force_refresh: Optional[bool] = False

# --- Logging ---
class LogEntryModel(BaseModel):
    session_id: Optional[str] = "unknown"
    type: str # 'api', 'db', 'system'
    category: str # 'FMP Error', 'Bedrock', etc.
    message: str
    details: Optional[Dict] = None
    duration: Optional[int] = None # ms
    status: Optional[int] = None
    request_body: Optional[Dict] = None
    response_preview: Optional[str] = None
    correlation_id: Optional[str] = None

# --- Blog Generation ---
class BlogGenerationRequest(BaseModel):
    count: int = 1
    userPrompt: Optional[str] = None

class GeneratedBlog(BaseModel):
    title: str
    content: str # Markdown
    summary: str
    tags: List[str]
    image_prompt: Optional[str] = None

class PublishBlogRequest(BaseModel):
    blog: Dict[str, Any]

# --- User Portfolio ---
class PortfolioItem(BaseModel):
    model_config = {"extra": "ignore"}
    symbol: str
    name: str
    sector: str = "Unknown"
    weight: float = 0
    riskLevel: Optional[int] = 3
    whyFits: Optional[str] = ""
    aiScore: Optional[float] = None
    savedAiScore: Optional[float] = None
    savedPrice: Optional[float] = None
    addedAt: Optional[str] = None
    instrumentType: Optional[str] = None

class PortfolioModel(BaseModel):
    model_config = {"extra": "ignore"}
    id: Optional[str] = None
    name: Optional[str] = None
    risk_bucket: int
    risk_label: str
    style_tags: Optional[List[str]] = []
    constraints: Optional[List[str]] = []
    holdings: List[PortfolioItem] = []
    sector_allocation: Optional[Dict[str, float]] = {}
    total_risk_score: Optional[int] = None
    watched_stocks: Optional[List[str]] = []
    settings: Optional[Dict] = {}

class TickerScreenerRequest(BaseModel):
    minPrice: Optional[float] = None
    maxPrice: Optional[float] = None
    minVolume: Optional[int] = None
    sector: Optional[str] = None

# --- Client Management ---
class ClientRequest(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None

class Client(BaseModel):
    id: str
    manager_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

# --- Investor Profile (Portfolio Recommendations) ---
class InvestorProfile(BaseModel):
    risk_tolerance: str = "moderate"       # conservative / moderate / aggressive → beta filter
    income_vs_growth: str = "both"         # income / growth / both → dividend filter
    market_cap: str = "all"               # large / mid / small / all
    sectors: List[str] = []               # empty = all sectors
    include_etfs: bool = False             # True = add 5 ETFs to results
    instrument_type: str = "mixed"         # etf / stocks / funds / mixed
    value_or_growth: str = "blend"         # value / growth / blend → P/E filter
    min_ai_score: float = 0               # 0-100 threshold
    min_volume: int = 0                   # liquidity floor
    country: str = "all"                  # US / all
