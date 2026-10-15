
from argon2 import PasswordHasher
from argon2.exceptions import (
    InvalidHashError,
    VerificationError,
    VerifyMismatchError,
)


_password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    """
    Convert a plaintext password into a secure
    Argon2 password hash.
    """

    if not isinstance(password, str):
        raise ValueError(
            "Password must be a string."
        )

    if not password:
        raise ValueError(
            "Password cannot be empty."
        )

    return _password_hasher.hash(password)


def verify_password(
    password: str,
    password_hash: str,
) -> bool:
    """
    Verify a plaintext password against
    a previously stored Argon2 hash.
    """

    if not isinstance(password, str):
        return False

    if not isinstance(password_hash, str):
        return False

    try:
        return _password_hasher.verify(
            password_hash,
            password,
        )

    except (
        VerifyMismatchError,
        VerificationError,
        InvalidHashError,
    ):
        return False
