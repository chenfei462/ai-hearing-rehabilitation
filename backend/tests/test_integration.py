"""
集成测试 - 端到端 API 测试

注意：健康检查测试已移至 test_health.py，避免重复。
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestAuthAPI:
    """认证 API 测试"""

    async def test_send_sms(self, client: AsyncClient):
        response = await client.post(
            "/api/auth/sms/send",
            json={"phone": "13800138000"},
        )
        assert response.status_code == 200

    async def test_login_success(self, client: AsyncClient, test_redis):
        await client.post(
            "/api/auth/sms/send",
            json={"phone": "13800138000"},
        )
        code = test_redis.data["sms:13800138000"]
        response = await client.post(
            "/api/auth/login",
            json={"phone": "13800138000", "code": code},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 0
        assert "user" in data["data"]
        assert "access_token" in response.cookies

    async def test_login_wrong_code(self, client: AsyncClient):
        response = await client.post(
            "/api/auth/login",
            json={"phone": "13800138000", "code": "9999"},
        )
        data = response.json()
        assert data["code"] != 0

    async def test_get_me_without_token(self, client: AsyncClient):
        response = await client.get("/api/auth/me")
        assert response.status_code == 401

    async def test_get_me_with_token(self, client: AsyncClient, auth_token: str):
        response = await client.get(
            "/api/auth/me",
            cookies={"access_token": auth_token},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["phone"] == "13800138000"


@pytest.mark.asyncio
class TestTrainingAPI:
    """训练 API 测试"""

    async def test_start_session(self, client: AsyncClient, auth_token: str):
        cookies = {"access_token": auth_token}
        response = await client.post(
            "/api/training/sessions",
            params={"level": "syllable"},
            cookies=cookies,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 0
        assert "session_id" in data["data"]

    async def test_submit_answer(self, client: AsyncClient, auth_token: str):
        cookies = {"access_token": auth_token}
        # 先开始会话
        response = await client.post(
            "/api/training/sessions",
            params={"level": "syllable"},
            cookies=cookies,
        )
        session_id = response.json()["data"]["session_id"]

        # 提交答案
        response = await client.post(
            f"/api/training/sessions/{session_id}/answer",
            params={"item_id": 1, "answer": "测试"},
            cookies=cookies,
        )
        assert response.status_code == 200

    async def test_finish_session(self, client: AsyncClient, auth_token: str):
        cookies = {"access_token": auth_token}
        response = await client.post(
            "/api/training/sessions",
            params={"level": "syllable"},
            cookies=cookies,
        )
        session_id = response.json()["data"]["session_id"]

        response = await client.post(
            f"/api/training/sessions/{session_id}/finish",
            cookies=cookies,
        )
        assert response.status_code == 200
        data = response.json()
        assert "accuracy" in data["data"]


@pytest.mark.asyncio
class TestDialogueAPI:
    """对话 API 测试"""

    async def test_list_scenarios(self, client: AsyncClient):
        response = await client.get("/api/dialogue/scenarios")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data["data"], list)
        assert len(data["data"]) >= 3

    async def test_start_dialogue(self, client: AsyncClient, auth_token: str):
        cookies = {"access_token": auth_token}
        response = await client.post(
            "/api/dialogue/sessions",
            json={"scenario": "ordering"},
            cookies=cookies,
        )
        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data["data"]
        assert "greeting_text" in data["data"]


@pytest.mark.asyncio
class TestPronunciationAPI:
    """发音 API 测试"""

    async def test_get_next_task(self, client: AsyncClient, auth_token: str):
        cookies = {"access_token": auth_token}
        response = await client.get("/api/pronunciation/tasks/next", cookies=cookies)
        assert response.status_code == 200
        data = response.json()
        assert "error" in data["data"] or "text" in data["data"]


@pytest.mark.asyncio
class TestReportAPI:
    """报告 API 测试"""

    async def test_get_summary(self, client: AsyncClient, auth_token: str):
        cookies = {"access_token": auth_token}
        response = await client.get(
            "/api/report/summary",
            params={"days": 30},
            cookies=cookies,
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_sessions" in data["data"]
        assert "level_progress" in data["data"]


@pytest.mark.asyncio
class TestUserFlow:
    """用户完整流程测试（端到端）"""

    async def test_complete_training_flow(self, client: AsyncClient, test_redis):
        """完整训练流程：登录 -> 开始训练 -> 答题 -> 结束"""
        # 1. 登录
        await client.post(
            "/api/auth/sms/send",
            json={"phone": "13900139000"},
        )
        login_resp = await client.post(
            "/api/auth/login",
            json={"phone": "13900139000", "code": test_redis.data["sms:13900139000"]},
        )
        token = login_resp.cookies["access_token"]
        cookies = {"access_token": token}

        # 2. 开始训练
        session_resp = await client.post(
            "/api/training/sessions",
            params={"level": "syllable"},
            cookies=cookies,
        )
        session_data = session_resp.json()["data"]
        session_id = session_data["session_id"]

        # 3. 获取下一题
        next_resp = await client.get(
            f"/api/training/sessions/{session_id}/next",
            cookies=cookies,
        )
        assert next_resp.status_code == 200

        # 4. 提交答案
        answer_resp = await client.post(
            f"/api/training/sessions/{session_id}/answer",
            params={"item_id": 1, "answer": "测试答案"},
            cookies=cookies,
        )
        assert answer_resp.status_code == 200

        # 5. 结束训练
        finish_resp = await client.post(
            f"/api/training/sessions/{session_id}/finish",
            cookies=cookies,
        )
        assert finish_resp.status_code == 200
        finish_data = finish_resp.json()["data"]
        assert "accuracy" in finish_data

    async def test_complete_dialogue_flow(self, client: AsyncClient, test_redis):
        """完整对话流程：登录 -> 开始对话 -> 查看场景"""
        # 1. 登录
        await client.post(
            "/api/auth/sms/send",
            json={"phone": "13900139001"},
        )
        login_resp = await client.post(
            "/api/auth/login",
            json={"phone": "13900139001", "code": test_redis.data["sms:13900139001"]},
        )
        token = login_resp.cookies["access_token"]
        cookies = {"access_token": token}

        # 2. 查看场景列表
        scenarios_resp = await client.get("/api/dialogue/scenarios")
        scenarios = scenarios_resp.json()["data"]
        assert len(scenarios) >= 3

        # 3. 开始对话
        session_resp = await client.post(
            "/api/dialogue/sessions",
            json={"scenario": "ordering"},
            cookies=cookies,
        )
        session_data = session_resp.json()["data"]
        assert session_data["greeting_text"] != ""

    async def test_report_after_training(self, client: AsyncClient, test_redis):
        """训练后查看报告"""
        # 1. 登录
        await client.post(
            "/api/auth/sms/send",
            json={"phone": "13900139002"},
        )
        login_resp = await client.post(
            "/api/auth/login",
            json={"phone": "13900139002", "code": test_redis.data["sms:13900139002"]},
        )
        token = login_resp.cookies["access_token"]
        cookies = {"access_token": token}

        # 2. 查看报告（即使没有训练数据也应该正常返回）
        report_resp = await client.get(
            "/api/report/summary",
            params={"days": 7},
            cookies=cookies,
        )
        assert report_resp.status_code == 200
        data = report_resp.json()["data"]
        assert "total_sessions" in data


