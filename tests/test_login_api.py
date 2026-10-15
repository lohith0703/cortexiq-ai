
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.database import get_db
from app.login_service import InvalidCredentialsError
from app.main import app
from app.models import User
from app.token_service import create_access_token


# ==========================================
# TEST FIXTURES
# ==========================================

@pytest.fixture
def mock_db():
    """
    Create a fake database session.

    No real PostgreSQL records are modified.
    """
    return MagicMock()


@pytest.fixture
def client(mock_db):
    """
    Create a FastAPI test client with an
    isolated database dependency override.
    """

    def override_db():
        yield mock_db

    previous_overrides = app.dependency_overrides.copy()

    app.dependency_overrides[get_db] = override_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous_overrides)


@pytest.fixture
def test_user():
    """
    Create a test user without saving it
    to the real database.
    """

    return User(
        id="test-user-123",
        email="test@example.com",
        password_hash="fake-hash-for-mocked-api-test",
        created_at=datetime.now(timezone.utc),
    )


# ==========================================
# TEST 1 — SUCCESSFUL LOGIN
# ==========================================

def test_login_success(client):
    with patch(
        "app.auth_router.login_user",
        return_value={
            "access_token": "mock-jwt-token",
            "token_type": "bearer",
        },
    ) as mocked_login:

        response = client.post(
            "/auth/login",
            json={
                "email": "test@example.com",
                "password": "StrongPassword123!",
            },
        )

    assert response.status_code == 200

    data = response.json()

    assert data["access_token"] == "mock-jwt-token"
    assert data["token_type"] == "bearer"

    mocked_login.assert_called_once()


# ==========================================
# TEST 2 — WRONG PASSWORD
# ==========================================

def test_wrong_password(client):
    with patch(
        "app.auth_router.login_user",
        side_effect=InvalidCredentialsError(
            "Invalid email or password."
        ),
    ):

        response = client.post(
            "/auth/login",
            json={
                "email": "test@example.com",
                "password": "WrongPassword123!",
            },
        )

    assert response.status_code == 401

    assert (
        response.json()["detail"]
        == "Invalid email or password."
    )


# ==========================================
# TEST 3 — INVALID EMAIL
# ==========================================

def test_invalid_login_email(client):
    response = client.post(
        "/auth/login",
        json={
            "email": "invalid-email",
            "password": "StrongPassword123!",
        },
    )

    assert response.status_code == 422


# ==========================================
# TEST 4 — MISSING PASSWORD
# ==========================================

def test_missing_login_password(client):
    response = client.post(
        "/auth/login",
        json={
            "email": "test@example.com",
        },
    )

    assert response.status_code == 422


# ==========================================
# TEST 5 — MISSING JWT
# ==========================================

def test_me_without_token(client):
    response = client.get("/auth/me")

    assert response.status_code == 401


# ==========================================
# TEST 6 — INVALID JWT
# ==========================================

def test_me_with_invalid_token(client):
    response = client.get(
        "/auth/me",
        headers={
            "Authorization": "Bearer invalid-token"
        },
    )

    assert response.status_code == 401


# ==========================================
# TEST 7 — VALID JWT
# ==========================================

def test_me_with_valid_token(
    client,
    mock_db,
    test_user,
):
    """
    Test the complete authentication dependency:

    1. Generate a real signed JWT.
    2. Decode and validate the JWT.
    3. Retrieve the matching user.
    4. Return a safe profile response.
    """

    token = create_access_token(test_user.id)

    # Return our test user when the endpoint
    # requests the user from the database.
    mock_db.get.return_value = test_user

    response = client.get(
        "/auth/me",
        headers={
            "Authorization": f"Bearer {token}"
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["id"] == test_user.id
    assert data["email"] == test_user.email
    assert "created_at" in data

    # Never expose sensitive credentials.
    assert "password" not in data
    assert "password_hash" not in data

    mock_db.get.assert_called_once_with(
        User,
        test_user.id,
    )
