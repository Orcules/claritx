import os
import time
import uuid
import asyncio
from typing import Dict, Any
from sqlalchemy import text
from google import genai
import json

async def analyze_stock_with_gemini(symbol: str, financial_data: Dict[str, Any], conn=None) -> str:
    """
    Calls Google Gemini (via google-genai) to analyze the stock.
    Replaces AWS Bedrock (Claude).
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return "AI Analysis unavailable (Missing Google API Key)."

    deployment_id = os.environ.get('DENO_DEPLOYMENT_ID', 'backend-local')
    correlation_id = str(uuid.uuid4())
    model_id = 'gemini-3-pro-preview'
    
    # Normalize inputs
    def normalize_whitespace(text: str) -> str:
        import re
        if not text: return ""
        return re.sub(r'\s+', ' ', text).strip()

    # Determine if it's an ETF based on FMP data presence
    is_etf = bool(financial_data.get('etf_holdings') or financial_data.get('etf_info'))
    asset_type = "ETF" if is_etf else "stock"

    if is_etf:
        # ETF Specific Prompt
        prompt = f"""You are a professional financial analyst AI specializing in Exchange Traded Funds (ETFs). 
    Analyze the ETF {symbol} based on the provided data context. 
    The data context is the source of truth;  the internet search should be used just as a validator and not to invent data we dont have in source of truth.


DATA CONTEXT START:
{financial_data}
DATA CONTEXT END.

Return valid JSON only.

REQUIREMENTS:
- Each text category must be around 300 to 400 words.
- Cite specific data points (Holdings, Sector Weights, Expense Ratio) and sources.
- Be very detailed.
- **CRITICAL:** At the VERY END of each text section, you MUST provide a sentiment score in this exact format: "Rating X/10". (0 = Extremely Bearish/Negative, 5 = Neutral, 10 = Extremely Bullish/Positive).

JSON STRUCTURE (ETF Adapted):
{{
  "headlines": "Recent news affecting the ETF's sector/holdings... (300-400 words) ... Rating X/10",
  "technicals": "Technical analysis of the ETF chart (SMA, RSI, Support/Resist)... (300-400 words) ... Rating X/10",
  "social_media_hype": "Sentiment around this ETF and its top holdings... (300-400 words) ... Rating X/10",
  "financial_indicators": "Fund Fundamentals: Analyze Expense Ratio, AUM Growth, Turnover Rate, and Tracking Error... (300-400 words) ... Rating X/10",
  "analyst_consensus": "Market flows & Institutional Interest. Are we seeing inflows or outflows?... (300-400 words) ... Rating X/10",
  "relative_to_market": "Performance vs Benchmark (S&P 500) and Peer ETFs... (300-400 words) ... Rating X/10",
  "insider_activity": "Top Holdings & Concentration Risk. Analyze the top 10 holdings and their impact... (300-400 words) ... Rating X/10",
  "dividend_health": "Distribution Yield, Frequency, and History... (300-400 words) ... Rating X/10",
  "final_verdict": "Comprehensive investment thesis. Buy/Hold/Sell rationale... (300-400 words) ...Rating X/10",
  "ai_score": X,
  "methodology": "Explain EXACTLY how you reached the final verdict score. Detail the point system, weight of Macro factors vs Technicals. (200-300 words) ...Rating X/10",
  "sources_used": "List of sources..."
}}"""
    else:
        # Stock Specific Prompt (Original)
        prompt = f"""You are a professional financial analyst AI. Analyze the stock {symbol} 
    based on the provided data context. The data context is the source of truth,
    the internet search should be used just as a validator and not to invent data we dont have in source of truth.
    
DATA CONTEXT START:
{financial_data}
DATA CONTEXT END.

Return valid JSON only.

REQUIREMENTS:
- Each text category must be around 300 to 400 words.
- Cite specific data points and sources.
- Be very detailed.
- **CRITICAL:** At the VERY END of each text section, you MUST provide a sentiment score in this exact format: "Rating X/10". (0 = Extremely Bearish/Negative, 5 = Neutral, 10 = Extremely Bullish/Positive).

JSON STRUCTURE:
{{
  "headlines": "News summary... (300-400 words) ... Rating X/10",
  "technicals": "SMA/RSI... (300-400 words) ... Rating  X/10",
  "social_media_hype": "Sentiment... (300-400 words) ... Rating X/10",
  "financial_indicators": "Metrics... (300-400 words) ... Rating X/10",
  "analyst_consensus": "Analyst synthesis... (300-400 words) ... Rating X/10",
  "relative_to_market": "Sector comparison... (300-400 words) ... Rating X/10",
  "insider_activity": "Insider transactions... (300-400 words) ... Rating X/10",
  "dividend_health": "Dividend analysis... (300-400 words) ... Rating X/10",
  "final_verdict": "Comprehensive thesis... (300-400 words) ... Rating X/10",
  "ai_score": X,
  "methodology": "Explain EXACTLY how you reached the final verdict score. Detail the point system, which factors (Technicals, Sentiment, Fundamentals) carried the most weight. (200-300 words)",
  "sources_used": "List of sources..."
}}"""

    # Log Request

        return ai_text

async def generate_blog_with_gemini(topic: str, count: int = 1) -> Dict[str, Any]:
    """
    Generates blog posts using Google Gemini.
    Replaces AWS Bedrock (Claude) blog generation.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise Exception("Google API Key not configured")

    try:
        # Build prompt for blog generation
        system_prompt = """You are an expert financial content writer for ClaritX, an AI-powered stock analysis platform.
Generate SEO- and GEO-optimized blog posts about stock investing, portfolio management, and financial markets.
These posts appear on a YMYL (Your Money Your Life) site and must meet Google's E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) standards.

═══════════════════════════════════════════════════════
STRUCTURE REQUIREMENTS (follow exactly)
═══════════════════════════════════════════════════════

TITLE: 50-60 characters. Place the primary keyword near the start. No clickbait.

OPENING (first 60 words): Define the core concept immediately — "What is [topic]?" — with one specific statistic and the article's thesis. This definition block is critical for AI search engines (ChatGPT, Perplexity, Google AIO).

H2 HEADINGS: Phrase EVERY H2 as a question the reader would actually search.
  ✅ "## How Do Dividend Stocks Generate Passive Income?"
  ❌ "## Benefits of Dividends"

PASSAGE BLOCKS: Write each H2 section as a self-contained passage of 134-167 words that fully answers its heading question on its own. AI search engines select these as cited snippets — each block must make sense without reading the rest of the article.

WORD COUNT: 2,000-2,500 words total (never below 1,800).

═══════════════════════════════════════════════════════
E-E-A-T CONTENT REQUIREMENTS (mandatory on every post)
═══════════════════════════════════════════════════════

REAL STOCK TICKERS: Every article about investing, stocks, sectors, or portfolios MUST mention at least 3-5 real, named stock tickers (e.g., AAPL, MSFT, NVDA, LLY, JPM) as educational examples. Do NOT write generic articles with no specific companies. Explain WHY each ticker is used as an example (what metric, what trend, what risk).

NAMED SOURCES: Every statistic MUST name its source inline.
  ✅ "According to FactSet, S&P 500 forward P/E in Q1 2025 was 21x..."
  ✅ "The Federal Reserve's 2024 Survey of Consumer Finances found..."
  ❌ "Studies show..." or "Research indicates..." (anonymous sources are forbidden)

DATA TABLE: Include at least one markdown table comparing real options — e.g., 3-5 specific stocks or ETFs with ticker symbols, yield, P/E, and 1-year return columns. Use real approximate figures with a date reference.

BULLET LIST: Include at least one bulleted list of actionable takeaways or key facts.

SPECIFICITY: Use concrete figures with dates. "As of Q1 2025, the S&P 500 dividend yield was 1.3% (FactSet)" — not vague claims.

EDUCATIONAL DISCLAIMER AT TOP: Add a blockquote immediately after the opening paragraph:
  > **Educational disclaimer:** All stock tickers mentioned are used as illustrative examples only. Nothing in this article is a recommendation to buy or sell any security. Always consult a licensed financial advisor before investing.

═══════════════════════════════════════════════════════
INTERNAL LINKS — REQUIRED SECTION
═══════════════════════════════════════════════════════

Include a "### Related ClaritX Tools" section near the end. Use EXACTLY this markdown format (the renderer converts these to React Router links):
  **[→ Link text here](/internal-path)**

Available pages (choose 2-4 most relevant):
  - Run a full 9-perspective AI analysis on any stock → /ai-stock-analysis
  - AI Stock Rankings for 1,000+ assets → /ai-stock-rank
  - Portfolio Simulator (risk-profile based) → /portfolio-simulator
  - Browse all tracked stocks → /stocks
  - Plans & Pricing → /pricing
  - Investment Research Blog → /blog

Always end the article with a disclaimer paragraph in *italics*: this content is for educational and informational purposes only and does not constitute investment advice. Consult a licensed financial professional before making any investment decisions.

═══════════════════════════════════════════════════════
OUTPUT — valid JSON only, no markdown wrapper
═══════════════════════════════════════════════════════

{
  "blogs": [
    {
      "slug": "keyword-rich-url-slug-60-chars-max",
      "title": "Exact Title — 50-60 Characters with Primary Keyword",
      "excerpt": "1-2 sentence summary with primary keyword that hooks the reader.",
      "content": "Full markdown: opening definition, educational disclaimer blockquote, ## question headings, 134-167 word H2 sections, real ticker examples, one data table with real tickers, one bullet list, Related ClaritX Tools section, italic disclaimer.",
      "tags": ["Primary Keyword", "Secondary Keyword", "Topic Category", "Audience Tag"],
      "metaDescription": "120-160 char description with primary keyword and action phrase like 'Learn how...' or 'Discover...'",
      "readTime": 9,
      "imagePrompt": "Photorealistic financial scene: [specific visual relevant to topic], professional setting, clean composition, no text overlays"
    }
  ]
}"""

        user_prompt = f"Generate {count} blog post(s) about: {topic}" if topic else f"Generate {count} blog post(s) about trending topics in stock investing, portfolio management, or financial markets."

        client = genai.Client(api_key=api_key)
        
        prompt = f"{system_prompt}\n\n{user_prompt}"
        
        def run_gemini():
            response = client.models.generate_content(
                model='gemini-3-flash-preview', 
                contents=prompt,
                config={
                    'response_mime_type': 'application/json'
                }
            )
            return response.text

        loop = asyncio.get_event_loop()
        ai_text = await loop.run_in_executor(None, run_gemini)
        
        return json.loads(ai_text)

    except Exception as e:
        print(f"Blog generation error: {e}")
        return {"error": str(e), "blogs": []}
