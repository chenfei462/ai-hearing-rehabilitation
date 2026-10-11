"""
集成测试配置

修复说明：
- P2-14: 移除弃用的 event_loop fixture，使用 pytest-asyncio 的内置事件循环管理
- P2-13: auth_token fixture 不再依赖硬编码验证码，直接通过 JWT 工具生成 token
"""
import pytest
import pytest_asyncio
import os
from unittest.mock import AsyncMock
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool, StaticPool
from sqlalchemy import select

from app.core.database import Base, get_db
from app.core.config import Settings
from app.models.user import User
from app.models.item_bank import ItemBank


# 测试数据库 URL（使用 SQLite 内存数据库）
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "sqlite+aiosqlite://")


async def _ensure_user(engine, user_id: int, phone: str, role: str, nickname: str):
    """确保用户存在，已存在则更新"""
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        existing = await session.execute(select(User).where(User.id == user_id))
        user = existing.scalar_one_or_none()
        if user is None:
            session.add(User(id=user_id, phone=phone, role=role, nickname=nickname))
        else:
            user.phone = phone
            user.role = role
            user.nickname = nickname
        await session.commit()


@pytest.fixture(scope="session")
def test_settings():
    """测试配置"""
    return Settings(
        DATABASE_URL=TEST_DATABASE_URL,
        REDIS_URL="redis://localhost:6379/1",
        SECRET_KEY="test-only-secret-key-with-at-least-32-characters-long",
        DEBUG=False,
    )


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    """测试数据库引擎（session 级别共享）"""
    # 导入所有模型以确保它们被注册到 Base.metadata
    import app.models  # noqa: F401

    engine_kwargs = {"echo": False}
    if TEST_DATABASE_URL.startswith("sqlite"):
        engine_kwargs.update({
            "connect_args": {"check_same_thread": False},
            "poolclass": StaticPool,
        })
    else:
        # Each test has its own event loop; do not reuse loop-bound connections.
        engine_kwargs["poolclass"] = NullPool
    engine = create_async_engine(TEST_DATABASE_URL, **engine_kwargs)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        session.add_all([
            ItemBank(
                level="syllable",
                content_type="syllable",
                text="ma",
                phonemes=["m", "a"],
                difficulty_b=-1.0,
                tags={"category": "test"},
            ),
            ItemBank(
                level="word",
                content_type="pronunciation",
                text="你好",
                phonemes=["n", "i", "h", "ao"],
                difficulty_b=-0.5,
                tags={
                    "pronunciation_difficulty": "easy",
                    "target_phonemes": ["ni", "hao"],
                },
            ),
        ])
        await session.commit()

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(test_engine):
    """测试数据库会话"""
    async_session = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session


@pytest_asyncio.fixture
async def client(test_engine):
    """测试 HTTP 客户端（带数据库依赖注入）"""
    from app.main import app

    mock_redis_client.data.clear()

    async_session = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )

    async def override_get_db():
        async with async_session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
def test_redis():
    """访问当前测试使用的内存 Redis，便于验证短信验证码流程。"""
    return mock_redis_client


@pytest_asyncio.fixture
async def auth_token(test_engine) -> str:
    """获取普通用户的认证 token（id=1）"""
    from app.core.security import create_access_token

    await _ensure_user(test_engine, 1, "13800138000", "patient", "测试用户")
    return create_access_token(data={"sub": "1", "role": "patient"})


@pytest_asyncio.fixture
async def therapist_token(test_engine) -> str:
    """获取听力师角色的认证 token（id=2）"""
    from app.core.security import create_access_token

    await _ensure_user(test_engine, 2, "13900139000", "therapist", "测试听力师")
    return create_access_token(data={"sub": "2", "role": "therapist"})


import sys
import types


class _MemoryPipeline:
    def __init__(self, client):
        self.client = client
        self.operations = []

    def incr(self, key):
        self.operations.append(("incr", key))
        return self

    def expire(self, key, seconds):
        self.operations.append(("expire", key, seconds))
        return self

    async def execute(self):
        for operation in self.operations:
            if operation[0] == "incr":
                self.client.data[operation[1]] = int(self.client.data.get(operation[1], 0)) + 1
        return [True] * len(self.operations)


class _MemoryRedis:
    """有状态的异步 Redis 测试替身，覆盖应用实际使用的最小接口。"""

    def __init__(self):
        self.data = {}

    async def ping(self):
        return True

    async def get(self, key):
        return self.data.get(key)

    async def set(self, key, value, *args, **kwargs):
        self.data[key] = value
        return True

    async def setex(self, key, _seconds, value):
        self.data[key] = value
        return True

    async def delete(self, key):
        self.data.pop(key, None)
        return True

    def pipeline(self):
        return _MemoryPipeline(self)

    async def close(self):
        return None


mock_redis_client = _MemoryRedis()
mock_redis_module = types.ModuleType("redis")
mock_redis_asyncio_module = types.ModuleType("redis.asyncio")
mock_redis_asyncio_module.from_url = lambda *args, **kwargs: mock_redis_client
mock_redis_asyncio_module.Redis = _MemoryRedis
mock_redis_module.asyncio = mock_redis_asyncio_module
mock_redis_module.Redis = _MemoryRedis

sys.modules["redis"] = mock_redis_module
sys.modules["redis.asyncio"] = mock_redis_asyncio_module

import app.core.redis


@pytest.fixture(autouse=True)
def mock_external_tts(monkeypatch):
    """Keep integration tests offline and prevent SDK event-loop nesting."""
    monkeypatch.setattr(
        "app.services.dialogue_orchestrator.tts_gateway.synthesize_to_url",
        AsyncMock(return_value=""),
    )
    from importlib import import_module

    tts_module = import_module("app.ai.tts_gateway")
    monkeypatch.setattr(
        tts_module.QwenTTSGateway,
        "synthesize_to_url",
        AsyncMock(return_value=""),
    )


async def _get_test_redis():
    return mock_redis_client


app.core.redis.get_redis = _get_test_redis
app.core.redis.redis_client = mock_redis_client
