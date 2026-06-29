"""
SEO notification utilities.

Notifies search engines when pages are published or updated:
  1. IndexNow — instant pickup by Bing, Yandex, Naver, Seznam (batch up to 10K URLs)
  2. Google ping — submits sitemap URL so Google re-crawls
  3. Bing ping — submits sitemap URL
"""

from typing import List
import logging
import httpx

logger = logging.getLogger(__name__)

SITE = "https://www.claritx.ai"
SITEMAP_URL = f"{SITE}/sitemap.xml"
INDEXNOW_KEY = "claritx-indexnow-key"
INDEXNOW_BATCH_LIMIT = 10_000


async def notify_search_engines(page_url: str) -> None:
    """Best-effort ping for a single URL. Never raises."""
    await notify_search_engines_batch([page_url])


async def notify_search_engines_batch(urls: List[str]) -> None:
    """Best-effort batch ping. IndexNow accepts up to 10K URLs per request. Never raises."""
    if not urls:
        return

    unique_urls = list(dict.fromkeys(urls))
    logger.info(f"[SEO Ping] Starting ping for {len(unique_urls)} URL(s): {unique_urls[:5]}{'...' if len(unique_urls) > 5 else ''}")

    async with httpx.AsyncClient(timeout=12.0) as client:
        # IndexNow batch — split into chunks of 10K
        for i in range(0, len(unique_urls), INDEXNOW_BATCH_LIMIT):
            chunk = unique_urls[i:i + INDEXNOW_BATCH_LIMIT]
            try:
                resp = await client.post(
                    "https://api.indexnow.org/IndexNow",
                    json={
                        "host": "www.claritx.ai",
                        "key": INDEXNOW_KEY,
                        "keyLocation": f"{SITE}/{INDEXNOW_KEY}.txt",
                        "urlList": chunk,
                    },
                )
                logger.info(f"[SEO Ping] IndexNow batch ({len(chunk)} URLs) → HTTP {resp.status_code}")
            except Exception as e:
                logger.error(f"[SEO Ping] IndexNow failed: {type(e).__name__}: {e}")

        # Google sitemap ping (once)
        try:
            resp = await client.get(
                "https://www.google.com/ping",
                params={"sitemap": SITEMAP_URL},
            )
            logger.info(f"[SEO Ping] Google ping → HTTP {resp.status_code}")
        except Exception as e:
            logger.error(f"[SEO Ping] Google ping failed: {type(e).__name__}: {e}")

        # Bing sitemap ping (once)
        try:
            resp = await client.get(
                "https://www.bing.com/ping",
                params={"sitemap": SITEMAP_URL},
            )
            logger.info(f"[SEO Ping] Bing ping → HTTP {resp.status_code}")
        except Exception as e:
            logger.error(f"[SEO Ping] Bing ping failed: {type(e).__name__}: {e}")
