from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request, Response, Query
from typing import Dict, Any, List, Optional
import json
import os
import asyncio
import uuid
import logging
import httpx
import base64
from datetime import datetime

logger = logging.getLogger(__name__)
from sqlalchemy import text
from database import get_db_connection
from auth import verify_token, verify_admin
from models import BlogGenerationRequest, PublishBlogRequest
from services.vertex import analyze_with_vertex
from utils.gcp import get_gcp_credentials

router = APIRouter()

# ── Near-duplicate title detection (anti-cannibalization) ─────────────────────
# The SEO audit found 5+ near-identical posts per keyword (e.g. "Safe Dividend
# Stocks Under $50 for Beginners" published 5 times with different slugs). The
# old publish guard only blocked EXACT slug collisions, so reworded duplicates
# slipped through and split ranking signals.
#
# A plain title-Jaccard guard (0.72) was too weak: reworded twins that share the
# same SUBJECT but differ in framing ("Are Blue Chip Stocks Safe in 2026? What
# the Data Says" vs "Are Blue Chip Stocks Safe? Best Picks for Beginners") only
# overlap ~0.40 and slipped through. So we ALSO compare a distinctive-subject
# signature: the content tokens minus generic finance filler. If two titles
# share the same distinctive subject, they're duplicates regardless of framing.
# A temporal exception keeps legitimately-recurring news posts (different
# month/quarter — e.g. "May" vs "June Jobs Report") from being flagged.
# Validated against the full 250-post corpus (see commit notes).
_TITLE_STOPWORDS = {
    "the", "a", "an", "and", "or", "for", "to", "in", "of", "on", "with", "your",
    "you", "that", "this", "are", "is", "be", "as", "at", "by", "it", "what",
    "how", "why", "which", "who", "should", "can", "will", "do", "does", "vs",
    "right", "now", "before", "during", "after", "every", "into", "from",
}
# Generic finance words that do NOT identify a topic's subject.
_TOPIC_FILLER = _TITLE_STOPWORDS | {
    "best", "top", "good", "great", "safe", "stock", "stocks", "etf", "etfs",
    "fund", "funds", "share", "shares", "invest", "investing", "investment",
    "investor", "investors", "beginner", "beginners", "new", "pick", "picks",
    "buy", "hold", "guide", "explained", "2026", "2025", "2024", "real", "names",
    "long", "term", "high", "market", "markets", "us", "step", "steps",
    "checklist", "need", "year", "years", "money", "smart", "simple", "complete",
    "ultimate", "today", "current", "latest", "bet",
}
_MONTHS = {
    "january", "february", "march", "april", "may", "june", "july", "august",
    "september", "october", "november", "december", "jan", "feb", "mar", "apr",
    "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec",
}
_QUARTERS = {"q1", "q2", "q3", "q4", "h1", "h2"}


def _title_tokens(title: str) -> set:
    import re
    words = re.findall(r"[a-z0-9$]+", (title or "").lower())
    return {w.strip("$") for w in words if w not in _TITLE_STOPWORDS and len(w) > 1}


def _topic_signature(title: str) -> set:
    """Distinctive subject tokens — content tokens minus generic finance filler."""
    import re
    words = re.findall(r"[a-z0-9$]+", (title or "").lower())
    return {w.strip("$") for w in words if w not in _TOPIC_FILLER and len(w) > 1}


def _temporal_markers(title: str) -> set:
    import re
    toks = set(re.findall(r"[a-z0-9]+", (title or "").lower()))
    return (toks & _MONTHS) | (toks & _QUARTERS)


def _near_duplicate_of(new_title: str, existing_titles: list, threshold: float = 0.6):
    """Return the first existing title that is a near-duplicate, else None.

    Matches on (a) distinctive-subject signature overlap — same subject regardless
    of framing — or (b) full-title Jaccard >= threshold. Skips comparison when both
    titles carry DIFFERENT temporal markers (month/quarter), so recurring dated
    news posts are not treated as duplicates of each other.
    """
    new_tokens = _title_tokens(new_title)
    new_sig = _topic_signature(new_title)
    new_temporal = _temporal_markers(new_title)
    for existing in existing_titles:
        ex_temporal = _temporal_markers(existing)
        if new_temporal and ex_temporal and new_temporal != ex_temporal:
            continue  # distinct time period (e.g. May vs June report) → not a dup
        ex_sig = _topic_signature(existing)
        # (a) distinctive-subject signature: same subject → duplicate
        if new_sig and ex_sig:
            shared_sig = new_sig & ex_sig
            smaller = min(len(new_sig), len(ex_sig))
            if len(shared_sig) >= 2 and (
                len(shared_sig) >= smaller
                or len(shared_sig) / len(new_sig | ex_sig) >= 0.5
            ):
                return existing
        # (b) full-title Jaccard fallback
        ex_tokens = _title_tokens(existing)
        if len(new_tokens) >= 3 and len(ex_tokens) >= 3:
            shared = new_tokens & ex_tokens
            union = new_tokens | ex_tokens
            if len(shared) >= 3 and union and (len(shared) / len(union)) >= threshold:
                return existing
    return None


async def append_blog_log(conn, job_id: str, message: str):
    ts = datetime.utcnow().strftime("%H:%M:%S")
    log_msg = f"[{ts}] {message}"
    await conn.execute(text("""
        UPDATE blog_jobs 
        SET progress_logs = progress_logs || CAST(:log AS jsonb),
            updated_at = NOW()
        WHERE id = :id
    """), {"log": json.dumps([log_msg]), "id": job_id})
    await conn.commit()


@router.get("/blogs")
async def get_blogs(limit: int = 200, offset: int = 0):
    """
    Returns a list of published blog posts.
    """
    try:
        async for conn in get_db_connection():
            res = await conn.execute(text("""
                SELECT id, slug, title, excerpt, author, published_at, 
                       read_time, tags, image_url, meta_description, sources
                FROM published_blogs
                ORDER BY published_at DESC
                LIMIT :limit OFFSET :offset
            """), {"limit": limit, "offset": offset})
            rows = res.mappings().fetchall()
            bucket_domain = f"https://storage.googleapis.com/{os.environ.get('GCS_BUCKET_NAME', 'your-gcs-bucket')}/"
            processed = []
            for row in rows:
                d = dict(row)
                img = d.get("image_url")
                if img:
                    # Strip GCS prefix if it exists to normalize to relative path
                    if img.startswith(bucket_domain):
                        img = img.replace(bucket_domain, "")
                    
                    if img.startswith("images/"):
                        d["image_url"] = f"/blogs/images/{img}"
                processed.append(d)
            return processed
            break
    except Exception as e:
        print(f"Error fetching blogs: {e}")
        return []

@router.get("/blogs/{slug}")
async def get_blog_by_slug(slug: str):
    """
    Returns a single blog post by its slug.
    """
    try:
        async for conn in get_db_connection():
            res = await conn.execute(text("""
                SELECT id, slug, title, excerpt, content, author, published_at, 
                       read_time, tags, image_url, meta_description, sources
                FROM published_blogs
                WHERE slug = :slug
            """), {"slug": slug})
            row = res.mappings().fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Blog not found")
            d = dict(row)
            img = d.get("image_url")
            content = d.get("content", "")
            bucket_domain = f"https://storage.googleapis.com/{os.environ.get('GCS_BUCKET_NAME', 'your-gcs-bucket')}/"
            
            # 1. Process Hero Image
            if img:
                 if img.startswith(bucket_domain):
                     img = img.replace(bucket_domain, "")
                 if img.startswith("images/"):
                     d["image_url"] = f"/blogs/images/{img}"
            
            # 2. Process Content Images
            if bucket_domain in content:
                # Replace all GCS URLs with local proxy path
                d["content"] = content.replace(bucket_domain, "/blogs/images/")
                
            return d
            break
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching blog {slug}: {e}")
        raise HTTPException(status_code=500, detail="Database error")

_signed_url_cache: Dict[str, tuple] = {}

@router.get("/blogs/images/{path:path}")
async def proxy_image(path: str):
    """
    Generates a signed URL for a private GCS image and redirects to it.
    Cached in-memory for 55 min so warm Lambda containers skip the GCS round-trip.
    """
    from datetime import timedelta
    from starlette.responses import RedirectResponse

    clean_path = path.lstrip("/")
    now = datetime.utcnow()

    cached = _signed_url_cache.get(clean_path)
    if cached:
        cached_url, expires_at = cached
        if now < expires_at:
            return RedirectResponse(
                url=cached_url,
                status_code=302,
                headers={"Cache-Control": "public, max-age=3300"},
            )

    bucket_name = os.environ.get("GCS_BUCKET_NAME", "your-gcs-bucket")
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")

    try:
        get_gcp_credentials()

        def _get_signed_url() -> str | None:
            from google.cloud import storage as gcs
            client = gcs.Client(project=project_id) if project_id else gcs.Client()
            bucket = client.bucket(bucket_name)
            blob = bucket.blob(clean_path)
            if not blob.exists():
                return None
            return blob.generate_signed_url(
                version="v4",
                expiration=timedelta(hours=1),
                method="GET",
            )

        signed_url = await asyncio.to_thread(_get_signed_url)

        if signed_url is None:
            raise HTTPException(status_code=404, detail=f"Image not found: {clean_path}")

        _signed_url_cache[clean_path] = (signed_url, now + timedelta(minutes=55))

        return RedirectResponse(
            url=signed_url,
            status_code=302,
            headers={"Cache-Control": "public, max-age=3300"},
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[GCS Proxy] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to serve image: {str(e)}")



@router.post("/discover-blog-topics")
async def discover_blog_topics(claims: Dict = Depends(verify_token)):
    """
    Search web for trending topics and return GEO-optimized questions.
    """
    try:
        # 1. Fetch recent blogs to avoid repeats
        recent_titles = []
        async for conn in get_db_connection():
            res = await conn.execute(text("SELECT title FROM published_blogs ORDER BY published_at DESC LIMIT 20"))
            recent_titles = [row[0] for row in res.fetchall()]
            break

        # 2. Prepare prompt
        current_date = datetime.now().strftime("%B %d, %Y")
        prompt = f"""You are a GEO (Generative Engine Optimization) content strategist. Today is {current_date}.
        Analyze current financial news and identify 5 blog topics optimized for AI citation (Perplexity, ChatGPT).
        
        AVOID THESE RECENT TITLES:
        {json.dumps(recent_titles, indent=2)}
        
        TRANSFORMATION RULE:
        Convert news into questions real investors ask AI engines.
        
        Return JSON structure:
        {{
          "topics": [
            {{
              "topic": "The exact question title",
              "reason": "Why now?",
              "relevanceScore": 1-10,
              "timeliness": "trending_now" | "emerging" | "evergreen",
              "claritxConnection": "How our tools help",
              "suggestedAngle": "Unique perspective",
              "geoScore": 1-10,
              "aiSearchQueries": ["q1", "q2", "q3"],
              "contentStructure": "faq" | "comparison" | "explainer" | "how-to",
              "updateFrequency": "daily" | "weekly" | "evergreen"
            }}
          ]
        }}
        """

        # 3. Call Vertex with search tool
        # Note: analyze_with_vertex already uses google_search: {} in its config
        ai_res = await analyze_with_vertex("topics", prompt)
        if isinstance(ai_res, str):
            ai_res = json.loads(ai_res)
            
        return {
            "success": True,
            "topics": ai_res.get("topics", [])
        }

    except Exception as e:
        print(f"Topic discovery error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/publish-blog")
async def publish_blog(request: PublishBlogRequest, claims: Dict = Depends(verify_admin)):
    """
    Saves a blog post to the database.
    """
    try:
        blog = request.blog
        slug = blog.get("slug")
        
        if not slug:
            raise HTTPException(status_code=400, detail="Missing slug")

        async for conn in get_db_connection():
            # Check for existing exact slug
            check = await conn.execute(text("SELECT id FROM published_blogs WHERE slug = :slug"), {"slug": slug})
            if check.fetchone():
                return {"success": False, "error": f"Blog with slug '{slug}' already exists."}

            # Anti-cannibalization: reject near-duplicate titles (reworded
            # versions of an already-published topic that would split rankings).
            new_title = blog.get("title", "")
            if new_title:
                existing_rows = await conn.execute(text("SELECT title FROM published_blogs"))
                existing_titles = [r[0] for r in existing_rows.fetchall() if r[0]]
                dup = _near_duplicate_of(new_title, existing_titles)
                if dup:
                    logger.info(f"[Blog Publish] Rejected near-duplicate: '{new_title}' ~ '{dup}'")
                    return {
                        "success": False,
                        "error": f"Near-duplicate of existing post '{dup}'. "
                                 f"Update that post instead of publishing a similar one.",
                    }

            # Safe parse read_time
            read_time_raw = blog.get("readTime", 5)
            try:
                # Handle cases like "10 minutes" or "15 mins"
                if isinstance(read_time_raw, str):
                    import re
                    match = re.search(r'(\d+)', read_time_raw)
                    read_time = int(match.group(1)) if match else 5
                else:
                    read_time = int(read_time_raw)
            except:
                read_time = 5

            # Insert
            await conn.execute(text("""
                INSERT INTO published_blogs (
                    slug, title, excerpt, content, author, 
                    read_time, tags, meta_description, sources, image_url
                ) VALUES (
                    :slug, :title, :excerpt, :content, :author,
                    :read_time, :tags, :meta_description, :sources, :image_url
                )
            """), {
                "slug": slug,
                "title": blog.get("title"),
                "excerpt": blog.get("excerpt"),
                "content": blog.get("content"),
                "author": blog.get("author", "ClaritX Research Team"),
                "read_time": read_time,
                "tags": blog.get("tags", []),
                "meta_description": blog.get("metaDescription", ""),
                "sources": json.dumps(blog.get("sources", [])),
                "image_url": blog.get("image_url") or ""
            })
            await conn.commit()
            break

        # Notify search engines about the new blog post
        try:
            from utils.seo_ping import notify_search_engines
            logger.info(f"[Blog Publish] Pinging search engines for /blog/{slug}")
            await notify_search_engines(f"https://www.claritx.ai/blog/{slug}")
            logger.info(f"[Blog Publish] SEO ping complete for /blog/{slug}")
        except Exception as e:
            logger.error(f"[Blog Publish] SEO ping failed for /blog/{slug}: {e}")

        return {
            "success": True,
            "blog": {
                **blog,
                "published_at": datetime.now().isoformat()
            }
        }

    except Exception as e:
        print(f"Publish error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-blog")
async def generate_blog(request: BlogGenerationRequest, claims: Dict = Depends(verify_token)):
    """
    Standard blog generation.
    """
    from services.gemini import generate_blog_with_gemini
    try:
        user_topic = request.userPrompt or ""
        count = request.count or 1
        
        result = await generate_blog_with_gemini(user_topic, count)
        
        if "error" in result:
             raise HTTPException(status_code=500, detail=result["error"])

        return {
            "success": True,
            "blogs": result.get("blogs", [])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-blog-grounded")
async def generate_blog_grounded(request: BlogGenerationRequest, background_tasks: BackgroundTasks, claims: Dict = Depends(verify_token)):
    """
    Blog generation with Google Search grounding - Async Job Pattern.
    """
    user_id = claims.get("sub")
    topic = request.userPrompt or "latest financial trends"
    count = request.count or 1
    
    job_id = str(uuid.uuid4())
    
    async for conn in get_db_connection():
        # Create a job with 'pending' status
        await conn.execute(text("""
            INSERT INTO blog_jobs (id, user_id, topic, count, status, progress_pct, progress_logs)
            VALUES (:id, :user_id, :topic, :count, 'pending', 0, '[]'::jsonb)
        """), {"id": job_id, "user_id": user_id, "topic": topic, "count": count})
        await conn.commit()
        break
        
    queue_url = os.environ.get("SQS_BACKGROUND_QUEUE_URL")
    if queue_url:
        try:
            import boto3
            from botocore.config import Config
            sqs = boto3.client("sqs", 
                               region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
                               config=Config(connect_timeout=2, read_timeout=2, retries={'max_attempts': 1}))
            
            def dispatch():
                return sqs.send_message(
                    QueueUrl=queue_url,
                    MessageBody=json.dumps({"action": "GENERATE_BLOG_GROUNDED", "job_id": job_id})
                )
                
            loop = asyncio.get_event_loop()
            await asyncio.wait_for(loop.run_in_executor(None, dispatch), timeout=5.0)
            print(f"[BlogGen] Dispatched job {job_id} to SQS")
        except Exception as e:
            print(f"[BlogGen] SQS dispatch failed ({e}), falling back to local background task")
            background_tasks.add_task(blog_grounded_worker_task, job_id)
    else:
        background_tasks.add_task(blog_grounded_worker_task, job_id)
        
    return {"success": True, "jobId": job_id}

async def blog_grounded_worker_task(job_id: str):
    async for conn in get_db_connection():
        # Fetch job
        res = await conn.execute(text("SELECT topic, count, status, updated_at FROM blog_jobs WHERE id = :id"), {"id": job_id})
        job = res.fetchone()
        if not job:
            return
        
        topic, count, status, updated_at = job
        
        # If 'running' but no update for 15 mins, allow retry
        is_stale = status == 'running' and (datetime.utcnow() - updated_at.replace(tzinfo=None)).total_seconds() > 900
        if status == 'completed' or (status == 'running' and not is_stale):
            return
        
        await conn.execute(text("UPDATE blog_jobs SET status = 'running', progress_pct = 10 WHERE id = :id"), {"id": job_id})
        await conn.commit()
        await append_blog_log(conn, job_id, f"Initializing grounded generation for: {topic}")
        
        try:
            # Detect beginner-focused topics so we can add extra stock-naming instructions
            beginner_keywords = ["beginner", "safe stock", "low-risk", "low risk", "blue chip", "best stock", "starter", "first invest", "small budget", "under $"]
            is_beginner_topic = any(kw in topic.lower() for kw in beginner_keywords)
            beginner_extra = """
═══════════════════════════════════════════════════════
BEGINNER-INVESTOR REQUIREMENTS (this topic targets new investors)
═══════════════════════════════════════════════════════

STOCK NAMES ARE MANDATORY: You MUST name at least 8-10 specific real stocks or ETFs.
  ✅ "Johnson & Johnson (JNJ) has paid dividends for 60+ consecutive years..."
  ✅ "Procter & Gamble (PG), Coca-Cola (KO), and Walmart (WMT) are classic defensive picks..."
  ❌ "Many blue-chip companies offer stable returns..." (too vague — do not use)

COMPARISON TABLE: Include a table with columns: Stock/ETF | Ticker | Sector | Dividend Yield | 5-Year Return | Risk Level
  Use real approximate data. Source each figure.

PLAIN LANGUAGE: Explain every term the first time it appears (e.g., "P/E ratio (price-to-earnings ratio, a measure of how expensive a stock is relative to its profits)").

SEARCH INTENT MATCH: The title and opening must directly answer the implicit question.
  If the topic is "Best safe stocks for beginners" — the first paragraph must say: "The safest stocks for beginners include [3 names] because..."
  Do NOT delay the answer with background fluff.
""" if is_beginner_topic else ""

            prompt = f"""You are an expert financial content writer for ClaritX, an AI-powered stock analysis platform.
Generate {count} SEO- and GEO-optimized blog post(s) about: {topic}.
Use Google Search to find REAL, verifiable data: current statistics with dates, named sources, specific numbers, and recent news.
{beginner_extra}
═══════════════════════════════════════════════════════
AUDIENCE & CONVERSION (write for QUALITY readers, not just traffic)
═══════════════════════════════════════════════════════
Write for an investor who is ACTIVELY RESEARCHING A DECISION right now — someone
deciding what to buy, sell, or hold — not a passive learner. Be specific and
decision-useful: name real tickers, give concrete numbers, and tell the reader
what to actually check before acting.
Every post MUST naturally bridge to ClaritX's core action: analyzing a specific
stock with the free AI tool. Do this TWICE:
  • Once early (within the first 2-3 sections), in-context — e.g. "Before buying
    any of these, run it through a free 9-perspective AI analysis to check the
    fundamentals, sentiment, and valuation in one place:
    **[→ Analyze any stock free](/ai-stock-analysis)**".
  • Again in the "Related ClaritX Tools" section near the end.
The goal is a reader who CLICKS INTO THE PRODUCT, not one who reads and leaves.
Keep it genuinely helpful and honest (no hype) — quality readers convert; clickbait does not.

═══════════════════════════════════════════════════════
STRUCTURE REQUIREMENTS (follow exactly)
═══════════════════════════════════════════════════════

TITLE: 50-60 characters. Place the primary keyword near the start. No clickbait.

OPENING (first 60 words): Define the core concept immediately — "What is [topic]?" — with one grounded statistic and the article's thesis. This definition block is critical for AI search engines (≈44% of AI citations come from the first 30% of the text — answer first, never bury it).

KEY TAKEAWAYS: Immediately after the opening, add a "## Key Takeaways" section with 3-5 bullet points, each a single self-contained fact/answer (≤25 words). This is the block Google AI Overviews and Perplexity quote most often, and it lifts the search snippet.

H2 HEADINGS: Phrase EVERY H2 as a question the reader would actually search.
  ✅ "## How Do Dividend Stocks Generate Passive Income?"
  ❌ "## Benefits of Dividends"

PASSAGE BLOCKS: Write each H2 section as a self-contained passage of 134-167 words that fully answers its heading question on its own. AI search engines (ChatGPT, Perplexity, Google AIO) select these as cited snippets — each block must make sense without reading the rest of the article.

WORD COUNT: 2,000-2,500 words total (never below 1,500).

═══════════════════════════════════════════════════════
CONTENT REQUIREMENTS
═══════════════════════════════════════════════════════

SOURCES: Every statistic or data point MUST name its source inline.
  ✅ "According to the Federal Reserve (March 2025), ..."
  ✅ "Bloomberg data shows the S&P 500 returned 11.4% in 2024..."
  ❌ "Studies show..." or "Research indicates..." (no named source = do not use)

DATA TABLE: Include at least one markdown table comparing options, metrics, or historical data.
  Example: Compare 3-5 stocks/ETFs with columns for yield, P/E, 5-year return, sector.
  (Markdown tables render as HTML <table> — LLM crawlers parse tables but strip charts/CSS, so every comparison MUST be a table, not prose.)

BULLET LIST: Include at least one bulleted list of actionable takeaways or key facts.

FAQ SECTION: Near the end, add a "## Frequently Asked Questions" section with 3-5 real questions investors search, each answered in 40-50 words. Visible Q&A blocks are extracted by AI search engines and win long-tail featured snippets.

FRESHNESS: In the opening, state the current month and year (e.g. "As of [month] 2026, ...") and reference at least one data point from the last 90 days. Recency is a ranking and AI-citation signal for finance queries.

SPECIFICITY: Use concrete figures with dates. "As of Q1 2025, the dividend yield on the S&P 500 was 1.3%" — not "dividends are relatively low."

═══════════════════════════════════════════════════════
INTERNAL LINKS — REQUIRED SECTION
═══════════════════════════════════════════════════════

Include a "### Related ClaritX Tools" section near the end. Use EXACTLY this markdown format (the renderer converts these to React Router links):
  **[→ Link text here](/internal-path)**

Available pages (choose 2-4 most relevant to the topic):
  - Run a full 9-perspective AI analysis on any stock → /ai-stock-analysis
  - AI Stock Rankings for 1,000+ assets → /ai-stock-rank
  - Portfolio Simulator (risk-profile based) → /portfolio-simulator
  - Browse all tracked stocks → /stocks
  - Plans & Pricing → /pricing
  - Investment Research Blog → /blog

═══════════════════════════════════════════════════════
CLOSING
═══════════════════════════════════════════════════════

End with a disclaimer paragraph in *italics*: this content is for educational and informational purposes only and does not constitute investment advice. Always consult a licensed financial professional before making any investment decisions.

═══════════════════════════════════════════════════════
OUTPUT — return valid JSON only (no markdown wrapper)
═══════════════════════════════════════════════════════

{{
  "blogs": [
    {{
      "slug": "keyword-rich-url-slug-60-chars-max",
      "title": "Exact Title — 50-60 Characters with Primary Keyword",
      "excerpt": "1-2 sentence summary that includes the primary keyword and hooks the reader.",
      "content": "Full markdown content 2000-2500 words: opening definition, ## question headings, 134-167 word self-contained H2 sections, at least one table, at least one bullet list, Related ClaritX Tools section, italic disclaimer.",
      "tags": ["Primary Keyword", "Secondary Keyword", "Topic Category", "Audience Tag"],
      "metaDescription": "120-160 char description with primary keyword and an action phrase like 'Learn how...' or 'Discover...'",
      "readTime": 9,
      "imagePrompt": "Vivid stylized digital illustration, rich saturated colors, dramatic lighting: [describe a creative visual metaphor that captures the article's core idea — e.g. a glowing tree growing from gold coins with stock chart branches, a compass pointing through a maze of financial data, hands carefully balancing a scale with growth arrows and shields]. Style: modern editorial illustration, bold shapes, cinematic composition, slightly fantastical, visually striking and intriguing, 16:9 wide format. Absolutely no text, no words, no watermarks, no logos.",
      "sources": [{{"uri": "https://source.com/article", "title": "Source Name (Month Year)"}}]
    }}
  ]
}}
"""
            
            await append_blog_log(conn, job_id, "🔍 Researching and generating grounded content...")
            ai_res = await analyze_with_vertex("blog", prompt)
            
            if isinstance(ai_res, str):
                # Clean JSON if AI wrapped it in markdown
                clean_res = ai_res.strip()
                if clean_res.startswith("```json"):
                    clean_res = clean_res.split("```json")[1].split("```")[0].strip()
                elif clean_res.startswith("```"):
                    clean_res = clean_res.split("```")[1].split("```")[0].strip()
                ai_res = json.loads(clean_res)
            
            blogs = ai_res.get("blogs", [])
            from services.vertex import generate_image_with_vertex
            
            for b in blogs:
                img_prompt = b.get("imagePrompt")
                slug = b.get("slug")
                if img_prompt and slug:
                    await append_blog_log(conn, job_id, f"🎨 Generating unique image for '{b.get('title')}'...")
                    img_url = await generate_image_with_vertex(img_prompt, slug)
                    b["image_url"] = img_url
                
                # Safe parse readTime here too
                rt_raw = b.get("readTime", 5)
                try:
                    if isinstance(rt_raw, str):
                        import re
                        m = re.search(r'(\d+)', rt_raw)
                        b["readTime"] = int(m.group(1)) if m else 5
                    else:
                        b["readTime"] = int(rt_raw)
                except:
                    b["readTime"] = 5
                
                if not b.get("image_url"):
                    b["image_url"] = ""

            await conn.execute(text("""
                UPDATE blog_jobs
                SET status = 'completed', progress_pct = 100, result = :result
                WHERE id = :id
            """), {"result": json.dumps({"blogs": blogs, "grounded": True}), "id": job_id})
            await conn.commit()
            await append_blog_log(conn, job_id, f"✅ Successfully generated {len(blogs)} blog(s)")

            # Auto-publish: insert each blog directly into published_blogs
            published_count = 0
            for b in blogs:
                pub_slug = b.get("slug", "").strip()
                if not pub_slug:
                    continue
                try:
                    # Skip if slug already exists
                    existing = await conn.execute(
                        text("SELECT id FROM published_blogs WHERE slug = :slug"),
                        {"slug": pub_slug}
                    )
                    if existing.fetchone():
                        await append_blog_log(conn, job_id, f"⚠️ Skipped '{pub_slug}' — already published")
                        continue

                    # Anti-cannibalization: skip near-duplicate titles. The daily
                    # auto-publisher previously only checked exact slugs, which is
                    # how 5+ reworded twins per topic ("S&P 500 vs individual
                    # stocks ...") got published and split rankings.
                    pub_title = (b.get("title") or "").strip()
                    if pub_title:
                        _ex = await conn.execute(text("SELECT title FROM published_blogs"))
                        _existing_titles = [r[0] for r in _ex.fetchall() if r[0]]
                        _dup = _near_duplicate_of(pub_title, _existing_titles)
                        if _dup:
                            await append_blog_log(conn, job_id, f"⚠️ Skipped '{pub_slug}' — near-duplicate of '{_dup}'")
                            continue

                    # Parse read_time safely
                    rt_raw = b.get("readTime", 5)
                    try:
                        if isinstance(rt_raw, str):
                            import re as _re
                            m = _re.search(r'(\d+)', rt_raw)
                            read_time = int(m.group(1)) if m else 5
                        else:
                            read_time = int(rt_raw)
                    except Exception:
                        read_time = 5

                    await conn.execute(text("""
                        INSERT INTO published_blogs (
                            slug, title, excerpt, content, author,
                            read_time, tags, meta_description, sources, image_url
                        ) VALUES (
                            :slug, :title, :excerpt, :content, :author,
                            :read_time, :tags, :meta_description, :sources, :image_url
                        )
                    """), {
                        "slug": pub_slug,
                        "title": b.get("title"),
                        "excerpt": b.get("excerpt", ""),
                        "content": b.get("content", ""),
                        "author": "ClaritX Research Team",
                        "read_time": read_time,
                        "tags": b.get("tags", []),
                        "meta_description": b.get("metaDescription", ""),
                        "sources": json.dumps(b.get("sources", [])),
                        "image_url": b.get("image_url", ""),
                    })
                    await conn.commit()
                    published_count += 1
                    await append_blog_log(conn, job_id, f"📢 Auto-published: '{b.get('title')}'")

                    # Notify Google, Bing, IndexNow so new post is indexed quickly
                    try:
                        from utils.seo_ping import notify_search_engines
                        logger.info(f"[Blog Auto-Publish] Pinging search engines for /blog/{pub_slug}")
                        await notify_search_engines(f"https://www.claritx.ai/blog/{pub_slug}")
                        logger.info(f"[Blog Auto-Publish] SEO ping complete for /blog/{pub_slug}")
                    except Exception as e:
                        logger.error(f"[Blog Auto-Publish] SEO ping failed for /blog/{pub_slug}: {e}")

                except Exception as pub_err:
                    await append_blog_log(conn, job_id, f"❌ Failed to publish '{pub_slug}': {pub_err}")

            await append_blog_log(conn, job_id, f"🎉 Auto-published {published_count}/{len(blogs)} blog(s) successfully")
            
        except Exception as e:
            await conn.execute(text("UPDATE blog_jobs SET status = 'failed', error_message = :err WHERE id = :id"), 
                            {"err": str(e), "id": job_id})
            await conn.commit()
            await append_blog_log(conn, job_id, f"❌ Generation failed: {str(e)}")
        
        break

@router.get("/blog-jobs")
async def list_blog_jobs(limit: int = 50, claims: Dict = Depends(verify_admin)):
    """
    Lists recent blog generation jobs (for admin review).
    """
    try:
        async for conn in get_db_connection():
            res = await conn.execute(text("""
                SELECT id, user_id, topic, count, status, progress_pct, created_at, updated_at 
                FROM blog_jobs 
                ORDER BY created_at DESC 
                LIMIT :limit
            """), {"limit": limit})
            return {"success": True, "jobs": [dict(row) for row in res.mappings().all()]}
    except Exception as e:
        return {"success": False, "error": str(e)}

@router.post("/blog-job-status")
@router.get("/blog-job-status")
async def get_blog_job_status(request: Dict[str, Any] = None, jobId: Optional[str] = None):
    jid = None
    if request and "jobId" in request:
        jid = request["jobId"]
    elif jobId:
        jid = jobId
        
    if not jid:
        raise HTTPException(status_code=400, detail="jobId is required")

    async for conn in get_db_connection():
        res = await conn.execute(text("SELECT status, progress_pct, progress_logs, result, error_message FROM blog_jobs WHERE id = :id"), {"id": jid})
        row = res.fetchone()
        if not row:
            return {"success": False, "error": "Job not found"}
            
        status, progress_pct, logs, result, error = row
        return {
            "success": True,
            "job": {
                "status": status,
                "progress_pct": progress_pct,
                "progress_logs": logs,
                "result": result,
                "error_message": error
            }
        }

@router.post("/auto-publish-daily-blog")
async def auto_publish_daily_blog(background_tasks: BackgroundTasks, claims: Dict = Depends(verify_admin)):
    """
    Triggers the daily auto-publish pipeline.
    """
    queue_url = os.environ.get("SQS_BACKGROUND_QUEUE_URL")
    if queue_url:
        try:
            import boto3
            sqs = boto3.client("sqs", region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))
            sqs.send_message(
                QueueUrl=queue_url,
                MessageBody=json.dumps({"action": "DAILY_BLOG_RESEARCH"})
            )
        except Exception as e:
            print(f"Failed to dispatch daily research: {e}")
            background_tasks.add_task(run_daily_blog_research)
    else:
        background_tasks.add_task(run_daily_blog_research)
        
    return {
        "success": True,
        "message": "Daily research job dispatched"
    }

# ─────────────────────────────────────────────────────────────────────────────
# Evergreen topic clusters — every topic here was validated against the full
# 250-post live corpus (src/data/blogSlugs.json) and confirmed NOT to duplicate
# any existing post. This replaced an earlier list whose "safe stocks for
# beginners / blue chip / consumer staples / utility" topics collided head-on
# with themes the blog had already published 4-8 times each (the very
# cannibalization this change set out to stop — caught by adversarial review).
#
# The blog has already saturated the beginner/dividend/defensive themes, so the
# daily generator now targets only genuinely NET-NEW subjects (covered-call ETFs,
# T-bills, money-market, yield curve, equal- vs cap-weight, CAPE ratio, Mag-7
# concentration, beta, diversification, gold hedge, growth-vs-value, active-vs-
# passive). Many are "vs / comparison" formats — the highest-converting page type
# per the SEO research. The daily picker rotates ACROSS clusters so two same-theme
# posts never publish the same day, and _near_duplicate_of is the real backstop.
# Top up via the validation harness before adding new topics here.
# ─────────────────────────────────────────────────────────────────────────────
TOPIC_CLUSTERS = {
    "etf_strategy": [
        "Best ETF to Buy and Hold for 20 Years: A Long-Term Investor's Guide",
        "Best Buy-and-Hold ETFs for a Roth IRA in 2026",
        "The 3-Fund Portfolio in 2026: A Simple Set-and-Forget ETF Strategy",
        "Equal-Weight vs Cap-Weight S&P 500: Which ETF Wins in 2026?",
        "Covered Call ETFs Explained: High Income vs Total Return (2026)",
        "Active vs Passive Funds: Which Actually Beats the Market in 2026?",
    ],
    "valuation_signals": [
        "Shiller PE (CAPE) Ratio 2026: What History Says About Future Returns",
        "Is the US Stock Market Overvalued in 2026? 4 Valuation Signals",
        "How to Spot an Overvalued Stock: 5 Warning Signs",
        "Is the S&P 500 Too Concentrated? The Magnificent 7 Risk in 2026",
    ],
    "income_and_cash": [
        "What Dividend Yield Do You Need to Retire? The 2026 Math",
        "Treasury Bills vs Dividend Stocks for Safe Income in 2026",
        "Money Market Funds vs HYSA vs T-Bills: Where to Park Cash in 2026",
        "REITs vs Dividend Stocks: Which Pays Better Income in 2026?",
    ],
    "risk_and_volatility": [
        "Low-Beta Stocks for 2026: Stability When Markets Get Choppy",
        "What Is a Good Beta for a Stock? Understanding Volatility in 2026",
        "How Many Stocks Should You Own? The Diversification Sweet Spot",
    ],
    "macro_signals": [
        "What Is the Yield Curve Telling Investors in 2026?",
        "Gold vs Stocks in 2026: Does a Safe-Haven Hedge Still Make Sense?",
        "Bonds vs Stocks in 2026: How to Split a Portfolio as Rates Shift",
    ],
}

# Flattened alias kept for any external reference / fallback.
BEGINNER_INVESTOR_TOPICS = [t for topics in TOPIC_CLUSTERS.values() for t in topics]


def _slugify_topic(title: str) -> str:
    import re
    s = title.lower()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s).strip("-")
    return s[:80]


def _pick_diverse_topics(published_slugs: set, published_titles: list, count: int, date_seed: str) -> list:
    """Pick `count` topics from DIFFERENT clusters (anti-cannibalization).

    - Rotates cluster order by date so the lead cluster varies day to day.
    - Real defense is _near_duplicate_of against published TITLES (the slug-prefix
      check is only a cheap extra — AI-authored slugs rarely match slugify(title)).
    - Takes at most one topic per cluster per run, so two same-theme posts never
      go out the same day.
    """
    import hashlib, random as _rng
    rng = _rng.Random(hashlib.md5(date_seed.encode()).hexdigest())
    cluster_names = list(TOPIC_CLUSTERS.keys())
    rng.shuffle(cluster_names)

    picks: list[str] = []
    for cname in cluster_names:
        if len(picks) >= count:
            break
        topics = TOPIC_CLUSTERS[cname][:]
        rng.shuffle(topics)
        for candidate in topics:
            # Primary guard: title near-duplicate against everything published.
            if _near_duplicate_of(candidate, published_titles):
                continue
            if _near_duplicate_of(candidate, picks):  # don't pick two similar in one run
                continue
            # Cheap extra: exact slug-prefix coincidence with an existing slug.
            cslug = _slugify_topic(candidate)
            if any(s.startswith(cslug[:30]) for s in published_slugs):
                continue
            picks.append(candidate)
            break  # one topic per cluster
    return picks

async def _get_published_slugs(conn) -> set:
    """Return the set of slugs already published so we can avoid duplicate topics."""
    try:
        res = await conn.execute(text("SELECT slug FROM published_blogs"))
        return {row[0] for row in res.fetchall()}
    except Exception:
        return set()

async def _dispatch_blog_job(conn, topic: str, user_id: str = "system-daily"):
    """Insert a blog_job row and send to SQS (or fall back to asyncio task)."""
    job_id = str(uuid.uuid4())
    await conn.execute(text("""
        INSERT INTO blog_jobs (id, user_id, topic, count, status, progress_pct, progress_logs)
        VALUES (:id, :user_id, :topic, 1, 'pending', 0, '[]'::jsonb)
    """), {"id": job_id, "user_id": user_id, "topic": topic})
    await conn.commit()

    queue_url = os.environ.get("SQS_BACKGROUND_QUEUE_URL")
    if queue_url:
        import boto3
        sqs = boto3.client("sqs", region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"))
        sqs.send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps({"action": "GENERATE_BLOG_GROUNDED", "job_id": job_id})
        )
    else:
        asyncio.create_task(blog_grounded_worker_task(job_id))

    return job_id

async def run_daily_blog_research():
    """
    Daily blog pipeline:
      • 2 beginner-investor posts (rotating curated list, skip already-published)
      • 1 AI-discovered trending market topic

    The beginner posts target the exact GSC queries we see impressions on
    ("safe stocks", "low-risk stocks", "blue chip stocks safe") but that get
    0 clicks because generic content ranks too deep. Specific stock names,
    list formats, and direct question matching push rankings up.
    """
    try:
        print("[DailyResearcher] Starting daily blog research...")
        async for conn in get_db_connection():
            published_slugs = await _get_published_slugs(conn)
            # Titles power the near-duplicate guard so we never queue a reworded
            # twin of an existing post.
            try:
                _tr = await conn.execute(text("SELECT title FROM published_blogs"))
                published_titles = [r[0] for r in _tr.fetchall() if r[0]]
            except Exception:
                published_titles = []

            # ── 1. Pick 2 evergreen topics from DIFFERENT GSC clusters ─────
            today_seed = datetime.utcnow().strftime("%Y-%m-%d")
            beginner_picks = _pick_diverse_topics(
                published_slugs, published_titles, count=2, date_seed=today_seed
            )

            print(f"[DailyResearcher] Cluster topics: {beginner_picks}")

            # ── 2. Discover 1 trending market topic via AI ────────────────
            from services.vertex import analyze_with_vertex
            trending_topic = None
            try:
                discovery_prompt = """Analyze the current US stock market and financial news as of today.
Identify ONE highly relevant trending topic for a ClaritX blog post aimed at retail investors.
It should be timely (tied to recent earnings, macro events, or sector news) and educational.
Return JSON only: {"topic": "Exact topic title", "reason": "Why it is trending today"}"""
                ai_res = await analyze_with_vertex("topics", discovery_prompt)
                if isinstance(ai_res, str):
                    clean = ai_res.strip()
                    if "```json" in clean: clean = clean.split("```json")[1].split("```")[0].strip()
                    ai_res = json.loads(clean)
                trending_topic = ai_res.get("topic")
            except Exception as e:
                print(f"[DailyResearcher] Trending topic discovery failed: {e}")

            # ── 3. Dispatch all jobs ──────────────────────────────────────
            all_topics = beginner_picks + ([trending_topic] if trending_topic else [])
            print(f"[DailyResearcher] Dispatching {len(all_topics)} blog jobs: {all_topics}")

            for topic_text in all_topics:
                job_id = await _dispatch_blog_job(conn, topic_text)
                print(f"[DailyResearcher] Job {job_id} created for: {topic_text}")

            break

        print("[DailyResearcher] Flow complete.")
    except Exception as e:
        print(f"[DailyResearcher] Error in daily research: {e}")