import pytest

from app.core.config import Settings
from app.core.security import create_access_token, verify_token


def test_secret_key_rejects_empty_and_short_values():
    with pytest.raises(ValueError):
        Settings(SECRET_KEY="")
    with pytest.raises(ValueError):
        Settings(SECRET_KEY="too-short")


def test_token_round_trip_and_invalid_token():
    token = create_access_token({"sub": "42", "role": "patient"})

    assert verify_token(token)["sub"] == "42"
    assert verify_token("not-a-jwt") is None
