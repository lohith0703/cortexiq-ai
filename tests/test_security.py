
import pytest

from app.security import (
    hash_password,
    verify_password,
)


def test_password_hash_is_not_plaintext():
    password = "StrongPassword123!"

    hashed = hash_password(password)

    assert hashed != password
    assert hashed.startswith("$argon2")


def test_correct_password():
    password = "StrongPassword123!"

    hashed = hash_password(password)

    assert verify_password(password, hashed) is True


def test_wrong_password():
    hashed = hash_password("StrongPassword123!")

    assert verify_password(
        "WrongPassword123!",
        hashed,
    ) is False


def test_different_salts():
    password = "StrongPassword123!"

    first_hash = hash_password(password)
    second_hash = hash_password(password)

    assert first_hash != second_hash


def test_empty_password_rejected():
    with pytest.raises(ValueError):
        hash_password("")


def test_invalid_hash_rejected():
    assert verify_password(
        "StrongPassword123!",
        "invalid-hash",
    ) is False
