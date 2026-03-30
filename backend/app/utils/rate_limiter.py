import asyncio
import time
from datetime import datetime, timezone


class TokenBucket:
    def __init__(self, capacity: int, refill_rate: float):
        self._capacity = capacity
        self._tokens = float(capacity)
        self._refill_rate = refill_rate  # tokens per second
        self._last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self) -> bool:
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_refill
            self._tokens = min(
                self._capacity, self._tokens + elapsed * self._refill_rate
            )
            self._last_refill = now

            if self._tokens >= 1:
                self._tokens -= 1
                return True
            return False


class RateLimiter:
    def __init__(self, rpm_limit: int = 10, daily_limit: int = 250):
        # Per-minute bucket: refills at rpm_limit tokens per 60 seconds
        self._rpm_bucket = TokenBucket(
            capacity=rpm_limit, refill_rate=rpm_limit / 60.0
        )
        # Daily counter
        self._daily_limit = daily_limit
        self._daily_count = 0
        self._daily_reset_date = datetime.now(timezone.utc).date()
        self._lock = asyncio.Lock()

    async def acquire(self) -> bool:
        async with self._lock:
            # Reset daily counter if new day
            today = datetime.now(timezone.utc).date()
            if today != self._daily_reset_date:
                self._daily_count = 0
                self._daily_reset_date = today

            if self._daily_count >= self._daily_limit:
                return False

        # Check RPM
        if not await self._rpm_bucket.acquire():
            # Wait briefly and retry once
            await asyncio.sleep(1)
            if not await self._rpm_bucket.acquire():
                return False

        async with self._lock:
            self._daily_count += 1

        return True

    @property
    def remaining_daily(self) -> int:
        today = datetime.now(timezone.utc).date()
        if today != self._daily_reset_date:
            return self._daily_limit
        return max(0, self._daily_limit - self._daily_count)
