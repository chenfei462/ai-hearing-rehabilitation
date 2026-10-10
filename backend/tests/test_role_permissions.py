"""
角色权限测试

验证需要特定角色才能访问的 API 端点。
- 普通用户 (role=user) 不应访问听力师专属接口
- 听力师 (role=therapist) 可以访问所有接口
- 未认证请求应返回 401
"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestTherapistOnlyEndpoints:
    """听力师专属端点权限测试"""

    async def test_patients_requires_auth(self, client: AsyncClient):
        """未认证请求 /report/patients 应返回 401"""
        resp = await client.get("/api/report/patients")
        assert resp.status_code == 401

    async def test_patients_rejects_normal_user(
        self, client: AsyncClient, auth_token: str
    ):
        """普通用户 (role=user) 访问 /report/patients 应返回 403"""
        resp = await client.get(
            "/api/report/patients",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code == 403
        body = resp.json()
        assert body["detail"]["code"] == 40301

    async def test_patients_allows_therapist(
        self, client: AsyncClient, therapist_token: str
    ):
        """听力师 (role=therapist) 可以正常访问 /report/patients"""
        resp = await client.get(
            "/api/report/patients",
            headers={"Authorization": f"Bearer {therapist_token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert isinstance(body["data"], list)

    async def test_metrics_requires_auth(self, client: AsyncClient):
        """未认证请求 /api/metrics 应返回 401"""
        resp = await client.get("/api/metrics")
        assert resp.status_code == 401

    async def test_metrics_rejects_normal_user(
        self, client: AsyncClient, auth_token: str
    ):
        """普通用户 (role=patient) 访问 /api/metrics 应返回 403"""
        resp = await client.get(
            "/api/metrics",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code == 403
        body = resp.json()
        assert body["detail"]["code"] == 40301

    async def test_metrics_allows_therapist(
        self, client: AsyncClient, therapist_token: str
    ):
        """听力师 (role=therapist) 可以正常访问 /api/metrics"""
        resp = await client.get(
            "/api/metrics",
            headers={"Authorization": f"Bearer {therapist_token}"},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == 0
        assert "requests" in body["data"]


@pytest.mark.asyncio
class TestUserEndpointsWithRoles:
    """普通用户端点的角色兼容性测试"""

    async def test_report_summary_allows_user(
        self, client: AsyncClient, auth_token: str
    ):
        """普通用户可以访问自己的报告"""
        resp = await client.get(
            "/api/report/summary",
            params={"days": 30},
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert resp.status_code == 200

    async def test_report_summary_allows_therapist(
        self, client: AsyncClient, therapist_token: str
    ):
        """听力师也可以访问报告（作为用户功能）"""
        resp = await client.get(
            "/api/report/summary",
            params={"days": 30},
            headers={"Authorization": f"Bearer {therapist_token}"},
        )
        assert resp.status_code == 200

    async def test_training_requires_auth(self, client: AsyncClient):
        """未认证请求训练接口应返回 401"""
        resp = await client.post(
            "/api/training/sessions",
            params={"level": "syllable"},
        )
        assert resp.status_code == 401

    async def test_dialogue_scenarios_public(self, client: AsyncClient):
        """场景列表为公开接口，无需认证"""
        resp = await client.get("/api/dialogue/scenarios")
        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body["data"], list)
