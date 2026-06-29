from fastapi import APIRouter, Depends
from fastapi.responses import Response
from typing import Dict
from sqlalchemy import text
from database import get_db_connection
from auth import verify_admin
from datetime import datetime

router = APIRouter()

SITE = "https://www.claritx.ai"

STATIC_PAGES = [
    {"loc": "/", "changefreq": "daily", "priority": "1.0"},
    {"loc": "/ai-stock-rank", "changefreq": "daily", "priority": "0.9"},
    {"loc": "/ai-stock-analysis", "changefreq": "daily", "priority": "0.9"},
    {"loc": "/market-opportunities", "changefreq": "daily", "priority": "0.8"},
    {"loc": "/stocks", "changefreq": "weekly", "priority": "0.8"},
    {"loc": "/ai-stock-analysis-guide", "changefreq": "monthly", "priority": "0.8"},
    {"loc": "/buffett-indicator", "changefreq": "weekly", "priority": "0.8"},
    {"loc": "/pricing", "changefreq": "monthly", "priority": "0.8"},
    {"loc": "/blog", "changefreq": "daily", "priority": "0.8"},
    {"loc": "/about", "changefreq": "monthly", "priority": "0.6"},
    {"loc": "/portfolio-simulator", "changefreq": "monthly", "priority": "0.5"},
    {"loc": "/disclaimer", "changefreq": "yearly", "priority": "0.3"},
    {"loc": "/privacy", "changefreq": "yearly", "priority": "0.3"},
    {"loc": "/terms", "changefreq": "yearly", "priority": "0.3"},
]

BUNDLED_BLOG_SLUGS = [
    "best-stocks-to-buy-2026",
    "how-to-analyze-stocks-complete-guide",
    "ai-stock-screener-comparison-2026",
    "hidden-dangers-ai-stock-analysis",
    "why-claritx-multi-angle-analysis",
    "ai-hallucinations-financial-data",
    "dividend-investing-passive-income-guide",
    "stock-market-for-beginners-first-investment",
    "growth-vs-value-investing-which-style",
    "how-to-read-financial-statements-plain-english",
    "etf-vs-individual-stocks-which-to-choose",
    "dollar-cost-averaging-vs-lump-sum",
    "stock-market-crashes-how-to-prepare",
    "investing-in-your-30s-building-wealth",
    "understanding-pe-ratio-valuation",
    "building-emergency-fund-before-investing",
    "tax-loss-harvesting-explained",
    "sector-rotation-strategy-explained",
    "reits-for-beginners-real-estate-investing",
    "stop-loss-orders-protect-or-hurt",
    "best-dividend-stocks-for-retirement",
    "how-to-invest-1000-dollars",
    "passive-income-stocks-monthly-dividends",
    "safe-stocks-for-beginners-low-risk",
    "best-etfs-to-buy-and-hold-forever",
]

# Retired duplicate slugs (keyword cannibalization) — redirected to a surviving
# post, must not appear in sitemaps. Source of truth: src/data/blogRedirects.json
REDIRECTED_BLOG_SLUGS = {
    "safe-dividend-stocks-under-50-for-beginners",
    "10-safe-dividend-stocks-under-50-for-beginners",
    "safe-dividend-stocks-under-50-beginner-investors",
    "10-best-dividend-stocks-under-50-for-beginner-investors",
    "safe-dividend-stocks-under-50-beginners",
    "how-to-pick-safe-stocks-beginners",
    "best-low-risk-stocks-beginners-guide",
    "best-low-risk-shares-for-new-investors",
    "best-safe-stocks-for-beginners-2026",
    "warren-buffetts-safest-stocks-beginners",
    "warren-buffett-safest-stocks-beginner-guide",
    "warren-buffett-safe-stocks-beginners",
    "consumer-staples-stocks-safest-bet-for-new-investors",
    "consumer-staples-stocks-safe-bet-new-investors",
    "utility-stocks-explained-safe-investments-guide",
    "utility-stocks-explained-safe-boring-new-investors",
    "latest-financial-trends-navigating-2026-market-data",
    "latest-financial-trends-2026-market-analysis",
    "financial-trends-2026-ai-rates-market-growth",
    "safe-stock-portfolio-with-1000-beginner-guide",
    "build-safe-1000-stock-portfolio-beginner-guide",
    "how-to-build-safe-stock-portfolio-1000-beginner",
    "safe-stocks-for-beginners-1000-portfolio",
    "is-nvidias-ai-driven-revenue-growth-sustainable-for-long-term-investors-in-2026",
    "nvidia-ai-revenue-grows-long-term-investors-2026",
    "paypal-current-situation-lawsuits-smoke-or-fire-2026",
    "sp-500-vs-individual-stocks-safer-beginners",
    "defensive-stocks-explained-low-volatility-picks",
    "are-blue-chip-stocks-safe-beginner-guide",
    "q1-2026-earnings-season-ai-boom-inflation-impact",
    "market-update-february-2026-ai-insights",
    "10-best-safe-dividend-stocks-under-50-for-beginners",
    "sp-500-vs-individual-stocks-safer-for-beginners",
    "sp500-vs-individual-stocks-beginners",
    "sp500-vs-individual-stocks-safer-for-beginners",
    "defensive-stocks-8-low-volatility-picks",
    "defensive-stocks-explained-8-low-volatility-picks",
    "defensive-stocks-low-volatility-picks-guide",
    "safest-stocks-for-beginners-warren-buffett-guide",
}

# The stocks sitemap is capped: ~1,340 thin /stocks/TICKER pages diluted crawl
# budget and sat unindexed in GSC. Core mega-cap tickers always included; the
# rest of the budget goes to the most recently analyzed symbols.
MAX_STOCK_URLS = 250
CORE_TICKERS = {
    "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "NVDA", "META", "TSLA", "BRK-B", "UNH",
    "LLY", "JPM", "XOM", "V", "JNJ", "WMT", "MA", "PG", "HD", "AVGO",
    "CVX", "MRK", "ORCL", "ABBV", "PEP", "KO", "COST", "ADBE", "CRM", "AMD",
    "MCD", "TMO", "CSCO", "BAC", "NFLX", "ACN", "ABT", "LIN", "DHR", "TMUS",
    "WFC", "TXN", "PM", "INTC", "AMGN", "NEE", "COP", "HON", "IBM", "NKE",
    "SPY", "QQQ", "VOO", "VTI", "PLTR", "COIN", "SOFI", "HOOD", "MSTR", "SMCI",
}


def _url_block(loc: str, lastmod: str, changefreq: str, priority: str) -> str:
    return (
        f"  <url>\n"
        f"    <loc>{SITE}{loc}</loc>\n"
        f"    <lastmod>{lastmod}</lastmod>\n"
        f"    <changefreq>{changefreq}</changefreq>\n"
        f"    <priority>{priority}</priority>\n"
        f"  </url>"
    )


def _sitemap_index_block(sitemap_loc: str, lastmod: str) -> str:
    return (
        f"  <sitemap>\n"
        f"    <loc>{sitemap_loc}</loc>\n"
        f"    <lastmod>{lastmod}</lastmod>\n"
        f"  </sitemap>"
    )


# ── Sitemap Index (main entry point) ─────────────────────────────────────────

@router.get("/sitemap.xml")
async def sitemap_index():
    today = datetime.utcnow().strftime("%Y-%m-%d")
    api_base = SITE  # sub-sitemaps served by this same API

    sitemaps = [
        _sitemap_index_block(f"{api_base}/sitemap-static.xml", today),
        _sitemap_index_block(f"{api_base}/sitemap-blogs.xml", today),
        _sitemap_index_block(f"{api_base}/sitemap-stocks.xml", today),
    ]

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(sitemaps)
        + "\n</sitemapindex>\n"
    )
    return Response(content=xml, media_type="application/xml")


# ── Sub-sitemap: static pages ────────────────────────────────────────────────

@router.get("/sitemap-static.xml")
async def sitemap_static():
    today = datetime.utcnow().strftime("%Y-%m-%d")
    urls = [_url_block(p["loc"], today, p["changefreq"], p["priority"]) for p in STATIC_PAGES]

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )
    return Response(content=xml, media_type="application/xml")


# ── Sub-sitemap: blog posts ──────────────────────────────────────────────────

@router.get("/sitemap-blogs.xml")
async def sitemap_blogs():
    today = datetime.utcnow().strftime("%Y-%m-%d")
    seen_slugs: set[str] = set()
    urls: list[str] = []

    try:
        async for conn in get_db_connection():
            blog_rows = await conn.execute(text(
                "SELECT slug, published_at FROM published_blogs ORDER BY published_at DESC"
            ))
            for row in blog_rows.fetchall():
                slug, pub_date = row[0], row[1]
                if slug in REDIRECTED_BLOG_SLUGS:
                    continue
                lastmod = pub_date.strftime("%Y-%m-%d") if pub_date else today
                urls.append(_url_block(f"/blog/{slug}", lastmod, "monthly", "0.7"))
                seen_slugs.add(slug)
            break
    except Exception:
        pass

    for slug in BUNDLED_BLOG_SLUGS:
        if slug not in seen_slugs and slug not in REDIRECTED_BLOG_SLUGS:
            urls.append(_url_block(f"/blog/{slug}", today, "monthly", "0.7"))

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )
    return Response(content=xml, media_type="application/xml")


# ── Sub-sitemap: stock pages ─────────────────────────────────────────────────

@router.get("/sitemap-stocks.xml")
async def sitemap_stocks():
    today = datetime.utcnow().strftime("%Y-%m-%d")
    urls: list[str] = []

    try:
        async for conn in get_db_connection():
            stock_rows = await conn.execute(text("""
                SELECT DISTINCT ON (symbol) symbol, completed_at
                FROM stock_analyses
                WHERE status = 'complete'
                ORDER BY symbol, completed_at DESC
            """))
            stocks = [
                {
                    "symbol": row[0],
                    "lastmod": row[1].strftime("%Y-%m-%d") if row[1] else today,
                }
                for row in stock_rows.fetchall()
            ]
            # Core tickers first, then most recently analyzed, capped
            stocks.sort(key=lambda s: s["lastmod"], reverse=True)
            chosen: list[dict] = []
            seen: set[str] = set()
            for s in stocks:
                if s["symbol"] in CORE_TICKERS and s["symbol"] not in seen:
                    chosen.append(s)
                    seen.add(s["symbol"])
            for s in stocks:
                if len(chosen) >= MAX_STOCK_URLS:
                    break
                if s["symbol"] not in seen:
                    chosen.append(s)
                    seen.add(s["symbol"])
            for s in chosen:
                urls.append(_url_block(f"/stocks/{s['symbol']}", s["lastmod"], "weekly", "0.8"))
            break
    except Exception:
        pass

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(urls)
        + "\n</urlset>\n"
    )
    return Response(content=xml, media_type="application/xml")


# ── JSON endpoint for build-time sitemap generation ──────────────────────────

@router.get("/sitemap-entries")
async def sitemap_entries():
    """JSON endpoint consumed at build time to generate a static sitemap."""
    blogs: list[dict] = []
    stocks: list[dict] = []

    try:
        async for conn in get_db_connection():
            blog_rows = await conn.execute(text(
                "SELECT slug, published_at FROM published_blogs ORDER BY published_at DESC"
            ))
            for row in blog_rows.fetchall():
                blogs.append({
                    "slug": row[0],
                    "published_at": row[1].strftime("%Y-%m-%d") if row[1] else None,
                })

            stock_rows = await conn.execute(text("""
                SELECT DISTINCT ON (symbol) symbol, completed_at
                FROM stock_analyses
                WHERE status = 'complete'
                ORDER BY symbol, completed_at DESC
            """))
            for row in stock_rows.fetchall():
                stocks.append({
                    "symbol": row[0],
                    "completed_at": row[1].strftime("%Y-%m-%d") if row[1] else None,
                })

            break
    except Exception:
        pass

    return {"blogs": blogs, "stocks": stocks}


# ── Admin: batch-ping all pages ──────────────────────────────────────────────

@router.post("/ping-all-pages")
async def ping_all_pages(claims: Dict = Depends(verify_admin)):
    """
    Admin-only: batch-ping every known page to IndexNow, Google, and Bing.
    Uses a single batch request instead of per-URL pings to avoid Lambda timeout.
    """
    from utils.seo_ping import notify_search_engines_batch

    all_urls: list[str] = []

    # Static pages
    for p in STATIC_PAGES:
        all_urls.append(f"{SITE}{p['loc']}")

    # Bundled blog posts
    for slug in BUNDLED_BLOG_SLUGS:
        all_urls.append(f"{SITE}/blog/{slug}")

    # DB blogs + stock pages
    try:
        async for conn in get_db_connection():
            rows = await conn.execute(text(
                "SELECT slug FROM published_blogs ORDER BY published_at DESC"
            ))
            for row in rows.fetchall():
                all_urls.append(f"{SITE}/blog/{row[0]}")

            stock_rows = await conn.execute(text(
                "SELECT DISTINCT symbol FROM stock_analyses WHERE status = 'complete' ORDER BY symbol"
            ))
            for row in stock_rows.fetchall():
                all_urls.append(f"{SITE}/stocks/{row[0]}")

            break
    except Exception as e:
        return {"success": False, "error": str(e)}

    unique_urls = list(dict.fromkeys(all_urls))
    await notify_search_engines_batch(unique_urls)

    return {"success": True, "pinged_count": len(unique_urls)}
