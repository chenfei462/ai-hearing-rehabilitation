"""
集成测试配置

修复说明：
- P2-14: 移除弃用的 event_loop fixture，使用 pytest-asyncio 的内置事件循环管理
- P2-13: auth_token fixture 不再依赖硬编码验证码，直接通过 JWT 工具生成 token
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select

from app.core.database import Base, get_db
from app.core.config import Settings
from app.models.user import User


# 测试数据库 URL（使用 SQLite 内存数据库）
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"


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
        SECRET_KEY="your-secret-key-here-change-in-production",
        DEBUG=False,
    )


@pytest_asyncio.fixture(scope="session")
async def test_engine():
    """测试数据库引擎（session 级别共享）"""
    # 导入所有模型以确保它们被注册到 Base.metadata
    import app.models  # noqa: F401

    engine = create_async_engine(TEST_DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

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
