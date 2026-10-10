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


async def _measure(client: AsyncClient, method: str, url: str, **kwargs) -> dict:
    """测量单次请求耗时，返回 {ms, status, cache} 单样本记录

    cache 只是观测记录（取自 X-Cache 响应头，不可得时为 None），不参与任何判定。
    """
    start = time.perf_counter()
    if method == "GET":
        response = await client.get(url, **kwargs)
    else:
        response = await client.post(url, **kwargs)
    elapsed_ms = (time.perf_counter() - start) * 1000
    return {
        "ms": elapsed_ms,
        "status": response.status_code,
        "cache": response.headers.get("X-Cache"),
    }


def _successful_samples(samples: list[dict], endpoint: str) -> list[dict]:
    """筛出有效成功样本（严格 status == 200）并断言采样完备

    非 200 响应（401/403/429/5xx 等）不得计入延迟统计；只要样本不完备即失败，
    禁止丢弃失败样本后用剩余样本继续 PASS（否则认证失败会因返回得快而假绿）。
    """
    valid_samples = [sample for sample in samples if sample["status"] == 200]
    assert len(valid_samples) == SAMPLE_COUNT, (
        f"[性能] {endpoint} 有效成功样本数不足："
        f"需要 {SAMPLE_COUNT} 个 status==200 的样本，实际仅 {len(valid_samples)} 个，"
        f"各样本 status={[sample['status'] for sample in samples]}"
    )
    return valid_samples


def _valid_median_ms(samples: list[dict], endpoint: str) -> float:
    """对有效成功样本（status == 200）计算中位数延迟"""
    valid_samples = _successful_samples(samples, endpoint)
    return _median_ms([sample["ms"] for sample in valid_samples])


# ── 性能测试用例 ────────────────────────────────────────

@pytest.mark.asyncio
async def test_health_performance(client: AsyncClient):
    """健康检查接口延迟 < 50ms"""
    samples = []
    for _ in range(SAMPLE_COUNT):
        samples.append(await _measure(client, "GET", "/health"))
    median = _valid_median_ms(samples, "health")
    _assert_within_threshold(median, THRESHOLDS["health"], "health")


@pytest.mark.asyncio
async def test_root_performance(client: AsyncClient):
    """根路径接口延迟 < 50ms"""
    samples = []
    for _ in range(SAMPLE_COUNT):
        samples.append(await _measure(client, "GET", "/"))
    median = _valid_median_ms(samples, "root")
    _assert_within_threshold(median, THRESHOLDS["root"], "root")


@pytest.mark.asyncio
async def test_auth_login_performance(client: AsyncClient, test_redis):
    """登录接口延迟 < 500ms"""
    samples = []
    for _ in range(SAMPLE_COUNT):
        await client.post(
            "/api/auth/sms/send",
            json={"phone": "13800138000"},
        )
        samples.append(
            await _measure(
                client, "POST", "/api/auth/login",
                json={
                    "phone": "13800138000",
                    "code": test_redis.data["sms:13800138000"],
                },
            )
        )
    median = _valid_median_ms(samples, "auth_login")
    _assert_within_threshold(median, THRESHOLDS["auth_login"], "auth_login")


@pytest.mark.asyncio
async def test_training_start_performance(client: AsyncClient, auth_token: str):
    """开始训练接口延迟 < 500ms"""
    headers = {"Authorization": f"Bearer {auth_token}"}
    samples = []
    for _ in range(SAMPLE_COUNT):
        samples.append(
            await _measure(
                client, "POST", "/api/training/sessions?level=syllable",
                headers=headers,
            )
        )
    median = _valid_median_ms(samples, "training_start")
    _assert_within_threshold(median, THRESHOLDS["training_start"], "training_start")


@pytest.mark.asyncio
async def test_dialogue_scenarios_performance(client: AsyncClient):
    """对话场景列表延迟 < 200ms"""
    samples = []
    for _ in range(SAMPLE_COUNT):
        samples.append(await _measure(client, "GET", "/api/dialogue/scenarios"))
    median = _valid_median_ms(samples, "dialogue_scenarios")
    _assert_within_threshold(median, THRESHOLDS["dialogue_scenarios"], "dialogue_scenarios")


@pytest.mark.asyncio
async def test_report_summary_performance(client: AsyncClient, auth_token: str):
    """报告汇总接口延迟 < 500ms"""
    headers = {"Authorization": f"Bearer {auth_token}"}
    samples = []
    for _ in range(SAMPLE_COUNT):
        samples.append(
            await _measure(
                client, "GET", "/api/report/summary?days=30",
                headers=headers,
            )
        )
    median = _valid_median_ms(samples, "report_summary")
    _assert_within_threshold(median, THRESHOLDS["report_summary"], "report_summary")


@pytest.mark.asyncio
async def test_metrics_performance(client: AsyncClient, therapist_token: str):
    """监控指标接口延迟 < 100ms

    使用既有 therapist_token fixture（Bearer 头）以合法听力师身份请求：
    匿名/失效凭据返回的 401 不再是有效样本，会因有效成功样本数不足而失败，
    杜绝「401 因返回得快而通过性能门禁」的假绿。
    """
    headers = {"Authorization": f"Bearer {therapist_token}"}
    samples = []
    for _ in range(SAMPLE_COUNT):
        samples.append(
            await _measure(client, "GET", "/api/metrics", headers=headers)
        )
    median = _valid_median_ms(samples, "metrics")
    _assert_within_threshold(median, THRESHOLDS["metrics"], "metrics")
