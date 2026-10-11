"""F-67 Redis 测试端点隔离回归测试（完全离线，不建立任何真实 socket）。

覆盖：
- T1 显式 TEST_REDIS_URL 注入逐字生效；
- T2 未设置时缺省恒为隔离端点 redis://127.0.0.1:16479/1（port≠6379）；
- T3 进程 env 与 backend/.env(env_file) 双通道被封（显式 kwargs 最高优先级）；
- T4 fail-closed 守卫：任何等效端口 6379（含隐式默认端口）→ RuntimeError；
- T5 test_settings fixture 消费 resolve 结果（F-67 本体回归保护）；
- T6 离线 mock 语义零回退（from_url 返回内存客户端、无真实 socket）。

所有环境操纵一律经 monkeypatch，不断言进程 ambient 状态（CI 兼容）。
"""

import sys
from urllib.parse import urlsplit

import pytest

from app.core.config import Settings
from tests.conftest import (
    TEST_REDIS_URL_DEFAULT,
    _MemoryRedis,
    mock_redis_client,
    resolve_test_redis_url,
)


def test_t1_explicit_test_redis_url_is_used_verbatim(monkeypatch):
    """T1：显式设置 TEST_REDIS_URL 时逐字返回注入值。"""
    injected = "redis://127.0.0.1:16999/2"
    monkeypatch.setenv("TEST_REDIS_URL", injected)

    assert resolve_test_redis_url() == injected


def test_t2_default_is_isolated_endpoint_when_unset(monkeypatch):
    """T2：未设置 TEST_REDIS_URL 时缺省恒为隔离端点 127.0.0.1:16479。"""
    monkeypatch.delenv("TEST_REDIS_URL", raising=False)

    url = resolve_test_redis_url()
    parsed = urlsplit(url)

    assert url == TEST_REDIS_URL_DEFAULT == "redis://127.0.0.1:16479/1"
    assert parsed.hostname == "127.0.0.1"
    assert parsed.port == 16479
    assert parsed.port != 6379


def test_t3_env_and_env_file_channels_are_closed(monkeypatch):
    """T3：即使进程 env 注入宿主 REDIS_URL=...:6379，测试侧解析路径仍隔离。"""
    # 模拟 CI/.env 污染：宿主进程 env 存在指向 6379 的 REDIS_URL
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6379/1")
    monkeypatch.delenv("TEST_REDIS_URL", raising=False)

    # 解析函数只读 TEST_REDIS_URL，不受 REDIS_URL 污染影响
    assert resolve_test_redis_url() == TEST_REDIS_URL_DEFAULT

    # 按 test_settings 同款显式 kwargs 构造 Settings：init-kwargs 覆盖 env 与 env_file
    settings = Settings(
        DATABASE_URL="sqlite+aiosqlite://",
        REDIS_URL=resolve_test_redis_url(),
        SECRET_KEY="a" * 32,
        DEBUG=False,
    )
    parsed = urlsplit(settings.REDIS_URL)

    assert parsed.hostname == "127.0.0.1"
    assert parsed.port != 6379
    assert parsed.port == 16479


@pytest.mark.parametrize(
    "polluted_url",
    [
        "redis://localhost:6379/1",
        "redis://127.0.0.1:6379/1",
        "redis://localhost",  # 无端口 → 隐式 6379
        "rediss://127.0.0.1:6379/0",
    ],
)
def test_t4_fail_closed_guard_rejects_port_6379(monkeypatch, polluted_url):
    """T4：任何等效端口 6379（含隐式默认端口）→ RuntimeError，绝不静默回落。"""
    monkeypatch.setenv("TEST_REDIS_URL", polluted_url)

    with pytest.raises(RuntimeError):
        resolve_test_redis_url()


def test_t5_test_settings_fixture_consumes_resolved_url(test_settings):
    """T5：test_settings fixture 的 REDIS_URL 来自 resolve（F-67 直接回归保护）。"""
    parsed = urlsplit(test_settings.REDIS_URL)

    assert test_settings.REDIS_URL == resolve_test_redis_url()
    assert parsed.hostname == "127.0.0.1"
    assert parsed.port != 6379


async def test_t6_offline_mock_semantics_preserved():
    """T6：离线 mock 语义零回退——from_url 返回内存客户端，无真实 socket。"""
    redis_asyncio_module = sys.modules["redis.asyncio"]

    # 任意 DSN 经 from_url 均返回同一内存客户端（不建立连接）
    client = redis_asyncio_module.from_url("redis://127.0.0.1:16479/1")
    assert client is mock_redis_client
    assert isinstance(client, _MemoryRedis)

    # app.core.redis 仍被顶替为内存客户端
    import app.core.redis as app_redis

    assert app_redis.redis_client is mock_redis_client
    assert (await app_redis.get_redis()) is mock_redis_client
