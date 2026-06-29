import os
import json
import asyncio
import httpx
from typing import List, Dict, Any, Tuple
from utils.network import async_retry
from .vertex import analyze_with_vertex

# Kie.ai Configuration
KIE_API_URL = "https://api.kie.ai/gemini-3-pro/v1/chat/completions"
KIE_MODEL = "gemini-3-pro-preview"

@async_retry(retries=3, delay=2.0, backoff=2.0, exceptions=(Exception,))
async def analyze_with_kie(symbol: str, prompt: str) -> Dict[str, Any]:
    """
    Sends a single analysis request to Kie.ai.
    """
    api_key = os.environ.get("KIE_AI")
    if not api_key:
        return {"error": "Missing KIE_AI API Key"}

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    payload = {
        "messages": [
            {
                "role": "user", 
                "content": [
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }
        ],
        # Enhanced Reasoning & Tools
        "include_thoughts": True,
        "reasoning_effort": "high",
        "tools": [
            {
                "type": "function",
                "function": {
                    "name": "googleSearch"
                }
            }
        ]
    }

    # Log payload for debugging (FULL)
    print(f"Kie.ai Payload for {symbol}: {json.dumps(payload, default=str)}")

    payload["stream"] = True

    # Helper for Streaming Request
    async def _stream_request(client_params):
        async with httpx.AsyncClient() as client:
            async with client.stream("POST", KIE_API_URL, headers=headers, json=payload, timeout=180.0) as response:
                if response.status_code == 200:
                    collected_content = []
                    async for line in response.aiter_lines():
                        if line.startswith("data: "):
                            data_str = line[6:]
                            if data_str == "[DONE]": break
                            try:
                                data_chunk = json.loads(data_str)
                                choices = data_chunk.get("choices", [])
                                if choices:
                                    delta = choices[0].get("delta", {})
                                    content_chunk = delta.get("content", "")
                                    if content_chunk:
                                        collected_content.append(content_chunk)
                            except:
                                pass
                    return "".join(collected_content)
                elif response.status_code == 524 or response.status_code == 504:
                     raise httpx.ReadTimeout("Server Timeout (Streaming)")
                elif response.status_code == 429:
                     raise Exception("Kie.ai Rate Limit (429)")
                else:
                     error_body = ""
                     try:
                         error_bytes = await response.read()
                         error_body = error_bytes.decode('utf-8')
                     except:
                         pass
                     
                     print(f"Kie.ai API Error {response.status_code} for {symbol}: {error_body}")
                     raise Exception(f"API Error {response.status_code}: {error_body}")

    # High Reasoning (Streaming) Only - No Downgrade
    try:
        print(f"[{symbol}] Starting High Reasoning Analysis (Streaming, Timeout 180s)")
        full_content = await _stream_request(payload)
        
    except (httpx.ReadTimeout, httpx.ConnectTimeout, Exception) as e:
        print(f"[{symbol}] Analysis Failed: {str(e)}")
        # Return error to be handled by batch processor (skipped/saved as failed)
        return {"error": f"Analysis Failed: {str(e)}"}

    # Process Final Content
    if "```json" in full_content:
        full_content = full_content.replace("```json", "").replace("```", "")
    
    try:
        return json.loads(full_content)
    except json.JSONDecodeError:
        return {"error": "Failed to parse JSON response", "raw_content": full_content}

async def run_kie_batch(input_data: List[Tuple[str, str]], concurrency: int = 15, timeout_seconds: int = 840) -> List[Tuple[str, Dict[str, Any]]]:
    """
    Runs a batch of analysis requests in parallel.
    input_data: List of (symbol, prompt) tuples.
    concurrency: Max parallel requests. Try 15 to process batches faster.
    timeout_seconds: Safety timeout to prevent overarching Lambda from hitting its 900s limit.
    """
    sem = asyncio.Semaphore(concurrency)
    active_requests = 0

    async def worker(symbol, prompt):
        nonlocal active_requests
        async with sem:
            active_requests += 1
            print(f"Starting Kie analysis for {symbol}... (Active: {active_requests}/{concurrency})")
            try:
                result = await analyze_with_vertex(symbol, prompt)
            except Exception as e:
                result = {"error": f"Worker Exception: {e}"}
            finally:
                active_requests -= 1
                print(f"Finished Kie analysis for {symbol}. (Active: {active_requests}/{concurrency})")
            return symbol, result

    tasks = [asyncio.create_task(worker(symbol, prompt)) for symbol, prompt in input_data]
    
    try:
        # Wrap the entire batch in a timeout (default 14 minutes).
        # This guarantees it exits before Lambda forcefully kills it at 15m, avoiding SQS retries.
        results_tuple = await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=timeout_seconds)
        
        # Format results resolving any unexpected thread exceptions
        formatted_results = []
        for i, res in enumerate(results_tuple):
            if isinstance(res, Exception):
                symbol = input_data[i][0]
                formatted_results.append((symbol, {"error": f"Gather Exception: {res}"}))
            else:
                formatted_results.append(res)
        return formatted_results

    except asyncio.TimeoutError:
        print(f"Kie Batch hit {timeout_seconds}s timeout! Gracefully returning completed tasks to prevent SQS retry.")
        
        # Attempt to harvest whatever finished, cancel the rest.
        harvested_results = []
        for i, task in enumerate(tasks):
            symbol = input_data[i][0]
            if task.done():
                try:
                    harvested_results.append(task.result())
                except Exception as e:
                    harvested_results.append((symbol, {"error": f"Task Failed: {e}"}))
            else:
                task.cancel()
                harvested_results.append((symbol, {"error": "Timeout Reached: Analysis aborted before starting/finishing to save Lambda."}))
                
        return harvested_results
