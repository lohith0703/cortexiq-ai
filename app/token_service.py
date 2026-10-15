
import os

from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt

from dotenv import load_dotenv
from jwt.exceptions import InvalidTokenError


# Load environment variables explicitly.
load_dotenv(
    dotenv_path=Path(__file__).resolve().parent.parent / ".env"
)

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30")
)

if not JWT_SECRET_KEY or len(JWT_SECRET_KEY) < 48:
    raise RuntimeError(
        "JWT_SECRET_KEY must contain at least 48 characters."
    )

if ACCESS_TOKEN_EXPIRE_MINUTES <= 0:
    raise RuntimeError(
        "JWT_ACCESS_TOKEN_EXPIRE_MINUTES must be positive."
    )


class TokenValidationError(Exception):
    """Raised when a JWT is invalid or expired."""
    pass


def create_access_token(user_id: str) -> str:
    """
    Create a signed, short-lived JWT.

    The subject identifies the authenticated user.
    """

    if not user_id or not isinstance(user_id, str):
        raise ValueError("A valid user ID is required.")

    now = datetime.now(timezone.utc)

    payload = {
        "sub": user_id,
        "iat": now,
        "nbf": now,
        "exp": now + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        ),
        "type": "access",
    }

    return jwt.encode(
        payload,
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )


def verify_access_token(token: str) -> str:
    """
    Verify the signature, expiration, and required claims.

    Returns the user ID if the token is valid.
    """

    if not token or not isinstance(token, str):
        raise TokenValidationError(
            "Authentication token is missing."
        )

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            options={
                "require": [
                    "sub",
                    "iat",
                    "nbf",
                    "exp",
                    "type",
                ]
            },
            leeway=0,
        )

    except InvalidTokenError as error:
        raise TokenValidationError(
            "Invalid or expired authentication token."
        ) from error

    if payload.get("type") != "access":
        raise TokenValidationError(
            "Invalid token type."
        )

    user_id = payload.get("sub")

    if not isinstance(user_id, str) or not user_id:
        raise TokenValidationError(
            "Invalid token subject."
        )

    return user_id
