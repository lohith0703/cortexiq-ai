
from unittest.mock import MagicMock

import pytest

from app.login_service import (
    InvalidCredentialsError,
    authenticate_user,
    login_user,
)
from app.models import User
from app.security import hash_password
from app.token_service import verify_access_token


@pytest.fixture
def test_user():
    return User(
        id="test-user-123",
        email="user@example.com",
        password_hash=hash_password("StrongPassword123!"),
    )


@pytest.fixture
def mock_db(test_user):
    db = MagicMock()
    db.scalar.return_value = test_user
    return db


# ------------------------------------------
# 1. CORRECT CREDENTIALS
# ------------------------------------------

def test_authenticate_valid_user(mock_db):
    user = authenticate_user(
        db=mock_db,
        email="user@example.com",
        password="StrongPassword123!",
    )

    assert user.id == "test-user-123"
    assert user.email == "user@example.com"


# ------------------------------------------
# 2. WRONG PASSWORD
# ------------------------------------------

def test_wrong_password_rejected(mock_db):
    with pytest.raises(InvalidCredentialsError):
        authenticate_user(
            db=mock_db,
            email="user@example.com",
            password="WrongPassword123!",
        )


# ------------------------------------------
# 3. NONEXISTENT USER
# ------------------------------------------

def test_nonexistent_user_rejected():
    db = MagicMock()
    db.scalar.return_value = None

    with pytest.raises(InvalidCredentialsError):
        authenticate_user(
            db=db,
            email="missing@example.com",
            password="StrongPassword123!",
        )


# ------------------------------------------
# 4. EMAIL NORMALIZATION
# ------------------------------------------

def test_email_normalization(mock_db):
    user = authenticate_user(
        db=mock_db,
        email="  USER@EXAMPLE.COM  ",
        password="StrongPassword123!",
    )

    assert user.email == "user@example.com"

    # Confirm the query was executed.
    mock_db.scalar.assert_called_once()


# ------------------------------------------
# 5. EMPTY EMAIL
# ------------------------------------------

def test_empty_email_rejected(mock_db):
    with pytest.raises(InvalidCredentialsError):
        authenticate_user(
            db=mock_db,
            email="",
            password="StrongPassword123!",
        )


# ------------------------------------------
# 6. LOGIN RETURNS A TOKEN
# ------------------------------------------

def test_login_returns_access_token(mock_db):
    result = login_user(
        db=mock_db,
        email="user@example.com",
        password="StrongPassword123!",
    )

    assert result["token_type"] == "bearer"
    assert isinstance(result["access_token"], str)

    user_id = verify_access_token(
        result["access_token"]
    )

    assert user_id == "test-user-123"


# ------------------------------------------
# 7. WRONG PASSWORD CANNOT GET TOKEN
# ------------------------------------------

def test_invalid_login_rejected(mock_db):
    with pytest.raises(InvalidCredentialsError):
        login_user(
            db=mock_db,
            email="user@example.com",
            password="IncorrectPassword!",
        )


# ------------------------------------------
# 8. SAME ERROR FOR UNKNOWN USER
#    AND INCORRECT PASSWORD
# ------------------------------------------

def test_generic_login_error(mock_db):
    with pytest.raises(InvalidCredentialsError) as wrong_password:
        authenticate_user(
            db=mock_db,
            email="user@example.com",
            password="IncorrectPassword!",
        )

    missing_db = MagicMock()
    missing_db.scalar.return_value = None

    with pytest.raises(InvalidCredentialsError) as missing_user:
        authenticate_user(
            db=missing_db,
            email="missing@example.com",
            password="StrongPassword123!",
        )

    assert str(wrong_password.value) == str(missing_user.value)
