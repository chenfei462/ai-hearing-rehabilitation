"""
性能测试 — pytest 集成版本

验证各 API 端点的响应延迟是否满足指标要求。
每个测试用例独立运行，可在 CI 中自动执行。
"""
import time
import statistics
import pytest
from httpx import AsyncClient


# ── 性能指标阈值（毫秒） ────────────────────────────────
THRESHOLDS = {
    "health": 50,             # 健康检查 < 50ms
    "root": 50,               # 根路径 < 50ms
    "auth_login": 500,        # 登录 < 500ms
    "training_start": 500,    # 开始训练 < 500ms
    "dialogue_scenarios": 200,  # 场景列表 < 200ms
    "report_summary": 500,    # 报告汇总 < 500ms
    "metrics": 100,           # 指标查询 < 100ms
}

# 每个端点的采样次数
SAMPLE_COUNT = 3


def _median_ms(times: list[float]) -> float:
    """计算中位数延迟"""
    return round(statistics.median(times), 2)


def _assert_within_threshold(median_ms: float, threshold_ms: float, endpoint: str):
    """断言中位数延迟在阈值以内"""
    assert median_ms < threshold_ms, (
        f"[性能] {endpoint} 中位数延迟 {median_ms}ms 超过阈值 {threshold_ms}ms"
    )


async def _measure(client: AsyncClient, method: str, url: str, **kwargs) -> float:
    """测量单次请求耗时，返回毫秒"""
    start = time.perf_counter()
    if method == "GET":
        await client.get(url, **kwargs)
    else:
        await client.post(url, **kwargs)
    return (time.perf_counter() - start) * 1000


# ── 性能测试用例 ────────────────────────────────────────

@pytest.mark.asyncio
async def test_health_performance(client: AsyncClient):
    """健康检查接口延迟 < 50ms"""
    times = []
    for _ in range(SAMPLE_COUNT):
        ms = await _measure(client, "GET", "/health")
        times.append(ms)
    median = _median_ms(times)
    _assert_within_threshold(median, THRESHOLDS["health"], "health")


@pytest.mark.asyncio
async def test_root_performance(client: AsyncClient):
    """根路径接口延迟 < 50ms"""
    times = []
    for _ in range(SAMPLE_COUNT):
        ms = await _measure(client, "GET", "/")
        times.append(ms)
    median = _median_ms(times)
    _assert_within_threshold(median, THRESHOLDS["root"], "root")


@pytest.mark.asyncio
async def test_auth_login_performance(client: AsyncClient):
    """登录接口延迟 < 500ms"""
    times = []
    for _ in range(SAMPLE_COUNT):
        ms = await _measure(
            client, "POST", "/api/auth/login",
            json={"phone": "13800138000", "code": "1234"},
        )
        times.append(ms)
    median = _median_ms(times)
    _assert_within_threshold(median, THRESHOLDS["auth_login"], "auth_login")


@pytest.mark.asyncio
async def test_training_start_performance(client: AsyncClient, auth_token: str):
    """开始训练接口延迟 < 500ms"""
    headers = {"Authorization": f"Bearer {auth_token}"}
    times = []
    for _ in range(SAMPLE_COUNT):
        ms = await _measure(
            client, "POST", "/api/training/sessions?level=syllable",
            headers=headers,
        )
        times.append(ms)
    median = _median_ms(times)
    _assert_within_threshold(median, THRESHOLDS["training_start"], "training_start")


@pytest.mark.asyncio
async def test_dialogue_scenarios_performance(client: AsyncClient):
    """对话场景列表延迟 < 200ms"""
    times = []
    for _ in range(SAMPLE_COUNT):
        ms = await _measure(client, "GET", "/api/dialogue/scenarios")
        times.append(ms)
    median = _median_ms(times)
    _assert_within_threshold(median, THRESHOLDS["dialogue_scenarios"], "dialogue_scenarios")


@pytest.mark.asyncio
async def test_report_summary_performance(client: AsyncClient, auth_token: str):
    """报告汇总接口延迟 < 500ms"""
    headers = {"Authorization": f"Bearer {auth_token}"}
    times = []
    for _ in range(SAMPLE_COUNT):
        ms = await _measure(
            client, "GET", "/api/report/summary?days=30",
            headers=headers,
        )
        times.append(ms)
    median = _median_ms(times)
    _assert_within_threshold(median, THRESHOLDS["report_summary"], "report_summary")


@pytest.mark.asyncio
async def test_metrics_performance(client: AsyncClient):
    """监控指标接口延迟 < 100ms"""
    times = []
    for _ in range(SAMPLE_COUNT):
        ms = await _measure(client, "GET", "/api/metrics")
        times.append(ms)
    median = _median_ms(times)
    _assert_within_threshold(median, THRESHOLDS["metrics"], "metrics")
