"""ORM 模型、请求 Schema 和统一响应 Schema 的基础契约测试。"""

import pytest
from pydantic import ValidationError

from app.models.item_bank import ItemBank
from app.models.training import TrainingSession
from app.models.user import User
from app.schemas.auth import LoginRequest, SmsRequest
from app.schemas.response import ApiResponse, success_response


def test_core_models_expose_expected_tables_and_defaults():
    assert User.__tablename__ == "users"
    assert TrainingSession.__tablename__ == "training_sessions"
    assert ItemBank.__tablename__ == "item_bank"

    user = User(phone="13800138000", role="patient")
    session = TrainingSession(user_id=1, level="word")
    item = ItemBank(level="word", content_type="word", text="你好")

    assert user.role == "patient"
    assert TrainingSession.__table__.c.status.default.arg == "active"
    assert ItemBank.__table__.c.is_active.default.arg is True


def test_auth_schemas_validate_phone_and_code_lengths():
    assert SmsRequest(phone="13800138000").phone == "13800138000"
    assert LoginRequest(phone="13800138000", code="123456").code == "123456"

    with pytest.raises(ValidationError):
        SmsRequest(phone="123")
    with pytest.raises(ValidationError):
        LoginRequest(phone="13800138000", code="1")


def test_api_response_helpers_keep_one_wire_format():
    payload = success_response(data={"ok": True})
    response = ApiResponse.model_validate(payload)

    assert response.code == 0
    assert response.data == {"ok": True}
    assert response.message == "ok"
