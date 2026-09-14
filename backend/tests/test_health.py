"""
健康检查端点测试

使用 conftest.py 中的 shared client fixture。
"""
import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch, MagicMock


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
    # Mock the database and Redis to simulate success
    with patch("app.core.database.engine") as mock_engine, \
         patch("app.core.redis.redis_client") as mock_redis:
        
        # Mock successful database connection
        mock_conn = AsyncMock()
        mock_conn.execute = AsyncMock()
        mock_engine.connect.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
        mock_engine.connect.return_value.__aexit__ = AsyncMock()
        
        # Mock successful Redis ping
        mock_redis.ping = AsyncMock(return_value=True)
        
        resp = await client.get("/health/detailed")
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert body["data"]["status"] == "healthy"
        assert "checks" in body["data"]
        assert body["data"]["checks"]["database"] == "healthy"
        assert body["data"]["checks"]["redis"] == "healthy"


@pytest.mark.asyncio
async def test_detailed_health_degraded(client: AsyncClient):
    """测试详细健康检查当数据库或Redis不可用时返回503"""
    # Mock the database and Redis to simulate failures
    with patch("app.core.database.engine") as mock_engine, \
         patch("app.core.redis.redis_client") as mock_redis:
        
        # Mock database connection failure
        mock_engine.connect.return_value.__aenter__ = AsyncMock(side_effect=Exception("Database connection failed"))
        mock_engine.connect.return_value.__aexit__ = AsyncMock()
        
        # Mock Redis failure
        mock_redis.ping = AsyncMock(side_effect=Exception("Redis connection failed"))
        
        resp = await client.get("/health/detailed")
        assert resp.status_code == 503
        body = resp.json()
        assert body["code"] == 0
        assert body["data"]["status"] == "degraded"
        assert body["data"]["checks"]["database"] != "healthy"
        assert body["data"]["checks"]["redis"] != "healthy"


@pytest.mark.asyncio
async def test_root(client: AsyncClient):
    """测试根路径"""
    resp = await client.get("/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["code"] == 0
    assert "name" in body["data"]
