
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth_service import normalize_email
from app.models import User
from app.security import verify_password
from app.token_service import create_access_token


class InvalidCredentialsError(Exception):
    """Raised when login credentials are incorrect."""
    pass


def authenticate_user(
    db: Session,
    email: str,
    password: str,
) -> User:
    """
    Authenticate a user with their email and password.
    """

    try:
        normalized_email = normalize_email(email)
    except ValueError as error:
        raise InvalidCredentialsError(
            "Invalid email or password."
        ) from error

    user = db.scalar(
        select(User).where(
            User.email == normalized_email
        )
    )

    if user is None:
        raise InvalidCredentialsError(
            "Invalid email or password."
        )

    if not verify_password(
        password,
        user.password_hash,
    ):
        raise InvalidCredentialsError(
            "Invalid email or password."
        )

    return user


def login_user(
    db: Session,
    email: str,
    password: str,
) -> dict:
    """
    Authenticate the user and issue an access token.
    """

    user = authenticate_user(
        db=db,
        email=email,
        password=password,
    )

    access_token = create_access_token(user.id)

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }
