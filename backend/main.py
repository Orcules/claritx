import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from routers import analysis, logs, portfolio, blog, ranking, clients, batch, market, deep_search, credits, etoro, payment, whatsapp, chat, sitemap

app = FastAPI(title="Creative Project Dash API", docs_url="/docs", openapi_url="/openapi.json")

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",  # Match any origin while allowing credentials
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import Request
import time
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Request logging for all environments
if True:

    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        start_time = time.time()
        logger.info(f"Incoming request: {request.method} {request.url}")
        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            # response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            logger.info(f"Completed {request.method} {request.url.path} - Status: {response.status_code} in {process_time:.4f}s")
            return response
        except Exception as e:
            process_time = time.time() - start_time
            logger.error(f"Failed {request.method} {request.url.path} - Runtime Error: {e} in {process_time:.4f}s")
            raise

# --- Include Routers ---
app.include_router(analysis.router)
app.include_router(logs.router)
app.include_router(portfolio.router)
app.include_router(blog.router)
app.include_router(ranking.router)
app.include_router(clients.router)
app.include_router(batch.router)
app.include_router(market.router)
app.include_router(deep_search.router)
app.include_router(credits.router)
app.include_router(etoro.router)
app.include_router(payment.router)
app.include_router(whatsapp.router)
app.include_router(chat.router)
app.include_router(sitemap.router)

@app.get("/")
def health_check():
    return {"status": "ok", "service": "claritx-backend"}

# --- Handler for AWS Lambda ---
handler = Mangum(app)
