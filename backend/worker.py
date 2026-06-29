import json
import os
import asyncio
import logging

# Configure logging
import sys
import logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Log Environment (redacted)
logger.info(f"Worker starting. FMP_KEY set: {'FMP_API_KEY' in os.environ}, DB_URL set: {'DATABASE_URL' in os.environ}")

# Import from services
try:
    logger.info("Importing from services...")
    from services.analysis import (
        stock_analysis_internal,
        save_analysis_results,
        save_analysis_error,
        update_analysis_status,
        save_batch_analysis
    )
    logger.info("Import successful")
except ImportError as e:
    logger.error(f"Failed to import from services: {e}")
    # Fallback or exit
    raise
except Exception as e:
    logger.error(f"Unexpected error during import: {e}")
    raise

from database import engine
if engine is None:
    logger.error("Database engine not initialized in worker context")
    raise RuntimeError("DB Engine missing")

async def process_record(record):
    try:
        body = json.loads(record['body'])
        
        # Check for Batch Result Action
        if body.get('action') == 'SAVE_RESULT':
            symbol = body.get('symbol')
            data = body.get('data')
            logger.info(f"Processing BATCH RESULT for {symbol}")
            
            async with engine.connect() as conn:
                await save_batch_analysis(symbol, data, conn)
                logger.info(f"Batch result saved for {symbol}")
            return
            
        # Check for Batch Job Start Action
        if body.get('action') == 'START_BATCH_JOB':
            limit = body.get('limit', 10)
            asset_type = body.get('asset_type', 'stock')
            auto_process = body.get('auto_process', True)
            provider = body.get('provider', 'kie_direct')
            logger.info(f"Starting BATCH JOB FLOW ({asset_type}, limit={limit}, auto_process={auto_process}, provider={provider})")
            
            # Import here to avoid circular dependencies if any
            from services.batch import run_batch_job_flow

            result = await run_batch_job_flow(
                limit=limit,
                asset_type=asset_type,
                auto_process=auto_process,
                provider=provider,
                session_source="sqs_worker"
            )
            logger.info(f"Batch Job Flow Completed: {result}")
            return
            
        # Check for Single Kie Ticker Processing Action
        if body.get('action') == 'PROCESS_SINGLE_KIE_TICKER':
            candidate = body.get('candidate')
            asset_type = body.get('asset_type', 'stock')
            logger.info(f"Processing SINGLE KIE TICKER for {candidate.get('symbol') if candidate else 'Unknown'}")
            
            if not candidate:
                 logger.error("No candidate provided for PROCESS_SINGLE_KIE_TICKER")
                 return
                 
            from services.batch import process_single_kie_candidate

            try:
                result = await process_single_kie_candidate(candidate, asset_type=asset_type)
                logger.info(f"Single Kie Candidate Processing Completed for {candidate.get('symbol')}: {result}")
            except Exception as e:
                logger.error(f"Failed to process single kie candidate {candidate.get('symbol')}: {e}")
                raise e
            return
            
        # ---- Weekly Data Cleanup ----
        if body.get('action') == 'CLEANUP_OLD_DATA':
            logger.info("Processing CLEANUP_OLD_DATA action")
            from sqlalchemy import text as _text

            async with engine.connect() as conn:
                # activity_logs: keep last 90 days (currently 717K rows, growing unbounded)
                res = await conn.execute(_text(
                    "DELETE FROM activity_logs WHERE created_at < NOW() - INTERVAL '90 days'"
                ))
                deleted_logs = res.rowcount

                # stock_analyses: keep last 30 days (7-day cache TTL, 30-day history for debugging)
                res = await conn.execute(_text(
                    "DELETE FROM stock_analyses WHERE created_at < NOW() - INTERVAL '30 days'"
                ))
                deleted_analyses = res.rowcount

                # market_opportunities: delete expired entries
                res = await conn.execute(_text(
                    "DELETE FROM market_opportunities WHERE expires_at < NOW() - INTERVAL '7 days'"
                ))
                deleted_opps = res.rowcount

                # deep_search_jobs: keep last 30 days of completed/error jobs
                res = await conn.execute(_text(
                    "DELETE FROM deep_search_jobs WHERE created_at < NOW() - INTERVAL '30 days' AND status IN ('complete', 'error')"
                ))
                deleted_jobs = res.rowcount

                await conn.commit()
                logger.info(
                    f"Cleanup complete: {deleted_logs} logs, {deleted_analyses} analyses, "
                    f"{deleted_opps} opportunities, {deleted_jobs} deep-search jobs deleted"
                )
            return

        # ---- Market Movers Refresh (scheduled twice daily) ----
        if body.get('action') == 'REFRESH_MARKET_MOVERS':
            logger.info("Processing REFRESH_MARKET_MOVERS action")
            from routers.market import refresh_market_movers
            result = await refresh_market_movers()
            logger.info(f"Market movers refreshed — {len(result.get('movers', []))} movers cached")
            return

        # ---- Market Opportunities Scan ----
        if body.get('action') == 'SCAN_MARKET_OPPORTUNITIES':
            logger.info("Processing SCAN_MARKET_OPPORTUNITIES action")
            from routers.market import scan_market_opportunities
            await scan_market_opportunities(job_id=body.get('job_id', 'sqs-market-scan'))
            logger.info("Market opportunity scan completed")
            return

        # ---- Topic Discovery (dispatched async to avoid API GW timeout) ----
        if body.get('action') == 'DISCOVER_BLOG_TOPICS':
            job_id = body.get('job_id')
            if not job_id:
                logger.error("DISCOVER_BLOG_TOPICS missing job_id")
                return
            logger.info(f"Processing DISCOVER_BLOG_TOPICS for job {job_id}")
            from routers.blog import _discover_topics_worker
            await _discover_topics_worker(job_id)
            logger.info(f"Topic discovery for {job_id} completed")
            return

        # ---- WhatsApp Daily Digest ----

        if body.get('action') == 'WHATSAPP_DAILY_DIGEST':
            logger.info("Processing WHATSAPP_DAILY_DIGEST action")
            from services.whatsapp import build_daily_digest, send_whatsapp_message
            from sqlalchemy import text as _text

            async with engine.connect() as conn:
                # 1. Fetch active subscribers
                single_phone = body.get('phone')
                if single_phone:
                    # On-demand request for a single phone
                    query = "SELECT id, user_id, phone, name FROM whatsapp_subscribers WHERE phone = :phone"
                    params = {"phone": single_phone}
                else:
                    # Regular batch run
                    query = "SELECT id, user_id, phone, name FROM whatsapp_subscribers WHERE active = TRUE"
                    params = {}

                result = await conn.execute(_text(query), params)
                subscribers = result.fetchall()
                logger.info(f"[WhatsApp Digest] {len(subscribers)} subscribers for this run (phone={single_phone})")

                if not subscribers:
                    logger.info("[WhatsApp Digest] No subscribers found — skipping.")
                    return

                # 2. Fetch market movers data once (shared across all digests)
                movers_res = await conn.execute(_text(
                    "SELECT data FROM market_movers_cache WHERE id = 'latest'"
                ))
                movers_row = movers_res.fetchone()
                movers_data = {}
                if movers_row and movers_row[0]:
                    raw = movers_row[0]
                    movers_data = raw if isinstance(raw, dict) else json.loads(raw)
                logger.info(f"[WhatsApp Digest] Market movers loaded: {len(movers_data.get('movers', []))} entries")

                # 3. Fetch latest market opportunities (non-expired preferred)
                opps_res = await conn.execute(_text(
                    "SELECT opportunities FROM market_opportunities ORDER BY scanned_at DESC LIMIT 1"
                ))
                opps_row = opps_res.fetchone()
                opportunities = []
                if opps_row and opps_row[0]:
                    raw_opps = opps_row[0]
                    opportunities = raw_opps if isinstance(raw_opps, list) else json.loads(raw_opps)
                logger.info(f"[WhatsApp Digest] {len(opportunities)} opportunities loaded")

                # 4. Send per-subscriber digest
                sent_count = 0
                for sub in subscribers:
                    sub_id, user_id, phone, name = sub
                    display_name = name or "Investor"
                    logger.info(f"[WhatsApp Digest] Generating for {phone} (user_id={user_id})")

                    try:
                        # Fetch this user's portfolios with enriched scores/prices
                        portfolios = []
                        if user_id:
                            port_res = await conn.execute(_text("""
                                SELECT name, risk_label, holdings, total_risk_score
                                FROM user_portfolios WHERE user_id = :uid
                                ORDER BY updated_at DESC LIMIT 3
                            """), {"uid": str(user_id)})
                            port_rows = port_res.fetchall()
                            all_syms = set()
                            for row in port_rows:
                                hs = row[2] if isinstance(row[2], list) else json.loads(row[2] or "[]")
                                for h in hs:
                                    if h.get("symbol"):
                                        all_syms.add(h["symbol"])
                                portfolios.append({
                                    "name": row[0],
                                    "risk_label": row[1],
                                    "holdings": hs,
                                    "total_risk_score": row[3],
                                })
                            # Enrich with current AI scores and prices
                            scores_map = {}
                            prices_map = {}
                            if all_syms:
                                sym_list = list(all_syms)
                                sr = await conn.execute(_text("""
                                    SELECT DISTINCT ON (symbol) symbol,
                                           COALESCE(NULLIF(REGEXP_REPLACE(split_part(analysis_data->'analysis'->>'ai_score', '/', 1), '[^0-9.]', '', 'g'), '')::numeric, 0) as score
                                    FROM stock_analyses WHERE symbol = ANY(:s) AND status = 'complete'
                                    ORDER BY symbol, updated_at DESC
                                """), {"s": sym_list})
                                for r in sr.fetchall():
                                    scores_map[r[0]] = float(r[1])
                                pr = await conn.execute(_text("""
                                    SELECT symbol, COALESCE(CAST(data->>'price' AS NUMERIC), 0) as price
                                    FROM screener_cache WHERE symbol = ANY(:s)
                                """), {"s": sym_list})
                                for r in pr.fetchall():
                                    if r[1] and float(r[1]) > 0:
                                        prices_map[r[0]] = float(r[1])
                            for p in portfolios:
                                for h in p["holdings"]:
                                    sym = h.get("symbol")
                                    if sym in scores_map:
                                        h["currentAiScore"] = scores_map[sym]
                                    if sym in prices_map:
                                        h["currentPrice"] = prices_map[sym]

                        message = build_daily_digest(
                            user_name=display_name,
                            portfolios=portfolios,
                            movers_data=movers_data,
                            opportunities=opportunities,
                        )
                        
                        logger.debug(f"[WhatsApp Digest] Sending message ({len(message)} chars)")
                        ok = send_whatsapp_message(phone, message)
                        if ok:
                            sent_count += 1
                        else:
                            logger.error(f"[WhatsApp Digest] Twilio failed to send to {phone}")
                    except Exception as sub_err:
                        logger.error(f"[WhatsApp Digest] Individual error for {phone}: {sub_err}", exc_info=True)

                logger.info(f"[WhatsApp Digest] Sent to {sent_count}/{len(subscribers)} subscribers")

            return

        # ---- Blog Generation (Grounded) ----

        if body.get('action') == 'GENERATE_BLOG':
            logger.info("Processing GENERATE_BLOG action")
            topic = body.get('topic', 'latest financial trends')
            count = body.get('count', 1)
            import json as _json
            from services.vertex import analyze_with_vertex
            from datetime import datetime as _dt
            from sqlalchemy import text as _text

            prompt = f"""Generate {count} blog post(s) about: {topic}.
Use Google Search to find real, current data points.
Return JSON structure:
{{
  "blogs": [
    {{
      "slug": "url-friendly-slug",
      "title": "Rich Title",
      "excerpt": "Brief summary",
      "content": "Full markdown content with sections",
      "tags": ["tag1", "tag2"],
      "metaDescription": "SEO desc",
      "readTime": 5,
      "sources": [{{"uri": "...", "title": "..."}}]
    }}
  ]
}}"""
            ai_res = await analyze_with_vertex("blog", prompt)
            if isinstance(ai_res, str):
                ai_res = _json.loads(ai_res)
            blogs = ai_res.get("blogs", [])
            logger.info(f"Blog generation completed: {len(blogs)} blog(s)")

            # Auto-save to DB if requested
            if body.get('auto_save') and blogs:
                async with engine.connect() as conn:
                    for blog in blogs:
                        slug = blog.get("slug")
                        if not slug:
                            continue
                        check = await conn.execute(_text("SELECT id FROM published_blogs WHERE slug = :slug"), {"slug": slug})
                        if check.fetchone():
                            logger.info(f"Blog '{slug}' already exists, skipping.")
                            continue
                        await conn.execute(_text("""
                            INSERT INTO published_blogs (slug, title, excerpt, content, author, read_time, tags, meta_description, sources, image_url)
                            VALUES (:slug, :title, :excerpt, :content, :author, :read_time, :tags, :meta_description, :sources, :image_url)
                        """), {
                            "slug": slug,
                            "title": blog.get("title"),
                            "excerpt": blog.get("excerpt"),
                            "content": blog.get("content"),
                            "author": "ClaritX Research Team",
                            "read_time": blog.get("readTime", 5),
                            "tags": blog.get("tags", []),
                            "meta_description": blog.get("metaDescription", ""),
                            "sources": _json.dumps(blog.get("sources", [])),
                            "image_url": blog.get("image_url") or ""
                        })
                    await conn.commit()
                    logger.info(f"Saved {len(blogs)} blog(s) to DB")
            return

        # ---- Blog Generation (Grounded) ----
        if body.get('action') == 'GENERATE_BLOG_GROUNDED':
            job_id = body.get('job_id')
            if not job_id:
                logger.error("GENERATE_BLOG_GROUNDED missing job_id")
                return
            logger.info(f"Processing GENERATE_BLOG_GROUNDED for job {job_id}")
            from routers.blog import blog_grounded_worker_task
            await blog_grounded_worker_task(job_id)
            logger.info(f"Grounded blog generation for {job_id} completed")
            return

        # ---- Daily Blog Research ----
        if body.get('action') == 'DAILY_BLOG_RESEARCH':
            logger.info("Processing DAILY_BLOG_RESEARCH action")
            from routers.blog import run_daily_blog_research
            await run_daily_blog_research()
            logger.info("Daily blog research completed")
            return

        # ---- Deep Search Execute ----
        if body.get('action') == 'DEEP_SEARCH_EXECUTE':
            job_id = body.get('job_id')
            if not job_id:
                logger.error("DEEP_SEARCH_EXECUTE missing job_id")
                return
            logger.info(f"Processing DEEP_SEARCH_EXECUTE for job {job_id}")
            from routers.deep_search import deep_search_worker_task
            await deep_search_worker_task(job_id)
            logger.info(f"Deep search job {job_id} completed")
            return

        # ---- Deep Search Plan ----
        if body.get('action') == 'DEEP_SEARCH_PLAN':
            job_id = body.get('job_id')
            if not job_id:
                logger.error("DEEP_SEARCH_PLAN missing job_id")
                return
            logger.info(f"Processing DEEP_SEARCH_PLAN for job {job_id}")
            from routers.deep_search import deep_search_plan_worker_task
            await deep_search_plan_worker_task(job_id)
            logger.info(f"Deep search plan generation for {job_id} completed")
            return

        # ---- SEO Re-index (daily batch ping for recently updated pages) ----
        if body.get('action') == 'SEO_REINDEX':
            logger.info("Processing SEO_REINDEX action")
            from sqlalchemy import text as _text
            from utils.seo_ping import notify_search_engines_batch

            SITE = "https://www.claritx.ai"
            all_urls = []

            async with engine.connect() as conn:
                # Stock pages updated in the last 48 hours
                rows = await conn.execute(_text("""
                    SELECT DISTINCT ON (symbol) symbol
                    FROM stock_analyses
                    WHERE status = 'complete' AND completed_at > NOW() - INTERVAL '48 hours'
                    ORDER BY symbol, completed_at DESC
                """))
                for row in rows.fetchall():
                    all_urls.append(f"{SITE}/stocks/{row[0]}")

                # Blog posts published in the last 48 hours
                rows = await conn.execute(_text("""
                    SELECT slug FROM published_blogs
                    WHERE published_at > NOW() - INTERVAL '48 hours'
                """))
                for row in rows.fetchall():
                    all_urls.append(f"{SITE}/blog/{row[0]}")

            if all_urls:
                await notify_search_engines_batch(all_urls)
                logger.info(f"SEO re-index complete: pinged {len(all_urls)} recently updated URLs")
            else:
                logger.info("SEO re-index: no recently updated pages to ping")
            return

        # ---- Chat Section Execute ----
        if body.get('action') == 'CHAT_SECTION':
            job_id = body.get('job_id')
            payload = body.get('payload')
            if not job_id or not payload:
                logger.error("CHAT_SECTION missing job_id or payload")
                return
            logger.info(f"Processing CHAT_SECTION for job {job_id}")
            from routers.chat import chat_section_worker_task
            await chat_section_worker_task(job_id, payload)
            logger.info(f"Chat section job {job_id} completed")
            return

        # Google Batch Prompt Gathering Action
        if body.get('action') == 'GATHER_GOOGLE_BATCH_DATA':
            candidate = body.get('candidate')
            batch_id = body.get('batch_id')
            target_limit = body.get('target_limit')
            logger.info(f"Gathering LOCAL GOOGLE BATCH DATA for {candidate.get('symbol') if candidate else 'Unknown'} (Batch: {batch_id})")
            
            if not candidate or not batch_id or not target_limit:
                 logger.error("Missing candidate, batch_id, or target_limit for GATHER_GOOGLE_BATCH_DATA")
                 return
                 
            from services.batch import gather_single_google_batch_candidate

            try:
                result = await gather_single_google_batch_candidate(candidate, batch_id, target_limit)
                logger.info(f"Google Batch Candidate Gathering Completed for {candidate.get('symbol')}: {result}")
            except Exception as e:
                logger.error(f"Failed to gather google batch candidate {candidate.get('symbol')}: {e}")
                raise e
            return

        # Standard Analysis Flow
        analysis_id = body.get('analysis_id')
        symbol = body.get('symbol')

        logger.info(f"Processing analysis {analysis_id} for {symbol}")

        try:
            # Update status to processing (short-lived connection)
            async with engine.connect() as conn:
                await update_analysis_status(analysis_id, 'processing', conn)
            logger.info("Status updated to processing.")

            # Run analysis (manages its own DB connections internally)
            logger.info(f"Starting stock_analysis_internal for {symbol}...")
            result = await stock_analysis_internal(symbol, "sqs_worker")
            logger.info("Analysis internal function completed.")

            # Save results (short-lived connection)
            async with engine.connect() as conn:
                await save_analysis_results(analysis_id, result, conn)
            logger.info(f"Analysis {analysis_id} completed and saved successfully")

        except Exception as e:
            logger.error(f"Analysis operation failed for {analysis_id}: {e}", exc_info=True)
            try:
                async with engine.connect() as conn:
                    await save_analysis_error(analysis_id, str(e), conn)
                logger.info("Error saved to DB.")
            except Exception as db_err:
                 logger.error(f"Failed to save error status to DB: {db_err}")
            raise e

    except Exception as e:
        logger.error(f"Error processing record: {e}", exc_info=True)
        raise e

def handler(event, context):
    """SQS Lambda Handler"""
    print(f"Worker received event: {json.dumps(event)}")
    loop = asyncio.get_event_loop()
    
    # Process SQS Records
    if 'Records' in event:
        for record in event['Records']:
            loop.run_until_complete(process_record(record))
    
    # Process Scheduled Events
    elif event.get('detail-type') == 'Scheduled Event' or event.get('action'):
        rule = event.get('resources', [''])[0]
        logger.info(f"Detected Scheduled Event from rule: {rule}")

        # If the EventBridge Input field set a specific action, run only that
        direct_action = event.get('action')
        if direct_action:
            loop.run_until_complete(process_record({'body': json.dumps({'action': direct_action})}))
        else:
            # Default daily schedule: blog research + WhatsApp digest + SEO re-index
            fake_blog = {'body': json.dumps({'action': 'DAILY_BLOG_RESEARCH'})}
            loop.run_until_complete(process_record(fake_blog))

            fake_wa = {'body': json.dumps({'action': 'WHATSAPP_DAILY_DIGEST'})}
            loop.run_until_complete(process_record(fake_wa))

            fake_seo = {'body': json.dumps({'action': 'SEO_REINDEX'})}
            loop.run_until_complete(process_record(fake_seo))

    return {"statusCode": 200, "body": "Success"}

