"""
监控中间件 - 自动收集 HTTP 请求指标
"""
import time
import asyncio
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.monitoring.metrics import metrics_collector


class MonitoringMiddleware(BaseHTTPMiddleware):
    """自动收集 HTTP 请求指标"""

    def __init__(self, app):
        super().__init__(app)
        self._lock = asyncio.Lock()

    async def dispatch(self, request: Request, call_next) -> Response:
        # 跳过健康检查和指标端点
        path = request.url.path
        if path in ("/api/health", "/api/health/detailed", "/api/metrics"):
            return await call_next(request)

        # 记录请求开始
        start_time = time.perf_counter()
        metrics_collector.increment("http_requests")

        # 记录当前活跃请求数
        async with self._lock:
            active = metrics_collector.get_gauge("active_requests")
            metrics_collector.set_gauge("active_requests", active + 1)

        try:
            response = await call_next(request)

            # 记录响应时间
            duration_ms = (time.perf_counter() - start_time) * 1000
            metrics_collector.observe("http_request_duration_ms", duration_ms)

            # 按状态码分类
            status = response.status_code
            if status >= 400:
                metrics_collector.increment("http_errors")
                metrics_collector.increment(f"http_errors_{status // 100}xx")

            # 按路径分类
            method = request.method
            path_label = self._normalize_path(path)
            metrics_collector.observe(
                "http_request_duration_ms",
                duration_ms,
                labels={"method": method, "path": path_label, "status": str(status)},
            )

            return response

        except Exception as e:
            metrics_collector.increment("http_errors")
            metrics_collector.record_error(
                "unhandled",
                str(e),
                {"path": path, "method": request.method},
            )
            raise

        finally:
            async with self._lock:
                active = metrics_collector.get_gauge("active_requests")
                metrics_collector.set_gauge("active_requests", max(0, active - 1))

    def _normalize_path(self, path: str) -> str:
        """规范化路径（将 ID 参数替换为占位符）"""
        parts = path.split("/")
        normalized = []
        for part in parts:
            # 数字 ID 替换为 :id
            if part.isdigit():
                normalized.append(":id")
            else:
                normalized.append(part)
        return "/".join(normalized)
