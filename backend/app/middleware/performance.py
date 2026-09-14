"""
性能中间件：
- 请求计时（X-Process-Time 响应头）
- 响应缓存（Redis 缓存 GET 请求）
- 速率限制（Redis 计数器）
- 弱网优化（GZIP 压缩）
"""
import time
import hashlib
import json
from typing import Callable, Optional
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.gzip import GZipMiddleware

from app.core.redis import redis_client
from app.utils.logger import logger


class RequestTimingMiddleware(BaseHTTPMiddleware):
    """请求计时中间件"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.perf_counter()
        response = await call_next(request)
        process_time = (time.perf_counter() - start_time) * 1000  # 毫秒
        response.headers["X-Process-Time"] = f"{process_time:.2f}ms"

        # 慢请求告警（>3秒）
        if process_time > 3000:
            logger.warning(
                f"慢请求: {request.method} {request.url.path} 耗时 {process_time:.2f}ms"
            )

        return response


class ResponseCacheMiddleware(BaseHTTPMiddleware):
    """GET 请求响应缓存（基于 Redis）"""

    # 可缓存的路径前缀
    CACHEABLE_PATHS = [
        "/api/training/levels",
        "/api/dialogue/scenarios",
        "/api/report/summary",
        "/api/report/levels",
        "/api/health",
    ]

    DEFAULT_TTL = 60  # 默认缓存 60 秒

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # 只缓存 GET 请求
        if request.method != "GET":
            return await call_next(request)

        # 检查路径是否可缓存
        path = request.url.path
        if not any(path.startswith(p) for p in self.CACHEABLE_PATHS):
            return await call_next(request)

        # 生成缓存 key
        cache_key = self._make_cache_key(request)

        try:
            # 尝试从缓存读取
            cached = await redis_client.get(cache_key)
            if cached:
                data = json.loads(cached)
                return JSONResponse(
                    content=data,
                    headers={"X-Cache": "HIT"},
                )
        except Exception as e:
            logger.debug(f"缓存读取失败: {e}")

        # 执行请求
        response = await call_next(request)

        # 缓存成功响应
        if response.status_code == 200:
            try:
                # 读取响应体
                body = b""
                async for chunk in response.body_iterator:
                    if isinstance(chunk, str):
                        body += chunk.encode()
                    else:
                        body += chunk
                data = json.loads(body)

                # 只缓存成功响应
                if data.get("code") == 0:
                    await redis_client.setex(
                        cache_key,
                        self.DEFAULT_TTL,
                        json.dumps(data, ensure_ascii=False),
                    )

                return JSONResponse(
                    content=data,
                    headers={"X-Cache": "MISS"},
                )
            except Exception as e:
                logger.debug(f"缓存写入失败: {e}")

        return response

    def _make_cache_key(self, request: Request) -> str:
        """生成缓存 key"""
        key_parts = [
            request.url.path,
            str(request.query_params),
        ]
        # 包含用户 token（不同用户缓存不同）
        auth = request.headers.get("Authorization", "")
        if auth:
            key_parts.append(auth[:20])

        raw = "|".join(key_parts)
        return f"cache:{hashlib.md5(raw.encode()).hexdigest()}"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """速率限制中间件（基于 Redis 滑动窗口）"""

    # 路径 -> (限制次数, 窗口秒数)
    RATE_LIMITS = {
        "/api/auth/sms/send": (5, 60),      # 短信验证码：5次/分钟
        "/api/dialogue/sessions": (10, 60),  # 对话会话：10次/分钟
        "/api/pronunciation/evaluate": (30, 60),  # 发音评估：30次/分钟
    }

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        limit_config = None

        # 匹配限流规则
        for pattern, config in self.RATE_LIMITS.items():
            if path.startswith(pattern):
                limit_config = config
                break

        if not limit_config:
            return await call_next(request)

        max_requests, window = limit_config

        # 生成限流 key（IP + 路径）
        client_ip = request.client.host if request.client else "unknown"
        rate_key = f"rate:{client_ip}:{path}"

        try:
            current = await redis_client.get(rate_key)
            if current and int(current) >= max_requests:
                return JSONResponse(
                    status_code=429,
                    content={
                        "code": 42901,
                        "data": None,
                        "message": f"请求过于频繁，请 {window} 秒后重试",
                    },
                )

            # 增加计数
            pipe = redis_client.pipeline()
            pipe.incr(rate_key)
            pipe.expire(rate_key, window)
            await pipe.execute()

        except Exception as e:
            logger.debug(f"限流检查失败: {e}")

        return await call_next(request)


def setup_middleware(app):
    """注册所有中间件"""
    from .monitoring import MonitoringMiddleware

    # GZIP 压缩（弱网优化）
    app.add_middleware(GZipMiddleware, minimum_size=1000)

    # 速率限制
    app.add_middleware(RateLimitMiddleware)

    # 响应缓存
    app.add_middleware(ResponseCacheMiddleware)

    # 请求计时
    app.add_middleware(RequestTimingMiddleware)

    # 监控指标收集
    app.add_middleware(MonitoringMiddleware)

    logger.info("性能中间件已注册")
