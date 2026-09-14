"""
健康检查端点测试

使用 conftest.py 中的 shared client fixture。
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """测试基础健康检查"""
    resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert body["data"]["status"] == "healthy"
    assert body["data"]["version"] is not None


@pytest.mark.asyncio
async def test_detailed_health(client: AsyncClient):
    """测试详细健康检查（含数据库/Redis连通性）"""
    resp = await client.get("/health/detailed")
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert "checks" in body["data"]


@pytest.mark.asyncio
async def test_root(client: AsyncClient):
    """测试根路径"""
    resp = await client.get("/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert "name" in body["data"]
