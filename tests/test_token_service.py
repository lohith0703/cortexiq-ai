
from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.token_service import (
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
    TokenValidationError,
    create_access_token,
    verify_access_token,
)


def test_create_access_token():
    token = create_access_token("user-123")

    assert isinstance(token, str)
    assert token.count(".") == 2


def test_verify_valid_token():
    token = create_access_token("user-123")

    user_id = verify_access_token(token)

    assert user_id == "user-123"


def test_token_contains_required_claims():
    token = create_access_token("user-123")

    payload = jwt.decode(
        token,
        JWT_SECRET_KEY,
        algorithms=[JWT_ALGORITHM],
    )

    assert payload["sub"] == "user-123"
    assert payload["type"] == "access"

    assert "iat" in payload
    assert "nbf" in payload
    assert "exp" in payload


def test_expired_token_rejected():
    now = datetime.now(timezone.utc)

    expired_token = jwt.encode(
        {
            "sub": "user-123",
            "iat": now - timedelta(hours=2),
            "nbf": now - timedelta(hours=2),
            "exp": now - timedelta(hours=1),
            "type": "access",
        },
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )

    with pytest.raises(TokenValidationError):
        verify_access_token(expired_token)


def test_tampered_token_rejected():
    token = create_access_token("user-123")

    parts = token.split(".")

    # Replace the signature with an invalid value.
    parts[2] = "invalid-signature"

    tampered_token = ".".join(parts)

    with pytest.raises(TokenValidationError):
        verify_access_token(tampered_token)


def test_wrong_token_type_rejected():
    now = datetime.now(timezone.utc)

    token = jwt.encode(
        {
            "sub": "user-123",
            "iat": now,
            "nbf": now,
            "exp": now + timedelta(minutes=30),
            "type": "refresh",
        },
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )

    with pytest.raises(TokenValidationError):
        verify_access_token(token)


def test_missing_user_id_rejected():
    with pytest.raises(ValueError):
        create_access_token("")


def test_empty_token_rejected():
    with pytest.raises(TokenValidationError):
        verify_access_token("")


def test_token_signed_with_wrong_key_rejected():
    now = datetime.now(timezone.utc)

    token = jwt.encode(
        {
            "sub": "user-123",
            "iat": now,
            "nbf": now,
            "exp": now + timedelta(minutes=30),
            "type": "access",
        },
        "this-is-not-the-real-signing-secret",
        algorithm=JWT_ALGORITHM,
    )

    with pytest.raises(TokenValidationError):
        verify_access_token(token)
