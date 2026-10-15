
import pytest

from unittest.mock import MagicMock

from sqlalchemy.exc import IntegrityError

from app.auth_service import (
    UserAlreadyExistsError,
    normalize_email,
    register_user,
)

from app.models import User
from app.security import verify_password


# ==========================================
# EMAIL NORMALIZATION TESTS
# ==========================================

def test_normalize_email():
    result = normalize_email(
        "  TEST@EXAMPLE.COM  "
    )

    assert result == "test@example.com"


def test_empty_email_rejected():
    with pytest.raises(ValueError):
        normalize_email("")


def test_invalid_email_type_rejected():
    with pytest.raises(ValueError):
        normalize_email(None)


# ==========================================
# USER REGISTRATION TESTS
# ==========================================

def test_register_user_success():
    db = MagicMock()

    # Simulate no existing user.
    db.scalar.return_value = None

    user = register_user(
        db=db,
        email="  USER@EXAMPLE.COM  ",
        password="StrongPassword123!",
    )

    assert isinstance(user, User)

    assert user.email == "user@example.com"

    # Password must not be stored as plaintext.
    assert user.password_hash != "StrongPassword123!"

    assert verify_password(
        "StrongPassword123!",
        user.password_hash,
    )

    db.add.assert_called_once_with(user)
    db.commit.assert_called_once()
    db.refresh.assert_called_once_with(user)


def test_duplicate_email_rejected():
    db = MagicMock()

    db.scalar.return_value = User(
        email="user@example.com",
        password_hash="existing-hash",
    )

    with pytest.raises(UserAlreadyExistsError):
        register_user(
            db=db,
            email="USER@EXAMPLE.COM",
            password="StrongPassword123!",
        )

    db.add.assert_not_called()
    db.commit.assert_not_called()


def test_database_unique_constraint():
    db = MagicMock()

    db.scalar.return_value = None

    db.commit.side_effect = IntegrityError(
        statement="INSERT INTO users ...",
        params={},
        orig=Exception("Unique constraint violation"),
    )

    with pytest.raises(UserAlreadyExistsError):
        register_user(
            db=db,
            email="user@example.com",
            password="StrongPassword123!",
        )

    db.rollback.assert_called_once()


def test_empty_password_rejected():
    db = MagicMock()
    db.scalar.return_value = None

    with pytest.raises(ValueError):
        register_user(
            db=db,
            email="user@example.com",
            password="",
        )

    db.add.assert_not_called()
    db.commit.assert_not_called()


def test_registration_returns_user():
    db = MagicMock()
    db.scalar.return_value = None

    user = register_user(
        db=db,
        email="newuser@example.com",
        password="StrongPassword123!",
    )

    assert isinstance(user, User)
    assert user.email == "newuser@example.com"
    assert user.password_hash.startswith("$argon2")
