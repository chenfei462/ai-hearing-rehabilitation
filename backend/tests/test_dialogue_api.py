"""
对话API IDOR漏洞修复测试

测试内容：
- P1-06: 修复对话API IDOR漏洞，验证session所有权检查
- 未认证请求返回401
- 用户无法访问其他用户的session (返回403)
- 用户可以访问自己的session (返回200)
"""
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient


@pytest.mark.asyncio
class TestHandleTurnOwnership:
    """测试 handle_turn 端点的所有权验证"""

    async def test_handle_turn_unauthenticated(self, client: AsyncClient):
        """测试未认证请求返回401"""
        response = await client.post("/api/dialogue/sessions/1/turn", files={"audio": ("test.wav", b"fake_audio", "audio/wav")})
        assert response.status_code == 401

    async def test_handle_turn_other_user_session(self, client: AsyncClient, auth_token: str):
        """测试用户无法访问其他用户的session (IDOR防护)"""
        headers = {"Authorization": f"Bearer {auth_token}"}

        with patch("app.api.dialogue.DialogueService") as MockService:
            mock_service = AsyncMock()
            MockService.return_value = mock_service

            # 模拟会话属于其他用户 (user_id=999)
            mock_session = MagicMock()
            mock_session.id = 1
            mock_session.user_id = 999  # 不同的用户ID
            mock_service.get_session.return_value = mock_session

            response = await client.post(
                "/api/dialogue/sessions/1/turn",
                headers=headers,
                files={"audio": ("test.wav", b"fake_audio", "audio/wav")},
            )

            assert response.status_code == 403
            data = response.json()
            assert data["detail"]["code"] == 40301
            assert "无权访问" in data["detail"]["message"]

    async def test_handle_turn_nonexistent_session(self, client: AsyncClient, auth_token: str):
        """测试访问不存在的session返回403"""
        headers = {"Authorization": f"Bearer {auth_token}"}

        with patch("app.api.dialogue.DialogueService") as MockService:
            mock_service = AsyncMock()
            MockService.return_value = mock_service

            # 模拟会话不存在
            mock_service.get_session.return_value = None

            response = await client.post(
                "/api/dialogue/sessions/999/turn",
                headers=headers,
                files={"audio": ("test.wav", b"fake_audio", "audio/wav")},
            )

            assert response.status_code == 403
            data = response.json()
            assert data["detail"]["code"] == 40301

    async def test_handle_turn_own_session(self, client: AsyncClient, auth_token: str):
        """测试用户可以访问自己的session"""
        headers = {"Authorization": f"Bearer {auth_token}"}

        with patch("app.api.dialogue.DialogueService") as MockService:
            mock_service = AsyncMock()
            MockService.return_value = mock_service

            # 模拟会话属于当前用户 (user_id=1, 与auth_token对应)
            mock_session = MagicMock()
            mock_session.id = 1
            mock_session.user_id = 1  # 与auth_token中的用户ID一致
            mock_service.get_session.return_value = mock_session

            # 模拟handle_turn返回成功结果
            mock_service.handle_turn.return_value = {
                "turn_index": 1,
                "user_text": "你好",
                "ai_text": "你好！欢迎光临！",
                "ai_audio_url": "http://example.com/audio.wav",
                "latency_ms": 500,
                "remaining_turns": 4,
            }

            response = await client.post(
                "/api/dialogue/sessions/1/turn",
                headers=headers,
                files={"audio": ("test.wav", b"fake_audio", "audio/wav")},
            )

            assert response.status_code == 200
            data = response.json()
            assert data["code"] == 0
            assert data["data"]["user_text"] == "你好"


@pytest.mark.asyncio
class TestFinishSessionOwnership:
    """测试 finish_session 端点的所有权验证"""

    async def test_finish_session_unauthenticated(self, client: AsyncClient):
        """测试未认证请求返回401"""
        response = await client.post("/api/dialogue/sessions/1/finish")
        assert response.status_code == 401

    async def test_finish_session_other_user_session(self, client: AsyncClient, auth_token: str):
        """测试用户无法结束其他用户的session (IDOR防护)"""
        headers = {"Authorization": f"Bearer {auth_token}"}

        with patch("app.api.dialogue.DialogueService") as MockService:
            mock_service = AsyncMock()
            MockService.return_value = mock_service

            # 模拟会话属于其他用户 (user_id=999)
            mock_session = MagicMock()
            mock_session.id = 1
            mock_session.user_id = 999
            mock_service.get_session.return_value = mock_session

            response = await client.post(
                "/api/dialogue/sessions/1/finish",
                headers=headers,
            )

            assert response.status_code == 403
            data = response.json()
            assert data["detail"]["code"] == 40301
            assert "无权访问" in data["detail"]["message"]

    async def test_finish_session_nonexistent_session(self, client: AsyncClient, auth_token: str):
        """测试结束不存在的session返回403"""
        headers = {"Authorization": f"Bearer {auth_token}"}

        with patch("app.api.dialogue.DialogueService") as MockService:
            mock_service = AsyncMock()
            MockService.return_value = mock_service

            # 模拟会话不存在
            mock_service.get_session.return_value = None

            response = await client.post(
                "/api/dialogue/sessions/999/finish",
                headers=headers,
            )

            assert response.status_code == 403
            data = response.json()
            assert data["detail"]["code"] == 40301

    async def test_finish_session_own_session(self, client: AsyncClient, auth_token: str):
        """测试用户可以结束自己的session"""
        headers = {"Authorization": f"Bearer {auth_token}"}

        with patch("app.api.dialogue.DialogueService") as MockService:
            mock_service = AsyncMock()
            MockService.return_value = mock_service

            # 模拟会话属于当前用户 (user_id=1)
            mock_session = MagicMock()
            mock_session.id = 1
            mock_session.user_id = 1
            mock_service.get_session.return_value = mock_session

            # 模拟finish_session返回成功结果
            mock_service.finish_session.return_value = {
                "session_id": 1,
                "scenario": "ordering",
                "turn_count": 3,
                "summary": "您完成了对话练习，表现不错！",
                "duration_seconds": 120,
            }

            response = await client.post(
                "/api/dialogue/sessions/1/finish",
                headers=headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["code"] == 0
            assert data["data"]["session_id"] == 1
            assert data["data"]["turn_count"] == 3
