import os
import time
import logging
from collections import defaultdict, deque
from threading import Lock
from typing import Dict, Deque, Tuple
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger("GeoMiner.RateLimiter")


class IPRateLimiter:
    """
    Thread-safe in-memory sliding window rate limiter by client IP.
    Protects Google Earth Engine backend compute quota against excessive or abusive requests.
    """

    def __init__(
        self,
        heavy_limit: int = 20,      # Max heavy targeting requests per minute (EE intensive)
        general_limit: int = 60,    # Max general read/metadata requests per minute
        window_seconds: int = 60
    ):
        self.heavy_limit = heavy_limit
        self.general_limit = general_limit
        self.window_seconds = window_seconds
        self._heavy_records: Dict[str, Deque[float]] = defaultdict(deque)
        self._general_records: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = Lock()
        self._last_cleanup = time.time()

    def _cleanup_stale(self, now: float):
        """Periodically prune stale IPs from memory to prevent memory leaks."""
        if now - self._last_cleanup < 300:
            return
        self._last_cleanup = now
        cutoff = now - self.window_seconds
        for records in (self._heavy_records, self._general_records):
            stale_ips = []
            for ip, timestamps in records.items():
                while timestamps and timestamps[0] < cutoff:
                    timestamps.popleft()
                if not timestamps:
                    stale_ips.append(ip)
            for ip in stale_ips:
                del records[ip]

    def get_client_ip(self, request: Request) -> str:
        """Extracts client IP from proxy headers (Cloudflare, Vercel, Railway, Render) or client host."""
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # First IP in comma-separated list is the original client
            client_ip = forwarded_for.split(",")[0].strip()
            if client_ip:
                return client_ip

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()

        if request.client and request.client.host:
            return request.client.host

        return "127.0.0.1"

    def check_rate_limit(self, ip: str, is_heavy: bool) -> Tuple[bool, int, int]:
        """
        Evaluates whether the client IP is within rate limits.
        Returns:
            is_allowed: bool
            remaining: int (remaining requests allowed in current window)
            retry_after: int (seconds to wait if blocked)
        """
        now = time.time()
        limit = self.heavy_limit if is_heavy else self.general_limit
        cutoff = now - self.window_seconds

        with self._lock:
            self._cleanup_stale(now)
            records = self._heavy_records if is_heavy else self._general_records
            timestamps = records[ip]

            # Evict timestamps outside sliding window
            while timestamps and timestamps[0] < cutoff:
                timestamps.popleft()

            if len(timestamps) >= limit:
                oldest = timestamps[0]
                retry_after = max(1, int(cutoff - oldest + self.window_seconds))
                return False, 0, retry_after

            timestamps.append(now)
            remaining = max(0, limit - len(timestamps))
            return True, remaining, 0

    def reset(self):
        """Reset all rate limiter records (primarily for testing)."""
        with self._lock:
            self._heavy_records.clear()
            self._general_records.clear()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    FastAPI / Starlette middleware enforcing client IP rate limiting.
    Differentiates heavy Earth Engine compute routes from lighter metadata routes.
    """

    def __init__(self, app, limiter: IPRateLimiter, enabled: bool = True):
        super().__init__(app)
        self.limiter = limiter
        self.enabled = enabled

    async def dispatch(self, request: Request, call_next):
        if not self.enabled or request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path

        # Whitelist health checks and API documentation
        if path in ("/", "/health", "//health", "/api/health", "/docs", "/openapi.json", "/redoc"):
            return await call_next(request)

        # Distinguish heavy Earth Engine computation endpoints
        is_heavy = (
            path.startswith("/api/prospectivity") or
            path.startswith("/api/spectral-indices") or
            path.startswith("/api/structural-layers")
        )

        client_ip = self.limiter.get_client_ip(request)
        allowed, remaining, retry_after = self.limiter.check_rate_limit(client_ip, is_heavy=is_heavy)

        if not allowed:
            logger.warning(f"Rate limit exceeded for IP {client_ip} on {path} (retry after {retry_after}s)")
            limit_desc = "Earth Engine exploration targeting" if is_heavy else "API"
            return JSONResponse(
                status_code=429,
                content={
                    "detail": f"Rate limit reached for {limit_desc}. Please wait {retry_after} seconds before submitting another request.",
                    "retry_after": retry_after
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Remaining": "0"
                }
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
