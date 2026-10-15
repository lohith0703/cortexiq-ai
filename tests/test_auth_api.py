
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.database import get_db
from app.main import app
from app.models import User


def override_get_db():
    yield MagicMock()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


def make_test_user():
    return User(
        id="test-user-123",
        email="test@example.com",
        password_hash="fake-hash-for-api-test",
        created_at=datetime.now(timezone.utc),
    )


def test_registration_success():
    with patch(
        "app.auth_router.register_user",
        return_value=make_test_user(),
    ) as mocked_register:
        response = client.post(
            "/auth/register",
            json={
                "email": "test@example.com",
                "password": "StrongPassword123!",
            },
        )

    assert response.status_code == 201

    data = response.json()

    assert data["id"] == "test-user-123"
    assert data["email"] == "test@example.com"
    assert "created_at" in data

    assert "password" not in data
    assert "password_hash" not in data

    mocked_register.assert_called_once()


def test_duplicate_registration():
    from app.auth_service import UserAlreadyExistsError

    with patch(
        "app.auth_router.register_user",
        side_effect=UserAlreadyExistsError(
            "An account with this email already exists."
        ),
    ):
        response = client.post(
            "/auth/register",
            json={
                "email": "test@example.com",
                "password": "StrongPassword123!",
            },
        )

    assert response.status_code == 409


def test_invalid_email():
    response = client.post(
        "/auth/register",
        json={
            "email": "not-an-email",
            "password": "StrongPassword123!",
        },
    )

    assert response.status_code == 422


def test_short_password():
    response = client.post(
        "/auth/register",
        json={
            "email": "test@example.com",
            "password": "short",
        },
    )

    assert response.status_code == 422


def test_missing_password():
    response = client.post(
        "/auth/register",
        json={
            "email": "test@example.com",
        },
    )

    assert response.status_code == 422
