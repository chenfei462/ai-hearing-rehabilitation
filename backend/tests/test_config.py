"""应用配置的安全边界测试。"""

import pytest

from app.core.config import Settings


def test_settings_accepts_a_strong_secret_key():
    settings = Settings(SECRET_KEY="a" * 32)

    assert settings.SECRET_KEY == "a" * 32


@pytest.mark.parametrize(
    "secret_key",
    [
        "",
        "too-short",
        "your-secret-key-change-in-production",
        "your_jwt_secret_key_here",
    ],
)
def test_settings_rejects_insecure_secret_keys(secret_key):
    with pytest.raises(ValueError, match="SECRET_KEY"):
        Settings(SECRET_KEY=secret_key)
