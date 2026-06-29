
from xai_sdk import Client
from xai_sdk.chat import user, system
from xai_sdk.tools import web_search, x_search, code_execution

import os
import time
import json
import asyncio
import uuid
from sqlalchemy import text
from utils.network import async_retry, RateLimiter

# Initialize Rate Limiter (Default: 60 calls/minute)
grok_limiter = RateLimiter(calls=60, period=60.0)

@async_retry(retries=2, delay=2.0)
async def analyze_grok(symbol: str, company_name: str = "", conn=None) -> str:
    """
    Use Grok (xAI) to search for social media sentiment (X posts + Web).
    Replaces previous Claude implementation.
    
    CURRENTLY DISABLED: Returning empty because API access is unavailable.
    """
    print(f"Skipping Grok analysis for {symbol} (API disabled).")
    return ""
