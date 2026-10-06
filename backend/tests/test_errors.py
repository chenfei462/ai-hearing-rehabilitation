"""统一异常与错误响应测试。"""

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
import pytest

from app.core.errors import (
    AppException,
    AIServiceTimeout,
    AIServiceUnavailable,
    ErrorCode,
    ForbiddenException,
    NotFoundException,
    register_exception_handlers,
)
from app.ai import AIServiceTimeout as ExportedAIServiceTimeout
from app.ai import AIServiceUnavailable as ExportedAIServiceUnavailable


def test_specialized_exceptions_have_expected_http_status():
    assert NotFoundException().http_status == 404
    assert ForbiddenException().http_status == 403
    assert AppException(code=ErrorCode.REDIS_UNAVAILABLE).http_status == 400


def test_ai_exceptions_are_publicly_defined_in_the_common_error_module():
    unavailable = AIServiceUnavailable(service="ASR", detail="offline")
    timeout = AIServiceTimeout(service="TTS", detail="slow")

    assert ExportedAIServiceUnavailable is AIServiceUnavailable
    assert ExportedAIServiceTimeout is AIServiceTimeout
    assert unavailable.code == ErrorCode.SERVICE_UNAVAILABLE
    assert timeout.code == ErrorCode.SERVICE_MAINTENANCE


@pytest.mark.asyncio
async def test_app_exception_handler_returns_stable_response_shape():
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/error")
    async def error_endpoint():
        raise AppException(
            code=ErrorCode.REDIS_UNAVAILABLE,
            message="Redis 暂时不可用",
            data={"retryable": True},
            http_status=503,
        )

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/error")

    assert response.status_code == 503
    assert response.json() == {
        "code": ErrorCode.REDIS_UNAVAILABLE,
        "data": {"retryable": True},
        "message": "Redis 暂时不可用",
    }
