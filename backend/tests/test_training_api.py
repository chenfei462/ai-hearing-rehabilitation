"""
训练 API 认证与归属校验测试

验证：
- 未认证请求返回 401
- 用户不能访问其他用户的 session（返回 403）
- 认证用户可以正常访问自己的 session
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy import select

from app.models.user import User
from app.models.training import TrainingSession
from app.core.database import get_db
from app.core.security import create_access_token


# ── Helper ───────────────────────────────────────────────────


async def _ensure_user(engine, user_id: int, phone: str, role: str, nickname: str):
    """确保用户存在，已存在则跳过"""
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        existing = await session.execute(select(User).where(User.id == user_id))
        if existing.scalar_one_or_none() is None:
            session.add(User(id=user_id, phone=phone, role=role, nickname=nickname))
            await session.commit()


# ── Session-scoped fixtures ──────────────────────────────────


@pytest_asyncio.fixture(scope="session")
async def user1_token(test_engine) -> str:
    """user 1 的 token"""
    await _ensure_user(test_engine, 1, "13800138000", "patient", "测试用户")
    return create_access_token(data={"sub": "1", "role": "patient"})


@pytest_asyncio.fixture(scope="session")
async def user2_token(test_engine) -> str:
    """user 2 的 token"""
    await _ensure_user(test_engine, 2, "13900139000", "patient", "其他用户")
    return create_access_token(data={"sub": "2", "role": "patient"})


@pytest_asyncio.fixture
async def user1_session_id(test_engine, user1_token: str) -> int:
    """通过 API 为 user 1 创建一个训练 session，返回 session id"""
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
        resp = await ac.post(
            "/api/training/sessions",
            params={"level": "syllable"},
            headers={"Authorization": f"Bearer {user1_token}"},
        )
        assert resp.status_code == 200, f"创建 session 失败: {resp.text}"
        return resp.json()["data"]["session_id"]


# ── 认证测试 ─────────────────────────────────────────────────


@pytest.mark.asyncio
class TestTrainingAuth:
    """训练接口认证测试：未认证请求应返回 401"""

    async def test_start_session_requires_auth(self, client: AsyncClient):
        """POST /training/sessions 未认证应返回 401"""
        resp = await client.post(
            "/api/training/sessions",
            params={"level": "syllable"},
        )
        assert resp.status_code == 401

    async def test_get_next_requires_auth(
        self, client: AsyncClient, user1_session_id: int
    ):
        """GET /training/sessions/{id}/next 未认证应返回 401"""
        resp = await client.get(
            f"/api/training/sessions/{user1_session_id}/next",
        )
        assert resp.status_code == 401

    async def test_submit_answer_requires_auth(
        self, client: AsyncClient, user1_session_id: int
    ):
        """POST /training/sessions/{id}/answer 未认证应返回 401"""
        resp = await client.post(
            f"/api/training/sessions/{user1_session_id}/answer",
            params={"item_id": 1, "answer": "test", "response_ms": 1000},
        )
        assert resp.status_code == 401

    async def test_finish_session_requires_auth(
        self, client: AsyncClient, user1_session_id: int
    ):
        """POST /training/sessions/{id}/finish 未认证应返回 401"""
        resp = await client.post(
            f"/api/training/sessions/{user1_session_id}/finish",
        )
        assert resp.status_code == 401


# ── 归属校验测试 ─────────────────────────────────────────────


@pytest.mark.asyncio
class TestTrainingOwnership:
    """训练接口归属校验：用户不能访问其他用户的 session"""

    async def test_get_next_rejects_other_user(
        self,
        client: AsyncClient,
        user2_token: str,
        user1_session_id: int,
    ):
        """用户 2 不能获取用户 1 的 session 下一题（403）"""
        resp = await client.get(
            f"/api/training/sessions/{user1_session_id}/next",
            headers={"Authorization": f"Bearer {user2_token}"},
        )
        assert resp.status_code == 403
        body = resp.json()
        assert body["detail"]["code"] == 40301

    async def test_submit_answer_rejects_other_user(
        self,
        client: AsyncClient,
        user2_token: str,
        user1_session_id: int,
    ):
        """用户 2 不能向用户 1 的 session 提交答案（403）"""
        resp = await client.post(
            f"/api/training/sessions/{user1_session_id}/answer",
            params={"item_id": 1, "answer": "test", "response_ms": 1000},
            headers={"Authorization": f"Bearer {user2_token}"},
        )
        assert resp.status_code == 403
        body = resp.json()
        assert body["detail"]["code"] == 40301

    async def test_finish_session_rejects_other_user(
        self,
        client: AsyncClient,
        user2_token: str,
        user1_session_id: int,
    ):
        """用户 2 不能结束用户 1 的 session（403）"""
        resp = await client.post(
            f"/api/training/sessions/{user1_session_id}/finish",
            headers={"Authorization": f"Bearer {user2_token}"},
        )
        assert resp.status_code == 403
        body = resp.json()
        assert body["detail"]["code"] == 40301

    async def test_nonexistent_session_returns_403(
        self,
        client: AsyncClient,
        user1_token: str,
    ):
        """访问不存在的 session 也应返回 403（防枚举）"""
        resp = await client.get(
            "/api/training/sessions/99999/next",
            headers={"Authorization": f"Bearer {user1_token}"},
        )
        assert resp.status_code == 403

    async def test_owner_can_access_session(
        self,
        client: AsyncClient,
        user1_token: str,
        user1_session_id: int,
    ):
        """session 所有者可以正常访问"""
        resp = await client.get(
            f"/api/training/sessions/{user1_session_id}/next",
            headers={"Authorization": f"Bearer {user1_token}"},
        )
        # 成功（200）或没有更多题目（404），但绝不是 403
        assert resp.status_code in (200, 404)
        assert resp.status_code != 403