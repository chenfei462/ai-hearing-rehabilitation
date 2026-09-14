"""
性能监控指标收集器

指标类型：
- Counter: 递增计数器（请求数、错误数）
- Histogram: 直方图（响应时间分布）
- Gauge: 仪表盘（当前并发数、连接池使用率）
"""
import time
import asyncio
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from datetime import datetime, timedelta, timezone


@dataclass
class MetricPoint:
    """单个指标数据点"""
    timestamp: float
    value: float
    labels: Dict[str, str] = field(default_factory=dict)


class MetricsCollector:
    """指标收集器（单例模式）"""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True

        # 计数器
        self._counters: Dict[str, float] = defaultdict(float)

        # 直方图（存储最近 N 个数据点）
        self._histograms: Dict[str, List[float]] = defaultdict(list)
        self._histogram_max_size = 1000

        # 仪表盘
        self._gauges: Dict[str, float] = defaultdict(float)

        # 错误日志
        self._errors: List[dict] = []
        self._max_errors = 100

        # AI 服务延迟追踪
        self._ai_latencies: Dict[str, List[float]] = defaultdict(list)

    # ─── 计数器操作 ───

    def increment(self, name: str, value: float = 1, labels: Dict[str, str] = None):
        """递增计数器"""
        key = self._make_key(name, labels)
        self._counters[key] += value

    def get_counter(self, name: str, labels: Dict[str, str] = None) -> float:
        """获取计数器值"""
        key = self._make_key(name, labels)
        return self._counters.get(key, 0)

    # ─── 直方图操作 ───

    def observe(self, name: str, value: float, labels: Dict[str, str] = None):
        """记录直方图数据点"""
        key = self._make_key(name, labels)
        histogram = self._histograms[key]
        histogram.append(value)
        # 保持大小限制
        if len(histogram) > self._histogram_max_size:
            self._histograms[key] = histogram[-self._histogram_max_size:]

    def get_histogram_stats(self, name: str, labels: Dict[str, str] = None) -> dict:
        """获取直方图统计信息"""
        key = self._make_key(name, labels)
        values = self._histograms.get(key, [])
        if not values:
            return {"count": 0, "avg": 0, "p50": 0, "p95": 0, "p99": 0, "max": 0}

        sorted_values = sorted(values)
        count = len(sorted_values)
        return {
            "count": count,
            "avg": sum(sorted_values) / count,
            "p50": sorted_values[int(count * 0.5)],
            "p95": sorted_values[int(count * 0.95)] if count >= 20 else sorted_values[-1],
            "p99": sorted_values[int(count * 0.99)] if count >= 100 else sorted_values[-1],
            "max": sorted_values[-1],
        }

    # ─── 仪表盘操作 ───

    def set_gauge(self, name: str, value: float, labels: Dict[str, str] = None):
        """设置仪表盘值"""
        key = self._make_key(name, labels)
        self._gauges[key] = value

    def get_gauge(self, name: str, labels: Dict[str, str] = None) -> float:
        """获取仪表盘值"""
        key = self._make_key(name, labels)
        return self._gauges.get(key, 0)

    # ─── AI 服务延迟追踪 ───

    def record_ai_latency(self, service: str, latency_ms: float):
        """记录 AI 服务延迟"""
        self._ai_latencies[service].append(latency_ms)
        # 保持最近 1000 个
        if len(self._ai_latencies[service]) > 1000:
            self._ai_latencies[service] = self._ai_latencies[service][-1000:]

        # 同时记录到直方图
        self.observe(f"ai_latency_{service}", latency_ms)

    def get_ai_latency_stats(self) -> dict:
        """获取所有 AI 服务延迟统计"""
        stats = {}
        for service, latencies in self._ai_latencies.items():
            if latencies:
                sorted_l = sorted(latencies)
                count = len(sorted_l)
                stats[service] = {
                    "count": count,
                    "avg_ms": sum(sorted_l) / count,
                    "p50_ms": sorted_l[int(count * 0.5)],
                    "p95_ms": sorted_l[int(count * 0.95)] if count >= 20 else sorted_l[-1],
                    "max_ms": sorted_l[-1],
                }
        return stats

    # ─── 错误追踪 ───

    def record_error(self, error_type: str, message: str, details: dict = None):
        """记录错误"""
        error = {
            "type": error_type,
            "message": message,
            "details": details,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self._errors.append(error)
        if len(self._errors) > self._max_errors:
            self._errors = self._errors[-self._max_errors:]

        # 递增错误计数
        self.increment(f"error_{error_type}")

    def get_recent_errors(self, limit: int = 20) -> List[dict]:
        """获取最近的错误"""
        return self._errors[-limit:]

    # ─── 汇总报告 ───

    def get_summary(self) -> dict:
        """获取监控指标汇总"""
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "requests": {
                "total": self.get_counter("http_requests"),
                "errors": self.get_counter("http_errors"),
                "success_rate": self._calculate_success_rate(),
            },
            "latency": {
                "http": self.get_histogram_stats("http_request_duration_ms"),
                "asr": self.get_histogram_stats("ai_latency_asr"),
                "tts": self.get_histogram_stats("ai_latency_tts"),
                "llm": self.get_histogram_stats("ai_latency_llm"),
            },
            "ai_services": self.get_ai_latency_stats(),
            "active_sessions": {
                "training": self.get_gauge("active_training_sessions"),
                "dialogue": self.get_gauge("active_dialogue_sessions"),
            },
            "recent_errors": self.get_recent_errors(5),
        }

    def _calculate_success_rate(self) -> float:
        """计算成功率"""
        total = self.get_counter("http_requests")
        errors = self.get_counter("http_errors")
        if total == 0:
            return 1.0
        return (total - errors) / total

    def _make_key(self, name: str, labels: Dict[str, str] = None) -> str:
        """生成指标 key"""
        if not labels:
            return name
        label_str = ",".join(f"{k}={v}" for k, v in sorted(labels.items()))
        return f"{name}{{{label_str}}}"

    def reset(self):
        """重置所有指标（用于测试）"""
        self._counters.clear()
        self._histograms.clear()
        self._gauges.clear()
        self._errors.clear()
        self._ai_latencies.clear()


# 全局单例
metrics_collector = MetricsCollector()


def get_metrics() -> dict:
    """获取当前指标快照"""
    return metrics_collector.get_summary()
