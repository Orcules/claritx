import asyncio
import time
import functools
import random
import logging
from typing import Callable, Type, Tuple, Optional

logger = logging.getLogger(__name__)

class RateLimiter:
    """
    Token Bucket Rate Limiter for asyncio.
    """
    def __init__(self, calls: int, period: float = 60.0):
        self.capacity = calls
        self.tokens = calls
        self.period = period
        self.fill_rate = calls / period
        self.last_update = time.monotonic()
        self.lock = asyncio.Lock()

    async def acquire(self):
        async with self.lock:
            while True:
                now = time.monotonic()
                time_passed = now - self.last_update
                self.tokens = min(self.capacity, self.tokens + time_passed * self.fill_rate)
                self.last_update = now

                if self.tokens >= 1:
                    self.tokens -= 1
                    return
                else:
                    # Wait for enough tokens to accumulate
                    wait_time = (1 - self.tokens) / self.fill_rate
                    await asyncio.sleep(wait_time)

def async_retry(
    retries: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,)
):
    """
    Decorator to retry async functions with exponential backoff.
    """
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            current_delay = delay
            for attempt in range(retries + 1):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    if attempt == retries:
                        logger.error(f"Retry failed after {retries} attempts. Error: {e}")
                        raise e
                    
                    # Add jitter to avoid thundering herd
                    sleep_time = current_delay * (0.5 + random.random())
                    logger.warning(f"Retrying {func.__name__} (Attempt {attempt + 1}/{retries}) in {sleep_time:.2f}s due to: {e}")
                    await asyncio.sleep(sleep_time)
                    current_delay *= backoff
        return wrapper
    return decorator
