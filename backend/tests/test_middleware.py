"""性能、缓存、限流和监控中间件的行为测试。"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_rate_limit_rejects_requests_after_limit(client: AsyncClient):
    responses = []
    for _ in range(6):
        responses.append(
            await client.post(
                "/api/auth/sms/send",
                json={"phone": "13800138000"},
            )
        )

    assert [response.status_code for response in responses[:5]] == [200] * 5
    assert responses[5].status_code == 429


@pytest.mark.asyncio
async def test_timing_middleware_emits_process_time_header(client: AsyncClient):
    response = await client.get("/")

    assert response.status_code == 200
    assert response.headers["X-Process-Time"].endswith("ms")


@pytest.mark.asyncio
async def test_metrics_endpoint_is_available(client: AsyncClient):
    response = await client.get("/api/metrics")

    assert response.status_code == 200
    assert "requests" in response.json()["data"]
